import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http, type Address } from "viem";
import { getMarketplaceChain, isMarketplaceChainId } from "@/lib/marketplace-chains";
import { env } from "@runtime-env";

export const dynamic = "force-dynamic";

const CACHE_SECONDS = 60 * 60 * 24;
const ALCHEMY_NETWORKS: Partial<Record<number, string>> = {
  1: "eth-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  4663: "robinhood-mainnet",
  33139: "apechain-mainnet",
  7777777: "zora-mainnet",
};
const tokenUriAbi = [{
  type: "function",
  name: "tokenURI",
  stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }],
  outputs: [{ name: "", type: "string" }],
}] as const;
const uriAbi = [{
  type: "function",
  name: "uri",
  stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }],
  outputs: [{ name: "", type: "string" }],
}] as const;

function gatewayUrl(value: string, tokenId?: string) {
  let normalized = value.trim();
  if (tokenId && normalized.includes("{id}")) {
    normalized = normalized.replaceAll("{id}", BigInt(tokenId).toString(16).padStart(64, "0"));
  }
  if (normalized.startsWith("ipfs://ipfs/")) return `https://ipfs.io/ipfs/${normalized.slice(12)}`;
  if (normalized.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${normalized.slice(7)}`;
  if (normalized.startsWith("ar://")) return `https://arweave.net/${normalized.slice(5)}`;
  return normalized;
}

function decodeDataJson(value: string) {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("Invalid data URI");
  const header = value.slice(0, comma);
  const body = value.slice(comma + 1);
  const json = header.includes(";base64")
    ? Buffer.from(body, "base64").toString("utf8")
    : decodeURIComponent(body);
  return JSON.parse(json) as { image?: string; image_url?: string; image_data?: string };
}

function safeRemoteUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Only HTTPS metadata is supported");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1") {
    throw new Error("Private metadata host rejected");
  }
  return url;
}

async function fetchWithTimeout(url: URL, refresh = false) {
  return fetch(url, {
    headers: { accept: "application/json,image/*,*/*;q=0.8" },
    signal: AbortSignal.timeout(12_000),
    ...(refresh ? {cache: "no-store" as const} : {next: {revalidate: CACHE_SECONDS}}),
  });
}

function remoteCandidates(value: string, tokenId?: string) {
  const normalized = gatewayUrl(value, tokenId);
  const candidates = [normalized];
  try {
    const parsed = new URL(normalized);
    const marker = "/ipfs/";
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      const path = parsed.pathname.slice(index + marker.length);
      candidates.push(
        `https://ipfs.io/ipfs/${path}`,
        `https://cloudflare-ipfs.com/ipfs/${path}`,
        `https://gateway.pinata.cloud/ipfs/${path}`,
      );
    }
  } catch {
    // Validation happens below; keep the original value for the useful error.
  }
  return [...new Set(candidates)].map(safeRemoteUrl);
}

async function fetchFirstRemote(value: string, tokenId?: string, refresh = false) {
  let lastStatus = 0;
  for (const candidate of remoteCandidates(value, tokenId)) {
    try {
      const response = await fetchWithTimeout(candidate, refresh);
      if (response.ok) return response;
      lastStatus = response.status;
    } catch {
      // Continue to the next public gateway.
    }
  }
  throw new Error(`Remote asset returned ${lastStatus || "no response"}`);
}

async function fetchFirstImage(value: string, tokenId?: string, refresh = false) {
  let lastStatus = 0;
  for (const candidate of remoteCandidates(value, tokenId)) {
    try {
      const response = await fetchWithTimeout(candidate, refresh);
      if (!response.ok) { lastStatus = response.status; continue; }
      const type = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream") && !type.startsWith("binary/octet-stream")) {
        lastStatus = 415;
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch {
      // Try another gateway when the image host times out or returns HTML.
    }
  }
  throw new Error(`Image asset returned ${lastStatus || "no response"}`);
}

async function fetchAlchemyImage(chainId: number, contract: Address, tokenId: string, refresh = false) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const apiKey = runtime.ALCHEMY_API_KEY;
  const network = ALCHEMY_NETWORKS[chainId];
  if (!apiKey || !network) throw new Error("Alchemy image fallback is unavailable");
  const params = new URLSearchParams({ contractAddress: contract, tokenId, refreshCache: String(refresh) });
  const response = await fetch(`https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    ...(refresh ? {cache: "no-store" as const} : {next: {revalidate: CACHE_SECONDS}}),
  });
  if (!response.ok) throw new Error(`Alchemy metadata returned ${response.status}`);
  const metadata = await response.json() as {
    image?: { cachedUrl?: string | null; pngUrl?: string | null; thumbnailUrl?: string | null; originalUrl?: string | null };
    raw?: { metadata?: { image?: string | null; image_url?: string | null } };
  };
  const image = metadata.image?.cachedUrl ?? metadata.image?.pngUrl ?? metadata.image?.thumbnailUrl ?? metadata.image?.originalUrl ?? metadata.raw?.metadata?.image ?? metadata.raw?.metadata?.image_url;
  if (!image) throw new Error("Alchemy metadata has no image");
  return fetchFirstImage(image, tokenId, refresh);
}

async function contractMetadataUri(chainId: number, contract: Address, tokenId: bigint) {
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const rpcUrl = runtime[`${chain.slug.toUpperCase()}_RPC_URL`] ?? chain.rpcUrl;
  const client = createPublicClient({ transport: http(rpcUrl) });
  try {
    return await client.readContract({ address: contract, abi: tokenUriAbi, functionName: "tokenURI", args: [tokenId] });
  } catch {
    return client.readContract({ address: contract, abi: uriAbi, functionName: "uri", args: [tokenId] });
  }
}

async function fetchExplorerImage(chainId: number, contract: Address, tokenId: string, refresh = false) {
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const apiUrl = runtime[`${chain.slug.toUpperCase()}_EXPLORER_API_URL`] ?? chain.explorerApiUrl;
  const response = await fetch(`${apiUrl}/tokens/${contract}/instances/${tokenId}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Explorer metadata returned ${response.status}`);
  const item = await response.json() as {
    image_url?: string | null;
    media_url?: string | null;
    thumbnails?: { image_url?: string | null; image?: string | null } | null;
    metadata?: { image?: string | null; image_url?: string | null; image_data?: string | null } | null;
  };
  const sources = [item.image_url, item.thumbnails?.image_url, item.thumbnails?.image, item.metadata?.image_url, item.metadata?.image, item.metadata?.image_data, item.media_url].filter((source): source is string => !!source);
  for (const source of sources) {
    try {
      if (source.startsWith("data:image/")) return inlineImage(source);
      if (source.trimStart().startsWith("<svg")) {
        return new NextResponse(source, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
      }
      const image = await fetchFirstImage(source, tokenId, refresh);
      return new NextResponse(image.body, {
        headers: { "Content-Type": image.headers.get("content-type") ?? "image/jpeg", "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
      });
    } catch {
      // An explorer can return a stale image URL next to a working thumbnail.
    }
  }
  throw new Error("Explorer metadata has no usable image");
}

function inlineImage(value: string) {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("Invalid image data URI");
  const header = value.slice(5, comma);
  const mime = header.split(";")[0] || "image/svg+xml";
  const body = value.slice(comma + 1);
  const bytes = header.includes(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
  return new NextResponse(bytes, { headers: { "Content-Type": mime, "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
}

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.has("refresh");
  const requestedChainId = Number(request.nextUrl.searchParams.get("chainId"));
  const requestedContract = request.nextUrl.searchParams.get("contract");
  const requestedTokenId = request.nextUrl.searchParams.get("tokenId");
  const requestedSource = request.nextUrl.searchParams.get("source");
  if (!isMarketplaceChainId(requestedChainId) || !requestedContract || !requestedTokenId || !/^\d+$/.test(requestedTokenId)) {
    return NextResponse.json({ error: "Invalid NFT image request." }, { status: 400 });
  }

  let contract: Address;
  try {
    contract = getAddress(requestedContract);
  } catch {
    return NextResponse.json({ error: "Invalid NFT contract." }, { status: 400 });
  }

  try {
    if (requestedSource) {
      if (requestedSource.startsWith("data:image/")) return inlineImage(requestedSource);
      try {
        const sourceResponse = await fetchFirstImage(requestedSource, requestedTokenId, refresh);
        return new NextResponse(sourceResponse.body, {
          headers: {
            "Content-Type": sourceResponse.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
          },
        });
      } catch {
        // If every supplied image gateway fails, resolve tokenURI onchain below.
      }
    }
    const metadataUri = gatewayUrl(await contractMetadataUri(requestedChainId, contract, BigInt(requestedTokenId)), requestedTokenId);
    let metadata: { image?: string; image_url?: string; image_data?: string };
    let metadataBase: URL | null = null;
    if (metadataUri.startsWith("data:application/json")) {
      metadata = decodeDataJson(metadataUri);
    } else {
      metadataBase = safeRemoteUrl(metadataUri);
      const response = await fetchFirstRemote(metadataBase.toString(), requestedTokenId, refresh);
      metadata = await response.json() as typeof metadata;
    }

    const rawImage = metadata.image ?? metadata.image_url ?? metadata.image_data;
    if (!rawImage) throw new Error("NFT metadata has no image");
    if (rawImage.startsWith("data:image/")) return inlineImage(rawImage);
    if (rawImage.trimStart().startsWith("<svg")) {
      return new NextResponse(rawImage, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": `public, max-age=${CACHE_SECONDS}` } });
    }

    const normalizedImage = gatewayUrl(rawImage, requestedTokenId);
    const imageUrl = metadataBase && !/^https?:\/\//i.test(normalizedImage)
      ? safeRemoteUrl(new URL(normalizedImage, metadataBase).toString())
      : safeRemoteUrl(normalizedImage);
    const imageResponse = await fetchFirstImage(imageUrl.toString(), requestedTokenId, refresh);
    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(imageResponse.body, {
      headers: { "Content-Type": contentType, "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
    });
  } catch {
    try {
      return await fetchExplorerImage(requestedChainId, contract, requestedTokenId, refresh);
    } catch {
      // Some explorers omit NFT media; try Alchemy where supported.
    }
    try {
      const fallback = await fetchAlchemyImage(requestedChainId, contract, requestedTokenId, refresh);
      return new NextResponse(fallback.body, {
        headers: {
          "Content-Type": fallback.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        },
      });
    } catch {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
    }
  }
}
