import { env } from "@runtime-env";
import { isAddress } from "viem";
import { isMarketplaceChainId } from "@/lib/marketplace-chains";
import { loadMarketplaceIndex, type Activity } from "@/lib/marketplace-index";
import { toPriceHistoryPoints } from "@/lib/nft-price-history";
import { chainConfig, type RuntimeEnv } from "@/lib/server-marketplace-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const chainId = Number(query.get("chainId"));
  const contract = query.get("contract") ?? "";
  const tokenId = query.get("tokenId") ?? "";
  if (!isMarketplaceChainId(chainId) || !isAddress(contract, { strict: false }) || !/^\d+$/.test(tokenId) || BigInt(tokenId) > 2n ** 256n - 1n) {
    return Response.json({ error: "Provide a supported chain, NFT contract and token ID." }, { status: 400 });
  }
  const runtime = env as unknown as RuntimeEnv;
  const config = chainConfig(runtime, chainId);
  const base = { chainId, contract, tokenId, currency: config.chain.currency };
  if (config.chain.marketplaceStatus !== "live") {
    return Response.json({ ...base, points: [], complete: false, warning: `HOJ marketplace trading is coming soon on ${config.chain.name}.` });
  }
  if (!isAddress(config.address, { strict: false })) {
    return Response.json({ ...base, points: [], complete: false, warning: "The HOJ marketplace contract is not configured on this network." });
  }
  try {
    const index = await loadMarketplaceIndex(config, runtime.DB);
    let events: Activity[] = index.activity.filter(item => item.nftAddress?.toLowerCase() === contract.toLowerCase() && item.tokenId === String(BigInt(tokenId)));
    let hasMore = false;
    if (runtime.DB) {
      const scope = `marketplace:v3:${chainId}:${config.address.toLowerCase()}`;
      const result = await runtime.DB.batch([
        runtime.DB.prepare("SELECT id,chain_id AS chainId,event_type AS eventType,nft_address AS nftAddress,token_id AS tokenId,seller,buyer,price,transaction_hash AS transactionHash,block_number AS blockNumber,log_index AS logIndex,timestamp FROM marketplace_v3_activity WHERE scope=? AND lower(nft_address)=? AND token_id=? AND event_type IN ('listed','sold','offer_accepted') AND price IS NOT NULL ORDER BY block_number DESC,log_index DESC LIMIT 501").bind(scope, contract.toLowerCase(), String(BigInt(tokenId))),
      ]);
      hasMore = result[0].results.length > 500;
      events = result[0].results.slice(0, 500) as Activity[];
    }
    const complete = !!index.sync?.caughtUp && !index.syncError && !hasMore && !!runtime.DB;
    const warning = index.syncError ?? (hasMore ? "Showing the latest 500 price events for this NFT." : !index.sync?.caughtUp ? "Older marketplace events are still being indexed." : !runtime.DB ? "Only recent marketplace activity is available without a persistent index." : null);
    return Response.json({ ...base, points: toPriceHistoryPoints(events), complete, warning }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ...base, points: [], complete: false, warning: "Price history is temporarily unavailable. Please retry." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
