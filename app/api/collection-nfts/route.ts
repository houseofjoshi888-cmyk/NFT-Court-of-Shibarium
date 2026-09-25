import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { getMarketplaceChain, isMarketplaceChainId } from "@/lib/marketplace-chains";
import { env } from "@runtime-env";

export const dynamic = "force-dynamic";

type Instance = { id?: string; image_url?: string | null; metadata?: { name?: string | null; image?: string | null; image_url?: string | null } | null };

export async function GET(request: NextRequest) {
  const chainId = Number(request.nextUrl.searchParams.get("chainId"));
  const rawContract = request.nextUrl.searchParams.get("contract");
  if (!isMarketplaceChainId(chainId) || !rawContract) return NextResponse.json({ error: "Invalid collection." }, { status: 400 });
  let contract: string;
  try { contract = getAddress(rawContract); } catch { return NextResponse.json({ error: "Invalid collection." }, { status: 400 }); }
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const api = runtime[`${chain.slug.toUpperCase()}_EXPLORER_API_URL`] ?? chain.explorerApiUrl;
  if (!api) return NextResponse.json({ items: [] });
  try {
    const response = await fetch(`${api}/tokens/${contract}/instances`, {
      headers: { accept: "application/json", ...(runtime.BLOCKSCOUT_API_KEY ? { "x-api-key": runtime.BLOCKSCOUT_API_KEY } : {}) },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 120 },
    });
    if (!response.ok) throw new Error("Collection lookup failed");
    const body = await response.json() as { items?: Instance[] };
    const items = (body.items ?? []).filter(item => typeof item.id === "string" && /^\d+$/.test(item.id)).slice(0, 24).map(item => ({
      tokenId: item.id!,
      name: item.metadata?.name ?? `Token #${item.id}`,
      imageUrl: `/api/nft-image?${new URLSearchParams({ chainId: String(chainId), contract, tokenId: item.id! })}`,
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
