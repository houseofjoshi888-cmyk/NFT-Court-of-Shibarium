import { encodeFunctionData, getAddress, keccak256, stringToHex } from "viem";
import {
  getMarketplaceChain,
  isMarketplaceChainId,
  tokenUrl,
  type MarketplaceChainId,
} from "@/lib/marketplace-chains";
import { env } from "@runtime-env";

export const dynamic = "force-dynamic";

// Safety ceiling for unusually large wallets; normal pagination stops as soon
// as the explorer reports that no next page remains.
const MAX_PAGES = 100;
const PAGE_SIZE = 50;
const ERC721_TRANSFER_TOPIC = keccak256(stringToHex("Transfer(address,address,uint256)"));
const ownerOfAbi = [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "owner", type: "address" }] }] as const;

type ExplorerAttribute = {
  trait_type?: string | null;
  value?: string | number | boolean | null;
};

type ExplorerNft = {
  id?: string | number;
  value?: string | null;
  token_type?: string | null;
  image_url?: string | null;
  media_url?: string | null;
  thumbnails?: { image_url?: string | null; image?: string | null } | null;
  external_app_url?: string | null;
  metadata?: {
    name?: string | null;
    image?: string | null;
    image_url?: string | null;
    image_data?: string | null;
    description?: string | null;
    external_url?: string | null;
    attributes?: ExplorerAttribute[] | null;
  } | null;
  token?: {
    address_hash?: string;
    name?: string | null;
    symbol?: string | null;
    type?: string | null;
  } | null;
};

type ExplorerPage = {
  items?: ExplorerNft[];
  next_page_params?: Record<string, string | number | null> | null;
};

type AlchemyNft = {
  contract?: { address?: string; name?: string | null; symbol?: string | null };
  tokenId?: string;
  tokenType?: string;
  name?: string | null;
  description?: string | null;
  image?: { cachedUrl?: string | null; thumbnailUrl?: string | null; pngUrl?: string | null; originalUrl?: string | null };
  raw?: { metadata?: { image?: string | null; external_url?: string | null; attributes?: ExplorerAttribute[] | null } };
  balance?: string;
};

type AlchemyPage = { ownedNfts?: AlchemyNft[]; pageKey?: string | null };

type WalletNft = {
  contractAddress: string;
  tokenId: string;
  tokenType: string;
  quantity: string;
  name: string | null;
  collection: string | null;
  imageUrl: string | null;
  description: string | null;
  externalUrl: string | null;
  explorerUrl: string;
  chainId: MarketplaceChainId;
  traits: Array<{ type: string; value: string }>;
};

function mediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("ipfs://ipfs/")) return `https://ipfs.io/ipfs/${value.slice(12)}`;
  if (value.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if (value.startsWith("ar://")) return `https://arweave.net/${value.slice(5)}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

function embeddedImage(value: string | null | undefined) {
  if (!value) return null;
  if (value.trimStart().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  }
  return mediaUrl(value);
}

function metadataImageFallback(chainId: MarketplaceChainId, contractAddress: string, tokenId: string) {
  const params = new URLSearchParams({ chainId: String(chainId), contract: contractAddress, tokenId });
  return `/api/nft-image?${params}`;
}

function marketplaceImageUrl(source: string | null, chainId: MarketplaceChainId, contractAddress: string, tokenId: string) {
  if (!source) return metadataImageFallback(chainId, contractAddress, tokenId);
  if (source.startsWith("data:")) return source;
  const params = new URLSearchParams({ chainId: String(chainId), contract: contractAddress, tokenId, source });
  return `/api/nft-image?${params}`;
}

function explorerCandidates(chainId: MarketplaceChainId) {
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const configured = runtime[`${chain.slug.toUpperCase()}_EXPLORER_API_URL`];
  const blockscoutKey = runtime.BLOCKSCOUT_API_KEY;
  const candidates: Array<{ url: string; apiKey?: string }> = [];

  for (const url of [configured, chain.explorerApiUrl]) {
    if (url && !candidates.some((candidate) => candidate.url === url)) candidates.push({ url });
  }

  // Blockscout's multichain API is useful when an individual explorer blocks
  // server requests (notably Robinhood). It requires a Blockscout API key.
  if (blockscoutKey) {
    candidates.push({ url: `https://api.blockscout.com/${chainId}/api/v2`, apiKey: blockscoutKey });
  }

  return candidates;
}

function addExplorerItem(nfts: Map<string, WalletNft>, item: ExplorerNft, chainId: MarketplaceChainId) {
  const contractAddress = item.token?.address_hash;
  if (!contractAddress || item.id === undefined) return;

  const tokenId = String(item.id);
  const key = `${contractAddress.toLowerCase()}:${tokenId}`;
  const explorerImage =
    mediaUrl(item.image_url ?? item.thumbnails?.image_url ?? item.thumbnails?.image ?? item.metadata?.image_url ?? item.metadata?.image ?? item.media_url) ??
    embeddedImage(item.metadata?.image_data);
  nfts.set(key, {
    contractAddress,
    tokenId,
    tokenType: item.token_type ?? item.token?.type ?? "ERC-721",
    quantity: item.value ?? "1",
    name: item.metadata?.name ?? null,
    collection: item.token?.name ?? item.token?.symbol ?? null,
    imageUrl: marketplaceImageUrl(explorerImage, chainId, contractAddress, tokenId),
    description: item.metadata?.description ?? null,
    externalUrl: mediaUrl(item.metadata?.external_url ?? item.external_app_url),
    explorerUrl: tokenUrl(chainId, contractAddress, tokenId),
    chainId,
    traits: (item.metadata?.attributes ?? []).flatMap((attribute) =>
      attribute.trait_type && attribute.value !== null && attribute.value !== undefined
        ? [{ type: attribute.trait_type, value: String(attribute.value) }]
        : [],
    ),
  });
}

function hasImageSource(imageUrl: string | null) {
  if (!imageUrl) return false;
  if (imageUrl.startsWith("data:image/")) return true;
  try { return new URL(imageUrl, "https://marketplace.local").searchParams.has("source"); }
  catch { return false; }
}

function mergeNfts(target: Map<string, WalletNft>, incoming: WalletNft[]) {
  for (const nft of incoming) {
    const key = `${nft.contractAddress.toLowerCase()}:${nft.tokenId}`;
    const current = target.get(key);
    if (!current) { target.set(key, nft); continue; }
    target.set(key, {
      ...current,
      name: current.name ?? nft.name,
      collection: current.collection ?? nft.collection,
      description: current.description ?? nft.description,
      externalUrl: current.externalUrl ?? nft.externalUrl,
      traits: current.traits.length ? current.traits : nft.traits,
      imageUrl: hasImageSource(current.imageUrl) ? current.imageUrl : nft.imageUrl ?? current.imageUrl,
    });
  }
}

async function fetchNftProvider(url: string) {
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{
        headers:{accept:"application/json"},
        signal:AbortSignal.timeout(15_000),
        next:{revalidate:30},
      });
      if(response.ok||![429,500,502,503,504].includes(response.status)||attempt===2)return response;
    }catch(error){if(attempt===2)throw error;}
    await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
  }
  throw new Error("NFT provider retries exhausted");
}

async function fetchFromExplorer(
  apiUrl: string,
  apiKey: string | undefined,
  address: string,
  chainId: MarketplaceChainId,
) {
  const nfts = new Map<string, WalletNft>();
  let pageParams: Record<string, string | number | null> | null = null;
  const seen=new Set<string>();
  let complete=false;
  let warning="";
  try {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ type: "ERC-721,ERC-1155", items_count: String(PAGE_SIZE) });
    if (apiKey) params.set("apikey", apiKey);
    for (const [key, value] of Object.entries(pageParams ?? {})) {
      if (value !== null) params.set(key, String(value));
    }

    const response = await fetchNftProvider(`${apiUrl}/addresses/${address}/nft?${params}`);
    if (!response.ok) throw new Error(`explorer returned ${response.status}`);

    const payload = (await response.json()) as ExplorerPage;
    if (!Array.isArray(payload.items)) throw new Error("explorer returned an invalid NFT response");
    for (const item of payload.items) addExplorerItem(nfts, item, chainId);
    pageParams = payload.next_page_params ?? null;
    if (!pageParams) {complete=true;break;}
    const cursor=JSON.stringify(pageParams);
    if(seen.has(cursor))throw new Error("Explorer repeated its pagination cursor");
    seen.add(cursor);
  }
  } catch(error) { warning=error instanceof Error?error.message:"Explorer pagination interrupted"; }
  return {nfts:[...nfts.values()],complete,warning:complete?"":warning||"Explorer pagination limit reached; some holdings may be missing."};
}

const ALCHEMY_NETWORKS: Partial<Record<MarketplaceChainId, string>> = {
  1: "eth-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  4663: "robinhood-mainnet",
  33139: "apechain-mainnet",
  7777777: "zora-mainnet",
};

async function fetchFromAlchemy(address: string, chainId: MarketplaceChainId, apiKey: string) {
  const network = ALCHEMY_NETWORKS[chainId];
  if (!network) throw new Error("network is not supported by Alchemy NFT API");

  const nfts = new Map<string, WalletNft>();
  let pageKey: string | null = null;
  const seen=new Set<string>();
  let complete=false;
  let warning="";
  try {
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ owner: address, withMetadata: "true", pageSize: "100" });
    if (pageKey) params.set("pageKey", pageKey);
    const response = await fetchNftProvider(`https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?${params}`);
    if (!response.ok) throw new Error(`Alchemy returned ${response.status}`);
    const payload = (await response.json()) as AlchemyPage;
    if(!Array.isArray(payload.ownedNfts))throw new Error("Invalid Alchemy NFT response");
    for (const item of payload.ownedNfts ?? []) {
      const contractAddress = item.contract?.address;
      if (!contractAddress || item.tokenId === undefined) continue;
      const tokenId = item.tokenId.startsWith("0x") ? BigInt(item.tokenId).toString() : String(item.tokenId);
      const key = `${contractAddress.toLowerCase()}:${tokenId}`;
      const source = mediaUrl(item.image?.cachedUrl ?? item.image?.pngUrl ?? item.image?.thumbnailUrl ?? item.image?.originalUrl ?? item.raw?.metadata?.image);
      nfts.set(key, {
        contractAddress,
        tokenId,
        tokenType: item.tokenType ?? "ERC-721",
        quantity: item.balance ?? "1",
        name: item.name ?? null,
        collection: item.contract?.name ?? item.contract?.symbol ?? null,
        imageUrl: marketplaceImageUrl(source, chainId, contractAddress, tokenId),
        description: item.description ?? null,
        externalUrl: mediaUrl(item.raw?.metadata?.external_url),
        explorerUrl: tokenUrl(chainId, contractAddress, tokenId),
        chainId,
        traits: (item.raw?.metadata?.attributes ?? []).flatMap((attribute) =>
          attribute.trait_type && attribute.value !== null && attribute.value !== undefined
            ? [{ type: attribute.trait_type, value: String(attribute.value) }]
            : [],
        ),
      });
    }
    pageKey = payload.pageKey ?? null;
    if (!pageKey) {complete=true;break;}
    if(seen.has(pageKey))throw new Error("Alchemy repeated its pagination cursor");
    seen.add(pageKey);
  }
  } catch(error) { warning=error instanceof Error?error.message:"Alchemy pagination interrupted"; }
  return {nfts:[...nfts.values()],complete,warning:complete?"":warning||"Alchemy pagination limit reached; some holdings may be missing."};
}

type RpcLog = { address?: string; topics?: string[] };
type RpcResponse<T> = { result?: T; error?: { message?: string } };

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC returned ${response.status}`);
  const payload = (await response.json()) as RpcResponse<T>;
  if (payload.error) throw new Error(payload.error.message ?? "RPC request failed");
  if (payload.result === undefined) throw new Error("RPC returned no result");
  return payload.result;
}

async function fetchRecentErc721FromRpc(chainId: MarketplaceChainId, address: string, rpcUrl: string, scanBlocks: number) {
  const latestHex = await rpcRequest<string>(rpcUrl, "eth_blockNumber", []);
  const latest = Number(BigInt(latestHex));
  const first = Math.max(0, latest - scanBlocks);
  const ownerTopic = `0x${address.toLowerCase().slice(2).padStart(64, "0")}`;
  const chunkSize = 100_000;
  const ranges: Array<[number, number]> = [];
  for (let from = first; from <= latest; from += chunkSize) ranges.push([from, Math.min(latest, from + chunkSize - 1)]);

  const logs: RpcLog[] = [];
  let successfulRanges = 0;
  // Limit concurrency to avoid overwhelming the official public endpoint.
  for (let index = 0; index < ranges.length; index += 4) {
    const batch = ranges.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(([from, to]) => rpcRequest<RpcLog[]>(rpcUrl, "eth_getLogs", [{
      fromBlock: `0x${from.toString(16)}`,
      toBlock: `0x${to.toString(16)}`,
      topics: [ERC721_TRANSFER_TOPIC, null, ownerTopic],
    }])));
    for (const result of results) if (result.status === "fulfilled") { successfulRanges += 1; logs.push(...result.value); }
  }
  if (successfulRanges === 0) throw new Error("RPC rejected every transfer-log range");

  const candidates = new Map<string, { contractAddress: string; tokenId: string }>();
  for (const log of logs) {
    if (!log.address || log.topics?.length !== 4) continue; // ERC-20 transfers have only three topics.
    const tokenId = BigInt(log.topics[3]).toString();
    candidates.set(`${log.address.toLowerCase()}:${tokenId}`, { contractAddress: log.address, tokenId });
  }

  const owned: WalletNft[] = [];
  const entries = [...candidates.values()];
  for (let index = 0; index < entries.length; index += 12) {
    const batch = entries.slice(index, index + 12);
    const ownership = await Promise.allSettled(batch.map(async (candidate) => {
      const data = encodeFunctionData({ abi: ownerOfAbi, functionName: "ownerOf", args: [BigInt(candidate.tokenId)] });
      const result = await rpcRequest<string>(rpcUrl, "eth_call", [{ to: candidate.contractAddress, data }, "latest"]);
      const currentOwner = `0x${result.slice(-40)}`;
      return currentOwner.toLowerCase() === address.toLowerCase() ? candidate : null;
    }));
    for (const result of ownership) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { contractAddress, tokenId } = result.value;
      owned.push({
        contractAddress,
        tokenId,
        tokenType: "ERC-721",
        quantity: "1",
        name: null,
        collection: null,
        imageUrl: metadataImageFallback(chainId, contractAddress, tokenId),
        description: null,
        externalUrl: null,
        explorerUrl: tokenUrl(chainId, contractAddress, tokenId),
        chainId,
        traits: [],
      });
    }
  }
  return owned;
}

export async function GET(request: Request) {
  const query=new URL(request.url).searchParams;
  const owner = query.get("owner");
  const requestedChainId = Number(query.get("chainId") ?? 109);
  if (!owner) return Response.json({ error: "A wallet address is required." }, { status: 400 });
  if (!isMarketplaceChainId(requestedChainId)) {
    return Response.json({ error: "Unsupported chain." }, { status: 400 });
  }

  let address: string;
  try {
    address = getAddress(owner);
  } catch {
    return Response.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const chainId: MarketplaceChainId = requestedChainId;
  const chain = getMarketplaceChain(chainId);
  const warnings: string[] = [];
  const runtime = env as unknown as Record<string, string | undefined>;
  const holdings = new Map<string, WalletNft>();
  const sources: string[] = [];
  let providerSucceeded = false;

  if (runtime.ALCHEMY_API_KEY && ALCHEMY_NETWORKS[chainId]) {
    try {
      const {nfts,complete,warning} = await fetchFromAlchemy(address, chainId, runtime.ALCHEMY_API_KEY);
      providerSucceeded ||= complete;
      if(warning)warnings.push(warning);
      mergeNfts(holdings, nfts);
      sources.push("alchemy");
      if (complete) {
        return Response.json(
          { owner: address, chainId, nfts, complete:true, source: "alchemy", explorerAddressUrl: `${chain.explorerUrl}/address/${address}`, warnings },
          { headers: { "Cache-Control": "private, max-age=30" } },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown Alchemy error";
      warnings.push(`Alchemy: ${message}`);
    }
  }

  for (const candidate of explorerCandidates(chainId)) {
    try {
      const {nfts,complete,warning} = await fetchFromExplorer(candidate.url, candidate.apiKey, address, chainId);
      providerSucceeded ||= complete;
      if(warning)warnings.push(warning);
      mergeNfts(holdings, nfts);
      sources.push(candidate.url);
      // A second explorer generally mirrors the first; continue only when the
      // first one returned no holdings at all.
      if (complete) break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown explorer error";
      warnings.push(`${candidate.url}: ${message}`);
    }
  }

  const providerSetupWarning=!providerSucceeded&&chainId===25&&!runtime.CRONOS_EXPLORER_API_URL&&!runtime.BLOCKSCOUT_API_KEY
    ?"Cronos needs a server-side BLOCKSCOUT_API_KEY or compatible CRONOS_EXPLORER_API_URL for complete ERC-721 and ERC-1155 holdings."
    :!providerSucceeded&&chainId===7777777&&!runtime.ALCHEMY_API_KEY
      ?"Zora needs a server-side ALCHEMY_API_KEY for complete wallet NFT holdings; its configured explorer does not provide the required NFT endpoint."
      :null;
  if(providerSetupWarning)warnings.push(providerSetupWarning);

  if (!providerSucceeded && holdings.size === 0) {
    try {
      const configuredBlocks = Number(runtime[`${chain.slug.toUpperCase()}_RPC_SCAN_BLOCKS`] ?? (chainId === 109 ? 5_000_000 : 500_000));
      const scanBlocks = Math.min(5_000_000, Math.max(100_000, Number.isFinite(configuredBlocks) ? configuredBlocks : 500_000));
      const nfts = await fetchRecentErc721FromRpc(chainId, address, runtime[`${chain.slug.toUpperCase()}_RPC_URL`] ?? chain.rpcUrl, scanBlocks);
      mergeNfts(holdings, nfts);
      sources.push(`${chain.slug}-rpc-recent`);
      warnings.push(`${chain.name} RPC scans only the latest ${scanBlocks.toLocaleString("en-US")} blocks; older holdings may require an indexed explorer.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown RPC error";
      warnings.push(`${chain.name} RPC: ${message}`);
    }
  }

  if (providerSucceeded || holdings.size>0) {
    return Response.json(
      { owner: address, chainId, nfts: [...holdings.values()], complete:providerSucceeded, source: sources.join(", "), explorerAddressUrl: `${chain.explorerUrl}/address/${address}`, warnings },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  }

  return Response.json(
    {
      owner: address,
      chainId,
      nfts: [],
      explorerAddressUrl: `${chain.explorerUrl}/address/${address}`,
      warnings,
      error: providerSetupWarning??(sources.length
        ? `Could not verify complete wallet holdings on ${chain.name}; the available RPC scan is limited to recent blocks.`
        : `Could not verify wallet NFTs on ${chain.name}; all configured providers failed.`),
    },
    { status: 502 },
  );
}
