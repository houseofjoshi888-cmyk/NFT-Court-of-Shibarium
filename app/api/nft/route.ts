import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

type ExplorerNft = {
  id?: string;
  image_url?: string | null;
  metadata?: { name?: string | null; image?: string | null; description?: string | null; external_url?: string | null; attributes?: Array<{ trait_type?: string | null; value?: string | number | boolean | null }> | null } | null;
  token?: { address_hash?: string; name?: string | null; symbol?: string | null } | null;
};

function imageUrl(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${value.slice(7)}` : value;
}

export async function GET(request: NextRequest) {
  const contract = request.nextUrl.searchParams.get("contract");
  const tokenId = request.nextUrl.searchParams.get("tokenId");
  if (!contract || !tokenId || !/^\d+$/.test(tokenId)) return NextResponse.json({ error: "A valid NFT contract and token ID are required." }, { status: 400 });

  let address: string;
  try { address = getAddress(contract); } catch { return NextResponse.json({ error: "Invalid NFT contract address." }, { status: 400 }); }

  try {
    const response = await fetch(`https://shibariumscan.io/api/v2/tokens/${address}/instances/${tokenId}`, { headers: { accept: "application/json" }, next: { revalidate: 60 } });
    if (!response.ok) throw new Error("Explorer request failed");
    const item = await response.json() as ExplorerNft;
    return NextResponse.json({
      contractAddress: address,
      tokenId,
      name: item.metadata?.name ?? null,
      collection: item.token?.name ?? item.token?.symbol ?? null,
      imageUrl: imageUrl(item.image_url ?? item.metadata?.image),
      description: item.metadata?.description ?? null,
      externalUrl: item.metadata?.external_url ?? null,
      traits: (item.metadata?.attributes ?? []).flatMap(attribute => attribute.trait_type && attribute.value !== null && attribute.value !== undefined ? [{ type: attribute.trait_type, value: String(attribute.value) }] : []),
    }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Could not load NFT metadata from ShibariumScan." }, { status: 502 });
  }
}
