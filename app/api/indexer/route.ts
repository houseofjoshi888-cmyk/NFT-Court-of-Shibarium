import { env } from "@runtime-env";
import { decodeEventLog, getAddress, type Hex } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";

export const dynamic = "force-dynamic";

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
};
type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<Array<{ results: Record<string, unknown>[] }>>;
};
type RuntimeEnv = {
  DB?: D1Database;
  MARKETPLACE_ADDRESS?: string;
  MARKETPLACE_DEPLOY_BLOCK?: string;
  ETHEREUM_MARKETPLACE_ADDRESS?: string;
  ETHEREUM_MARKETPLACE_DEPLOY_BLOCK?: string;
  ETHEREUM_RPC_URL?: string;
  SHIBARIUM_MARKETPLACE_ADDRESS?: string;
  SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK?: string;
  SHIBARIUM_RPC_URL?: string;
  POLYGON_MARKETPLACE_ADDRESS?: string;
  POLYGON_MARKETPLACE_DEPLOY_BLOCK?: string;
  POLYGON_RPC_URL?: string;
  BASE_MARKETPLACE_ADDRESS?: string;
  BASE_MARKETPLACE_DEPLOY_BLOCK?: string;
  BASE_RPC_URL?: string;
  ROBINHOOD_MARKETPLACE_ADDRESS?: string;
  ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK?: string;
  ROBINHOOD_RPC_URL?: string;
  ZORA_MARKETPLACE_ADDRESS?: string;
  ZORA_MARKETPLACE_DEPLOY_BLOCK?: string;
  ZORA_RPC_URL?: string;
  APECHAIN_MARKETPLACE_ADDRESS?: string;
  APECHAIN_MARKETPLACE_DEPLOY_BLOCK?: string;
  APECHAIN_RPC_URL?: string;
};

const marketplaceEvents = [
  { type: "event", name: "ItemListed", inputs: [
    { indexed: true, name: "seller", type: "address" },
    { indexed: true, name: "nftAddress", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
    { indexed: false, name: "price", type: "uint256" },
  ] },
  { type: "event", name: "ItemCanceled", inputs: [
    { indexed: true, name: "seller", type: "address" },
    { indexed: true, name: "nftAddress", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
  ] },
  { type: "event", name: "ItemBought", inputs: [
    { indexed: true, name: "buyer", type: "address" },
    { indexed: true, name: "nftAddress", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
    { indexed: false, name: "price", type: "uint256" },
    { indexed: false, name: "marketplaceFee", type: "uint256" },
    { indexed: false, name: "royaltyRecipient", type: "address" },
    { indexed: false, name: "royaltyAmount", type: "uint256" },
  ] },
  { type: "event", name: "ProceedsWithdrawn", inputs: [
    { indexed: true, name: "seller", type: "address" },
    { indexed: false, name: "amount", type: "uint256" },
  ] },
] as const;

type RpcLog = {
  address: string;
  blockNumber: Hex;
  transactionHash: Hex;
  logIndex: Hex;
  data: Hex;
  topics: [] | [Hex, ...Hex[]];
};
type IndexedListing = {
  id: string; chainId: number; nftAddress: string; tokenId: string; seller: string;
  price: string; transactionHash: string; createdBlock: number; updatedBlock: number;
};
type IndexedActivity = {
  id: string; chainId: number; eventType: string; nftAddress: string | null; tokenId: string | null;
  seller: string | null; buyer: string | null; price: string | null; marketplaceFee: string | null;
  royaltyRecipient: string | null; royaltyAmount: string | null; transactionHash: string;
  blockNumber: number; logIndex: number;
};

const CHUNK_SIZE = 8_000;
const MAX_CHUNKS_PER_REQUEST = 8;
const DEFAULT_MARKETPLACE_ADDRESS = "0x2C5F372746330465C3f4084CE6C6aBce22a48B4d";
const DEFAULT_MARKETPLACE_DEPLOY_BLOCK = "18216976";

function chainConfig(runtime: RuntimeEnv, chainId: MarketplaceChainId) {
  const chain = getMarketplaceChain(chainId);
  if (chainId === 1) return {
    chain,
    address: runtime.ETHEREUM_MARKETPLACE_ADDRESS,
    deployBlock: runtime.ETHEREUM_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.ETHEREUM_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 109) return {
    chain,
    address: runtime.SHIBARIUM_MARKETPLACE_ADDRESS ?? runtime.MARKETPLACE_ADDRESS ?? DEFAULT_MARKETPLACE_ADDRESS,
    deployBlock: runtime.SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK ?? runtime.MARKETPLACE_DEPLOY_BLOCK ?? DEFAULT_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.SHIBARIUM_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 137) return {
    chain,
    address: runtime.POLYGON_MARKETPLACE_ADDRESS,
    deployBlock: runtime.POLYGON_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.POLYGON_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 8453) return {
    chain,
    address: runtime.BASE_MARKETPLACE_ADDRESS,
    deployBlock: runtime.BASE_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.BASE_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 4663) return {
    chain,
    address: runtime.ROBINHOOD_MARKETPLACE_ADDRESS,
    deployBlock: runtime.ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.ROBINHOOD_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 7777777) return {
    chain,
    address: runtime.ZORA_MARKETPLACE_ADDRESS,
    deployBlock: runtime.ZORA_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.ZORA_RPC_URL ?? chain.rpcUrl,
  };
  return {
    chain,
    address: runtime.APECHAIN_MARKETPLACE_ADDRESS,
    deployBlock: runtime.APECHAIN_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.APECHAIN_RPC_URL ?? chain.rpcUrl,
  };
}

async function rpc<T>(chainName: string, url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${chainName} RPC returned ${response.status}`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message ?? `${chainName} RPC request failed`);
  if (payload.result === undefined) throw new Error(`${chainName} RPC returned no result`);
  return payload.result;
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS indexer_state (id TEXT PRIMARY KEY NOT NULL, last_block INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS multichain_listings (id TEXT PRIMARY KEY NOT NULL, chain_id INTEGER NOT NULL, nft_address TEXT NOT NULL, token_id TEXT NOT NULL, seller TEXT NOT NULL, price TEXT NOT NULL, active INTEGER NOT NULL, transaction_hash TEXT NOT NULL, created_block INTEGER NOT NULL, updated_block INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS multichain_marketplace_activity (id TEXT PRIMARY KEY NOT NULL, chain_id INTEGER NOT NULL, event_type TEXT NOT NULL, nft_address TEXT, token_id TEXT, seller TEXT, buyer TEXT, price TEXT, marketplace_fee TEXT, royalty_recipient TEXT, royalty_amount TEXT, transaction_hash TEXT NOT NULL, block_number INTEGER NOT NULL, log_index INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS multichain_listings_chain_active_idx ON multichain_listings (chain_id, active, updated_block)"),
    db.prepare("CREATE INDEX IF NOT EXISTS multichain_listings_chain_seller_idx ON multichain_listings (chain_id, seller)"),
    db.prepare("CREATE INDEX IF NOT EXISTS multichain_activity_chain_block_idx ON multichain_marketplace_activity (chain_id, block_number, log_index)"),
  ]);
}

function listingId(chainId: MarketplaceChainId, nftAddress: string, tokenId: bigint) {
  return `${chainId}:${nftAddress.toLowerCase()}:${tokenId}`;
}

function activityId(chainId: MarketplaceChainId, hash: string, logIndex: number) {
  return `${chainId}:${hash}:${logIndex}`;
}

function decodeLogs(chainId: MarketplaceChainId, logs: RpcLog[]) {
  const listings = new Map<string, IndexedListing>();
  const activity: IndexedActivity[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: marketplaceEvents, data: log.data, topics: log.topics, strict: true });
      const blockNumber = Number(BigInt(log.blockNumber));
      const logIndex = Number(BigInt(log.logIndex));
      const id = activityId(chainId, log.transactionHash, logIndex);
      if (decoded.eventName === "ItemListed") {
        const { seller, nftAddress, tokenId, price } = decoded.args;
        const itemId = listingId(chainId, nftAddress, tokenId);
        listings.set(itemId, { id: itemId, chainId, nftAddress, tokenId: String(tokenId), seller, price: String(price), transactionHash: log.transactionHash, createdBlock: blockNumber, updatedBlock: blockNumber });
        activity.push({ id, chainId, eventType: "listed", nftAddress, tokenId: String(tokenId), seller, buyer: null, price: String(price), marketplaceFee: null, royaltyRecipient: null, royaltyAmount: null, transactionHash: log.transactionHash, blockNumber, logIndex });
      } else if (decoded.eventName === "ItemCanceled") {
        const { seller, nftAddress, tokenId } = decoded.args;
        listings.delete(listingId(chainId, nftAddress, tokenId));
        activity.push({ id, chainId, eventType: "canceled", nftAddress, tokenId: String(tokenId), seller, buyer: null, price: null, marketplaceFee: null, royaltyRecipient: null, royaltyAmount: null, transactionHash: log.transactionHash, blockNumber, logIndex });
      } else if (decoded.eventName === "ItemBought") {
        const { buyer, nftAddress, tokenId, price, marketplaceFee, royaltyRecipient, royaltyAmount } = decoded.args;
        const itemId = listingId(chainId, nftAddress, tokenId);
        const prior = listings.get(itemId);
        listings.delete(itemId);
        activity.push({ id, chainId, eventType: "sold", nftAddress, tokenId: String(tokenId), seller: prior?.seller ?? null, buyer, price: String(price), marketplaceFee: String(marketplaceFee), royaltyRecipient, royaltyAmount: String(royaltyAmount), transactionHash: log.transactionHash, blockNumber, logIndex });
      } else {
        const { seller, amount } = decoded.args;
        activity.push({ id, chainId, eventType: "withdrawn", nftAddress: null, tokenId: null, seller, buyer: null, price: String(amount), marketplaceFee: null, royaltyRecipient: null, royaltyAmount: null, transactionHash: log.transactionHash, blockNumber, logIndex });
      }
    } catch {
      // A later contract version may add events this release does not index.
    }
  }
  return { listings, activity };
}

async function indexRange(db: D1Database, chainId: MarketplaceChainId, chainName: string, rpcUrl: string, address: string, fromBlock: number, toBlock: number) {
  const logs = await rpc<RpcLog[]>(chainName, rpcUrl, "eth_getLogs", [{ address, fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}` }]);
  const statements: D1PreparedStatement[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: marketplaceEvents, data: log.data, topics: log.topics, strict: true });
      const blockNumber = Number(BigInt(log.blockNumber));
      const logIndex = Number(BigInt(log.logIndex));
      const eventId = activityId(chainId, log.transactionHash, logIndex);
      if (decoded.eventName === "ItemListed") {
        const { seller, nftAddress, tokenId, price } = decoded.args;
        const id = listingId(chainId, nftAddress, tokenId);
        statements.push(db.prepare("INSERT INTO multichain_listings (id, chain_id, nft_address, token_id, seller, price, active, transaction_hash, created_block, updated_block) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET seller=excluded.seller, price=excluded.price, active=1, transaction_hash=excluded.transaction_hash, updated_block=excluded.updated_block").bind(id, chainId, nftAddress, String(tokenId), seller, String(price), log.transactionHash, blockNumber, blockNumber));
        statements.push(db.prepare("INSERT OR IGNORE INTO multichain_marketplace_activity (id, chain_id, event_type, nft_address, token_id, seller, price, transaction_hash, block_number, log_index) VALUES (?, ?, 'listed', ?, ?, ?, ?, ?, ?, ?)").bind(eventId, chainId, nftAddress, String(tokenId), seller, String(price), log.transactionHash, blockNumber, logIndex));
      } else if (decoded.eventName === "ItemCanceled") {
        const { seller, nftAddress, tokenId } = decoded.args;
        statements.push(db.prepare("UPDATE multichain_listings SET active=0, transaction_hash=?, updated_block=? WHERE id=?").bind(log.transactionHash, blockNumber, listingId(chainId, nftAddress, tokenId)));
        statements.push(db.prepare("INSERT OR IGNORE INTO multichain_marketplace_activity (id, chain_id, event_type, nft_address, token_id, seller, transaction_hash, block_number, log_index) VALUES (?, ?, 'canceled', ?, ?, ?, ?, ?, ?)").bind(eventId, chainId, nftAddress, String(tokenId), seller, log.transactionHash, blockNumber, logIndex));
      } else if (decoded.eventName === "ItemBought") {
        const { buyer, nftAddress, tokenId, price, marketplaceFee, royaltyRecipient, royaltyAmount } = decoded.args;
        statements.push(db.prepare("UPDATE multichain_listings SET active=0, transaction_hash=?, updated_block=? WHERE id=?").bind(log.transactionHash, blockNumber, listingId(chainId, nftAddress, tokenId)));
        statements.push(db.prepare("INSERT OR IGNORE INTO multichain_marketplace_activity (id, chain_id, event_type, nft_address, token_id, buyer, price, marketplace_fee, royalty_recipient, royalty_amount, transaction_hash, block_number, log_index) VALUES (?, ?, 'sold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(eventId, chainId, nftAddress, String(tokenId), buyer, String(price), String(marketplaceFee), royaltyRecipient, String(royaltyAmount), log.transactionHash, blockNumber, logIndex));
      } else {
        const { seller, amount } = decoded.args;
        statements.push(db.prepare("INSERT OR IGNORE INTO multichain_marketplace_activity (id, chain_id, event_type, seller, price, transaction_hash, block_number, log_index) VALUES (?, ?, 'withdrawn', ?, ?, ?, ?, ?)").bind(eventId, chainId, seller, String(amount), log.transactionHash, blockNumber, logIndex));
      }
    } catch {}
  }
  statements.push(db.prepare("INSERT INTO indexer_state (id, last_block, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_block=excluded.last_block, updated_at=excluded.updated_at").bind(`marketplace:${chainId}`, toBlock, Date.now()));
  await db.batch(statements);
  return logs.length;
}

async function sync(db: D1Database, chainId: MarketplaceChainId, chainName: string, confirmations: number, rpcUrl: string, address: string, deployBlock: number) {
  const latestHex = await rpc<Hex>(chainName, rpcUrl, "eth_blockNumber", []);
  const safeLatest = Math.max(0, Number(BigInt(latestHex)) - confirmations);
  const state = await db.prepare("SELECT last_block AS lastBlock FROM indexer_state WHERE id = ?").bind(`marketplace:${chainId}`).first<{ lastBlock: number }>();
  let nextBlock = Math.max(deployBlock, (state?.lastBlock ?? deployBlock - 1) + 1);
  let chunks = 0;
  let logsProcessed = 0;
  while (nextBlock <= safeLatest && chunks < MAX_CHUNKS_PER_REQUEST) {
    const toBlock = Math.min(nextBlock + CHUNK_SIZE - 1, safeLatest);
    logsProcessed += await indexRange(db, chainId, chainName, rpcUrl, address, nextBlock, toBlock);
    nextBlock = toBlock + 1;
    chunks += 1;
  }
  return { safeLatest, syncedThrough: Math.min(nextBlock - 1, safeLatest), caughtUp: nextBlock > safeLatest, logsProcessed };
}

async function syncWithoutDatabase(chainId: MarketplaceChainId, chainName: string, confirmations: number, rpcUrl: string, address: string, deployBlock: number) {
  const latestHex = await rpc<Hex>(chainName, rpcUrl, "eth_blockNumber", []);
  const safeLatest = Math.max(0, Number(BigInt(latestHex)) - confirmations);
  const maximumRange = CHUNK_SIZE * MAX_CHUNKS_PER_REQUEST;
  const fromBlock = Math.max(deployBlock, safeLatest - maximumRange + 1);
  const logs: RpcLog[] = [];
  for (let start = fromBlock; start <= safeLatest; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, safeLatest);
    logs.push(...await rpc<RpcLog[]>(chainName, rpcUrl, "eth_getLogs", [{ address, fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}` }]));
  }
  const decoded = decodeLogs(chainId, logs);
  return {
    listings: [...decoded.listings.values()].sort((a, b) => b.updatedBlock - a.updatedBlock).slice(0, 48),
    activity: decoded.activity.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex).slice(0, 30),
    sync: { safeLatest, syncedThrough: safeLatest, caughtUp: fromBlock === deployBlock, logsProcessed: logs.length },
    syncError: fromBlock > deployBlock ? `Stateless indexer is limited to the latest ${maximumRange.toLocaleString()} blocks.` : null,
  };
}

export async function GET(request: Request) {
  const requestedChainId = Number(new URL(request.url).searchParams.get("chainId") ?? 109);
  if (!isMarketplaceChainId(requestedChainId)) {
    return Response.json({ error: "Unsupported chain", configured: false, listings: [], activity: [], sync: null }, { status: 400 });
  }
  const runtime = env as unknown as RuntimeEnv;
  const config = chainConfig(runtime, requestedChainId);
  const baseResponse = { chainId: requestedChainId, chain: config.chain.name, currency: config.chain.currency, explorerUrl: config.chain.explorerUrl };
  if (!config.address || !/^0x[a-fA-F0-9]{40}$/.test(config.address) || !config.deployBlock || !/^\d+$/.test(config.deployBlock)) {
    return Response.json({ ...baseResponse, configured: false, listings: [], activity: [], sync: null });
  }
  const address = getAddress(config.address);
  if (!runtime.DB) {
    try {
      const result = await syncWithoutDatabase(requestedChainId, config.chain.name, config.chain.confirmations, config.rpcUrl, address, Number(config.deployBlock));
      return Response.json({ ...baseResponse, configured: true, marketplaceAddress: address, ...result }, { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=45" } });
    } catch (error) {
      return Response.json({ ...baseResponse, configured: true, marketplaceAddress: address, listings: [], activity: [], sync: null, syncError: error instanceof Error ? error.message : "Indexer sync failed" }, { status: 502 });
    }
  }
  await ensureSchema(runtime.DB);
  let syncResult = null;
  let syncError: string | null = null;
  try {
    syncResult = await sync(runtime.DB, requestedChainId, config.chain.name, config.chain.confirmations, config.rpcUrl, address, Number(config.deployBlock));
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Indexer sync failed";
  }
  const [listingsResult, activityResult] = await runtime.DB.batch([
    runtime.DB.prepare("SELECT id, chain_id AS chainId, nft_address AS nftAddress, token_id AS tokenId, seller, price, transaction_hash AS transactionHash, created_block AS createdBlock, updated_block AS updatedBlock FROM multichain_listings WHERE chain_id = ? AND active = 1 ORDER BY updated_block DESC LIMIT 48").bind(requestedChainId),
    runtime.DB.prepare("SELECT id, chain_id AS chainId, event_type AS eventType, nft_address AS nftAddress, token_id AS tokenId, seller, buyer, price, marketplace_fee AS marketplaceFee, royalty_recipient AS royaltyRecipient, royalty_amount AS royaltyAmount, transaction_hash AS transactionHash, block_number AS blockNumber, log_index AS logIndex FROM multichain_marketplace_activity WHERE chain_id = ? ORDER BY block_number DESC, log_index DESC LIMIT 30").bind(requestedChainId),
  ]);
  return Response.json({ ...baseResponse, configured: true, marketplaceAddress: address, listings: listingsResult.results, activity: activityResult.results, sync: syncResult, syncError }, { headers: { "cache-control": "public, max-age=15, stale-while-revalidate=45" } });
}
