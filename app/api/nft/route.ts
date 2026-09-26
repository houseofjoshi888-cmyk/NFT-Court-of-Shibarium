import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http } from "viem";
import { getMarketplaceChain, isMarketplaceChainId } from "@/lib/marketplace-chains";
import { env } from "@runtime-env";
import { SHIB_MAGAZINE_CONTRACT } from "@/lib/shib-magazine-cover";

export const dynamic = "force-dynamic";

type ExplorerNft = {
  id?: string;
  image_url?: string | null;
  external_app_url?: string | null;
  metadata?: { name?: string | null; image?: string | null; image_url?: string | null; image_data?: string | null; description?: string | null; external_url?: string | null; attributes?: Array<{ trait_type?: string | null; value?: string | number | boolean | null }> | null } | null;
  token?: { address_hash?: string; name?: string | null; symbol?: string | null } | null;
};

const ALCHEMY_NETWORKS: Partial<Record<number, string>> = {
  1: "eth-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  4663: "robinhood-mainnet",
  33139: "apechain-mainnet",
  7777777: "zora-mainnet",
};

async function alchemyMetadata(chainId: number, contract: string, tokenId: string, apiKey: string, refresh = false) {
  const network = ALCHEMY_NETWORKS[chainId];
  if (!network) throw new Error("Alchemy NFT metadata is unavailable for this chain");
  const params = new URLSearchParams({ contractAddress: contract, tokenId, refreshCache: String(refresh) });
  const response = await fetch(`https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    ...(refresh ? {cache: "no-store" as const} : {next: {revalidate: 60}}),
  });
  if (!response.ok) throw new Error(`Alchemy metadata returned ${response.status}`);
  return response.json() as Promise<{
    name?: string | null;
    description?: string | null;
    image?: { cachedUrl?: string | null; pngUrl?: string | null; thumbnailUrl?: string | null; originalUrl?: string | null };
    contract?: { name?: string | null; symbol?: string | null };
    raw?: { metadata?: { image?: string | null; image_url?: string | null; image_data?: string | null; external_url?: string | null; attributes?: Array<{ trait_type?: string | null; value?: string | number | boolean | null }> | null } };
  }>;
}

function imageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("ipfs://ipfs/")) return `https://ipfs.io/ipfs/${value.slice(12)}`;
  if (value.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if (value.startsWith("ar://")) return `https://arweave.net/${value.slice(5)}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  if (value.trimStart().startsWith("<svg")) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  return value;
}

function marketplaceImageUrl(source: string | null, chainId: number, contract: string, tokenId: string, refresh = false) {
  if (source?.startsWith("data:")) return source;
  const params = new URLSearchParams({ chainId: String(chainId), contract, tokenId });
  if (source) params.set("source", source);
  if (refresh) params.set("refresh", String(Date.now()));
  return `/api/nft-image?${params}`;
}

const tokenUriAbi = [
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "uri", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
] as const;

async function onchainMetadata(chainId: number, contract: `0x${string}`, tokenId: string, refresh: boolean) {
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const client = createPublicClient({ transport: http(runtime[`${chain.slug.toUpperCase()}_RPC_URL`] ?? chain.rpcUrl, { timeout: 8_000 }) });
  let uri: string;
  try { uri = await client.readContract({ address: contract, abi: tokenUriAbi, functionName: "tokenURI", args: [BigInt(tokenId)] }); }
  catch { uri = await client.readContract({ address: contract, abi: tokenUriAbi, functionName: "uri", args: [BigInt(tokenId)] }); }
  uri = uri.replaceAll("{id}", BigInt(tokenId).toString(16).padStart(64, "0"));
  if (uri.startsWith("data:application/json")) {
    const comma = uri.indexOf(",");
    if (comma < 0) throw new Error("Invalid inline metadata");
    const body = uri.slice(comma + 1);
    return JSON.parse(uri.slice(0, comma).includes(";base64") ? Buffer.from(body, "base64").toString("utf8") : decodeURIComponent(body)) as ExplorerNft["metadata"];
  }
  const url = new URL(imageUrl(uri) ?? uri);
  if (url.protocol !== "https:" || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) || url.hostname.endsWith(".local")) throw new Error("Invalid metadata host");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 } }) });
  if (!response.ok) throw new Error(`On-chain metadata returned ${response.status}`);
  return response.json() as Promise<ExplorerNft["metadata"]>;
}

async function onchainMetadataResponse(chainId: number, contract: `0x${string}`, tokenId: string, refresh: boolean) {
  const metadata = await onchainMetadata(chainId, contract, tokenId, refresh);
  if (!metadata) throw new Error("On-chain metadata is empty");
  return NextResponse.json({
    contractAddress: contract, chainId, tokenId,
    name: metadata.name ?? null, collection: null,
    imageUrl: marketplaceImageUrl(imageUrl(metadata.image ?? metadata.image_url ?? metadata.image_data), chainId, contract, tokenId, refresh),
    description: metadata.description ?? null,
    externalUrl: imageUrl(metadata.external_url),
    traits: (metadata.attributes ?? []).flatMap(attribute => attribute.trait_type && attribute.value !== null && attribute.value !== undefined ? [{ type: attribute.trait_type, value: String(attribute.value) }] : []),
  }, { headers: { "Cache-Control": refresh ? "no-store" : "public, max-age=60" } });
}

export async function GET(request: NextRequest) {
  const contract = request.nextUrl.searchParams.get("contract");
  const tokenId = request.nextUrl.searchParams.get("tokenId");
  const chainId = Number(request.nextUrl.searchParams.get("chainId") ?? 109);
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (!contract || !tokenId || !/^\d+$/.test(tokenId)) return NextResponse.json({ error: "A valid NFT contract and token ID are required." }, { status: 400 });
  if (!isMarketplaceChainId(chainId)) return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const explorerApiUrl = runtime[`${chain.slug.toUpperCase()}_EXPLORER_API_URL`] ?? chain.explorerApiUrl;

  let address: string;
  try { address = getAddress(contract); } catch { return NextResponse.json({ error: "Invalid NFT contract address." }, { status: 400 }); }

  if (chainId === 109 && address.toLowerCase() === SHIB_MAGAZINE_CONTRACT) {
    try { return await onchainMetadataResponse(chainId, address as `0x${string}`, tokenId, refresh); }
    catch { /* Publisher metadata can be unavailable; try the explorer next. */ }
  }

  try {
    const instanceUrl = `${explorerApiUrl}/tokens/${address}/instances/${tokenId}`;
    if (refresh) {
      // Blockscout-compatible explorers can queue an on-chain tokenURI re-fetch here.
      // Some deployments protect or omit this endpoint, so a rejected queue request
      // must not prevent the uncached metadata read that follows.
      await fetch(`${instanceUrl}/refetch-metadata`, {
        method: "POST",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    }
    const response = await fetch(instanceUrl, refresh
      ? { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" }
      : { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000), next: { revalidate: 60 } });
    if (!response.ok) throw new Error("Explorer request failed");
    const item = await response.json() as ExplorerNft;
    const sourceImage = imageUrl(item.metadata?.image ?? item.metadata?.image_url ?? item.metadata?.image_data ?? item.image_url);
    return NextResponse.json({
      contractAddress: address,
      chainId,
      tokenId,
      name: item.metadata?.name ?? null,
      collection: item.token?.name ?? item.token?.symbol ?? null,
      imageUrl: marketplaceImageUrl(sourceImage, chainId, address, tokenId, refresh),
      description: item.metadata?.description ?? null,
      externalUrl: imageUrl(item.metadata?.external_url ?? item.external_app_url),
      traits: (item.metadata?.attributes ?? []).flatMap(attribute => attribute.trait_type && attribute.value !== null && attribute.value !== undefined ? [{ type: attribute.trait_type, value: String(attribute.value) }] : []),
    }, { headers: { "Cache-Control": refresh ? "no-store" : "public, max-age=60" } });
  } catch {
    try {
      return await onchainMetadataResponse(chainId, address as `0x${string}`, tokenId, refresh);
    } catch {
      // Keep trying indexer metadata when a publisher's URI host is unavailable.
    }
    if (runtime.ALCHEMY_API_KEY && ALCHEMY_NETWORKS[chainId]) {
      try {
        const item = await alchemyMetadata(chainId, address, tokenId, runtime.ALCHEMY_API_KEY, refresh);
        const sourceImage = imageUrl(item.raw?.metadata?.image ?? item.raw?.metadata?.image_url ?? item.raw?.metadata?.image_data ?? item.image?.originalUrl ?? item.image?.cachedUrl ?? item.image?.pngUrl ?? item.image?.thumbnailUrl);
        return NextResponse.json({
          contractAddress: address,
          chainId,
          tokenId,
          name: item.name ?? null,
          collection: item.contract?.name ?? item.contract?.symbol ?? null,
          imageUrl: marketplaceImageUrl(sourceImage, chainId, address, tokenId, refresh),
          description: item.description ?? null,
          externalUrl: imageUrl(item.raw?.metadata?.external_url),
          traits: (item.raw?.metadata?.attributes ?? []).flatMap(attribute => attribute.trait_type && attribute.value !== null && attribute.value !== undefined ? [{ type: attribute.trait_type, value: String(attribute.value) }] : []),
        }, { headers: { "Cache-Control": refresh ? "no-store" : "public, max-age=60" } });
      } catch {
        // The image proxy still has on-chain and explorer fallbacks.
      }
    }
    return NextResponse.json({
      contractAddress: address,
      chainId,
      tokenId,
      name: null,
      collection: null,
      imageUrl: marketplaceImageUrl(null, chainId, address, tokenId, refresh),
      description: null,
      externalUrl: null,
      traits: [],
      metadataUnavailable: true,
    }, { headers: { "Cache-Control": "public, max-age=30" } });
  }
}
