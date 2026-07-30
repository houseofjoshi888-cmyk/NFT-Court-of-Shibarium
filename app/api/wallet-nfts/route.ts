import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { getMarketplaceChain, isMarketplaceChainId } from "@/lib/marketplace-chains";
import { env } from "@runtime-env";

export const dynamic = "force-dynamic";

const MAX_PAGES = 20;
const PAGE_SIZE = 50;

type ExplorerNft = {
  id?: string;
  value?: string | null;
  token_type?: string | null;
  image_url?: string | null;
  metadata?: { name?: string | null; image?: string | null; image_url?: string | null; description?: string | null; external_url?: string | null; attributes?: Array<{ trait_type?: string | null; value?: string | number | boolean | null }> | null } | null;
  token?: { address_hash?: string; name?: string | null; symbol?: string | null } | null;
};

type ExplorerPage = {
  items?: ExplorerNft[];
  next_page_params?: Record<string, string | number | null> | null;
};

function imageUrl(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${value.slice(7)}` : value;
}

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  const chainId = Number(request.nextUrl.searchParams.get("chainId") ?? 109);
  if (!owner) return NextResponse.json({ error: "A wallet address is required." }, { status: 400 });
  if (!isMarketplaceChainId(chainId)) return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const explorerApiUrl = runtime[`${chain.slug.toUpperCase()}_EXPLORER_API_URL`] ?? chain.explorerApiUrl;

  let address: string;
  try {
    address = getAddress(owner);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const nfts = new Map<string, { contractAddress: string; tokenId: string; tokenType: string; quantity: string; name: string | null; collection: string | null; imageUrl: string | null; description: string | null; externalUrl: string | null; traits: Array<{ type: string; value: string }> }>();
  let pageParams: Record<string, string | number | null> | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ type: "ERC-721,ERC-1155", items_count: String(PAGE_SIZE) });
      for (const [key, value] of Object.entries(pageParams ?? {})) if (value !== null) params.set(key, String(value));
      const response = await fetch(`${explorerApiUrl}/addresses/${address}/nft?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 30 },
      });
      if (!response.ok) throw new Error(`${chain.name} explorer returned ${response.status}`);
      const payload = await response.json() as ExplorerPage;
      for (const item of payload.items ?? []) {
        const contractAddress = item.token?.address_hash;
        if (!contractAddress || item.id === undefined) continue;
        const key = `${contractAddress.toLowerCase()}:${item.id}`;
        nfts.set(key, {
          contractAddress,
          tokenId: item.id,
          tokenType: item.token_type ?? "ERC-721",
          quantity: item.value ?? "1",
          name: item.metadata?.name ?? null,
          collection: item.token?.name ?? item.token?.symbol ?? null,
          imageUrl: imageUrl(item.image_url ?? item.metadata?.image_url ?? item.metadata?.image),
          description: item.metadata?.description ?? null,
          externalUrl: item.metadata?.external_url ?? null,
          traits: (item.metadata?.attributes ?? []).flatMap(attribute => attribute.trait_type && attribute.value !== null && attribute.value !== undefined ? [{ type: attribute.trait_type, value: String(attribute.value) }] : []),
        });
      }
      pageParams = payload.next_page_params ?? null;
      if (!pageParams) break;
    }
  } catch {
    return NextResponse.json({ error: `Could not load wallet NFTs from the ${chain.name} explorer.` }, { status: 502 });
  }

  return NextResponse.json({ owner: address, chainId, nfts: [...nfts.values()] }, { headers: { "Cache-Control": "private, max-age=30" } });
}
