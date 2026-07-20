import { env } from "cloudflare:workers";
import { decodeEventLog, getAddress, type Hex } from "viem";

export const dynamic = "force-dynamic";

const marketplaceEvents = [
  {
    type: "event",
    name: "ItemListed",
    inputs: [
      { indexed: true, name: "seller", type: "address" },
      { indexed: true, name: "nftAddress", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "price", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ItemCanceled",
    inputs: [
      { indexed: true, name: "seller", type: "address" },
      { indexed: true, name: "nftAddress", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ItemBought",
    inputs: [
      { indexed: true, name: "buyer", type: "address" },
      { indexed: true, name: "nftAddress", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "price", type: "uint256" },
      { indexed: false, name: "marketplaceFee", type: "uint256" },
      { indexed: false, name: "royaltyRecipient", type: "address" },
      { indexed: false, name: "royaltyAmount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ProceedsWithdrawn",
    inputs: [
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

type RpcLog = {
  address: string;
  blockNumber: Hex;
  transactionHash: Hex;
  logIndex: Hex;
  data: Hex;
  topics: readonly Hex[];
};

type RuntimeEnv = {
  DB: D1Database;
  MARKETPLACE_ADDRESS?: string;
  MARKETPLACE_DEPLOY_BLOCK?: string;
  SHIBARIUM_RPC_URL?: string;
};

const CHUNK_SIZE = 8_000;
const MAX_CHUNKS_PER_REQUEST = 8;
const CONFIRMATIONS = 12;

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Shibarium RPC returned ${response.status}`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message ?? "Shibarium RPC request failed");
  if (payload.result === undefined) throw new Error("Shibarium RPC returned no result");
  return payload.result;
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS indexer_state (id TEXT PRIMARY KEY NOT NULL, last_block INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY NOT NULL, nft_address TEXT NOT NULL, token_id TEXT NOT NULL, seller TEXT NOT NULL, price TEXT NOT NULL, active INTEGER NOT NULL, transaction_hash TEXT NOT NULL, created_block INTEGER NOT NULL, updated_block INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS marketplace_activity (id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL, nft_address TEXT, token_id TEXT, seller TEXT, buyer TEXT, price TEXT, marketplace_fee TEXT, royalty_recipient TEXT, royalty_amount TEXT, transaction_hash TEXT NOT NULL, block_number INTEGER NOT NULL, log_index INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS listings_active_block_idx ON listings (active, updated_block)"),
    db.prepare("CREATE INDEX IF NOT EXISTS listings_seller_idx ON listings (seller)"),
    db.prepare("CREATE INDEX IF NOT EXISTS activity_block_idx ON marketplace_activity (block_number, log_index)"),
  ]);
}

function listingId(nftAddress: string, tokenId: bigint) {
  return `${nftAddress.toLowerCase()}:${tokenId.toString()}`;
}

async function indexRange(db: D1Database, rpcUrl: string, address: string, fromBlock: number, toBlock: number) {
  const logs = await rpc<RpcLog[]>(rpcUrl, "eth_getLogs", [{
    address,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`,
  }]);

  const statements: D1PreparedStatement[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: marketplaceEvents, data: log.data, topics: log.topics, strict: true });
      const blockNumber = Number(BigInt(log.blockNumber));
      const logIndex = Number(BigInt(log.logIndex));
      const activityId = `${log.transactionHash}:${logIndex}`;

      if (decoded.eventName === "ItemListed") {
        const { seller, nftAddress, tokenId, price } = decoded.args;
        const id = listingId(nftAddress, tokenId);
        statements.push(db.prepare("INSERT INTO listings (id, nft_address, token_id, seller, price, active, transaction_hash, created_block, updated_block) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET seller = excluded.seller, price = excluded.price, active = 1, transaction_hash = excluded.transaction_hash, updated_block = excluded.updated_block").bind(id, nftAddress, tokenId.toString(), seller, price.toString(), log.transactionHash, blockNumber, blockNumber));
        statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_activity (id, event_type, nft_address, token_id, seller, price, transaction_hash, block_number, log_index) VALUES (?, 'listed', ?, ?, ?, ?, ?, ?, ?)").bind(activityId, nftAddress, tokenId.toString(), seller, price.toString(), log.transactionHash, blockNumber, logIndex));
      } else if (decoded.eventName === "ItemCanceled") {
        const { seller, nftAddress, tokenId } = decoded.args;
        statements.push(db.prepare("UPDATE listings SET active = 0, transaction_hash = ?, updated_block = ? WHERE id = ?").bind(log.transactionHash, blockNumber, listingId(nftAddress, tokenId)));
        statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_activity (id, event_type, nft_address, token_id, seller, transaction_hash, block_number, log_index) VALUES (?, 'canceled', ?, ?, ?, ?, ?, ?)").bind(activityId, nftAddress, tokenId.toString(), seller, log.transactionHash, blockNumber, logIndex));
      } else if (decoded.eventName === "ItemBought") {
        const { buyer, nftAddress, tokenId, price, marketplaceFee, royaltyRecipient, royaltyAmount } = decoded.args;
        statements.push(db.prepare("UPDATE listings SET active = 0, transaction_hash = ?, updated_block = ? WHERE id = ?").bind(log.transactionHash, blockNumber, listingId(nftAddress, tokenId)));
        statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_activity (id, event_type, nft_address, token_id, buyer, price, marketplace_fee, royalty_recipient, royalty_amount, transaction_hash, block_number, log_index) VALUES (?, 'sold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(activityId, nftAddress, tokenId.toString(), buyer, price.toString(), marketplaceFee.toString(), royaltyRecipient, royaltyAmount.toString(), log.transactionHash, blockNumber, logIndex));
      } else if (decoded.eventName === "ProceedsWithdrawn") {
        const { seller, amount } = decoded.args;
        statements.push(db.prepare("INSERT OR IGNORE INTO marketplace_activity (id, event_type, seller, price, transaction_hash, block_number, log_index) VALUES (?, 'withdrawn', ?, ?, ?, ?, ?)").bind(activityId, seller, amount.toString(), log.transactionHash, blockNumber, logIndex));
      }
    } catch {
      // Ignore logs from future contract events this indexer does not know yet.
    }
  }

  statements.push(db.prepare("INSERT INTO indexer_state (id, last_block, updated_at) VALUES ('marketplace', ?, ?) ON CONFLICT(id) DO UPDATE SET last_block = excluded.last_block, updated_at = excluded.updated_at").bind(toBlock, Date.now()));
  await db.batch(statements);
  return logs.length;
}

async function sync(db: D1Database, rpcUrl: string, address: string, deployBlock: number) {
  const latestHex = await rpc<Hex>(rpcUrl, "eth_blockNumber", []);
  const safeLatest = Math.max(0, Number(BigInt(latestHex)) - CONFIRMATIONS);
  const state = await db.prepare("SELECT last_block AS lastBlock FROM indexer_state WHERE id = 'marketplace'").first<{ lastBlock: number }>();
  let nextBlock = Math.max(deployBlock, (state?.lastBlock ?? deployBlock - 1) + 1);
  let chunks = 0;
  let logsProcessed = 0;

  while (nextBlock <= safeLatest && chunks < MAX_CHUNKS_PER_REQUEST) {
    const toBlock = Math.min(nextBlock + CHUNK_SIZE - 1, safeLatest);
    logsProcessed += await indexRange(db, rpcUrl, address, nextBlock, toBlock);
    nextBlock = toBlock + 1;
    chunks += 1;
  }

  return { safeLatest, syncedThrough: Math.min(nextBlock - 1, safeLatest), caughtUp: nextBlock > safeLatest, logsProcessed };
}

export async function GET() {
  const runtime = env as unknown as RuntimeEnv;
  const addressValue = runtime.MARKETPLACE_ADDRESS;
  const deployBlockValue = runtime.MARKETPLACE_DEPLOY_BLOCK;
  const rpcUrl = runtime.SHIBARIUM_RPC_URL ?? "https://rpc.shibarium.shib.io";

  if (!addressValue || !/^0x[a-fA-F0-9]{40}$/.test(addressValue) || !deployBlockValue || !/^\d+$/.test(deployBlockValue)) {
    return Response.json({ configured: false, listings: [], activity: [], sync: null });
  }

  const address = getAddress(addressValue);
  await ensureSchema(runtime.DB);
  let syncResult = null;
  let syncError: string | null = null;
  try {
    syncResult = await sync(runtime.DB, rpcUrl, address, Number(deployBlockValue));
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Indexer sync failed";
  }

  const [listingsResult, activityResult] = await runtime.DB.batch([
    runtime.DB.prepare("SELECT id, nft_address AS nftAddress, token_id AS tokenId, seller, price, transaction_hash AS transactionHash, created_block AS createdBlock, updated_block AS updatedBlock FROM listings WHERE active = 1 ORDER BY updated_block DESC LIMIT 48"),
    runtime.DB.prepare("SELECT id, event_type AS eventType, nft_address AS nftAddress, token_id AS tokenId, seller, buyer, price, marketplace_fee AS marketplaceFee, royalty_recipient AS royaltyRecipient, royalty_amount AS royaltyAmount, transaction_hash AS transactionHash, block_number AS blockNumber, log_index AS logIndex FROM marketplace_activity ORDER BY block_number DESC, log_index DESC LIMIT 30"),
  ]);

  return Response.json({
    configured: true,
    marketplaceAddress: address,
    listings: listingsResult.results,
    activity: activityResult.results,
    sync: syncResult,
    syncError,
  }, { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=45" } });
}
