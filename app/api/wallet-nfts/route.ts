import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

const EXPLORER_API = "https://shibariumscan.io/api/v2";
const MAX_PAGES = 4;
const PAGE_SIZE = 50;

type ExplorerNft = {
  id?: string;
  image_url?: string | null;
  metadata?: { name?: string | null; image?: string | null } | null;
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
  if (!owner) return NextResponse.json({ error: "A wallet address is required." }, { status: 400 });

  let address: string;
  try {
    address = getAddress(owner);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const nfts: Array<{ contractAddress: string; tokenId: string; name: string | null; collection: string | null; imageUrl: string | null }> = [];
  let pageParams: Record<string, string | number | null> | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ token_type: "ERC-721", items_count: String(PAGE_SIZE) });
      for (const [key, value] of Object.entries(pageParams ?? {})) if (value !== null) params.set(key, String(value));
      const response = await fetch(`${EXPLORER_API}/addresses/${address}/nft?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 30 },
      });
      if (!response.ok) throw new Error(`ShibariumScan returned ${response.status}`);
      const payload = await response.json() as ExplorerPage;
      for (const item of payload.items ?? []) {
        const contractAddress = item.token?.address_hash;
        if (!contractAddress || item.id === undefined) continue;
        nfts.push({
          contractAddress,
          tokenId: item.id,
          name: item.metadata?.name ?? null,
          collection: item.token?.name ?? item.token?.symbol ?? null,
          imageUrl: imageUrl(item.image_url ?? item.metadata?.image),
        });
      }
      pageParams = payload.next_page_params ?? null;
      if (!pageParams) break;
    }
  } catch {
    return NextResponse.json({ error: "Could not load wallet NFTs from ShibariumScan." }, { status: 502 });
  }

  return NextResponse.json({ owner: address, nfts }, { headers: { "Cache-Control": "private, max-age=30" } });
}
