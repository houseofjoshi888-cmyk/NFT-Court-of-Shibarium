"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, History } from "lucide-react";
import { formatEther } from "viem";
import { transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";
import type { PriceHistoryPoint } from "@/lib/nft-price-history";

type HistoryResponse = { points: PriceHistoryPoint[]; complete: boolean; warning: string | null };

export function NftPriceHistory({ chainId, contract, tokenId, currency, refreshKey }: {
  chainId: MarketplaceChainId;
  contract: string;
  tokenId: string;
  currency: string;
  refreshKey: number;
}) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams({ chainId: String(chainId), contract, tokenId });
    void fetch(`/api/nft-price-history?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json() as HistoryResponse;
        if (!response.ok && !body.warning) throw new Error("Price history is temporarily unavailable.");
        setData(body);
      })
      .catch(error => {
        if (!controller.signal.aborted) setData({ points: [], complete: false, warning: error instanceof Error ? error.message : "Price history is temporarily unavailable." });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [chainId, contract, tokenId, refreshKey]);

  const chart = useMemo(() => {
    const values = (data?.points ?? []).map(point => Number(formatEther(BigInt(point.price))));
    if (!values.length || values.some(value => !Number.isFinite(value))) return null;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || Math.max(max * 0.1, 0.000001);
    const coordinates = values.map((value, index) => ({
      x: values.length === 1 ? 300 : 24 + index * 552 / (values.length - 1),
      y: 154 - (value - min) * 128 / span,
    }));
    return { min, max, coordinates, path: coordinates.map(({x,y}, index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") };
  }, [data]);

  return <div className="royal-nft-panel royal-price-history-panel">
    <header><History size={16}/><span>Price history</span><small>HOJ marketplace</small></header>
    {loading ? <p>Loading verified marketplace prices…</p> : <>
      {data?.warning && <p role="status" className="royal-price-history-note">{data.warning}</p>}
      {data?.points.length ? <>
        <p className="royal-price-history-note">Listing prices are asking prices. Sale and accepted-offer amounts are transaction totals; an ERC-1155 sale may include multiple editions.</p>
        {chart && <div className="royal-price-history-chart" role="img" aria-label={`Recorded prices from ${chart.min} to ${chart.max} ${currency}`}>
          <svg viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
            <path d="M24 154 H576" className="royal-history-axis"/>
            <path d={chart.path} className="royal-history-line"/>
            {chart.coordinates.map((point, index) => <circle key={data.points[index].id} cx={point.x} cy={point.y} r="4" className="royal-history-dot"/>)}
          </svg>
          <div className="royal-price-history-range"><span>{chart.min.toLocaleString()} {currency}</span><span>{chart.max.toLocaleString()} {currency}</span></div>
        </div>}
        <div className="royal-price-history-list">
          {[...data.points].reverse().map(point => <a key={point.id} href={transactionUrl(chainId, point.transactionHash)} target="_blank" rel="noreferrer">
            <span>{point.eventType === "listed" ? "Listed" : point.eventType === "sold" ? "Sold" : "Offer accepted"}</span>
            <strong>{formatEther(BigInt(point.price))} {currency}</strong>
            <small>{point.timestamp ? new Date(point.timestamp * 1000).toLocaleDateString() : `Block ${point.blockNumber}`}</small>
            <ExternalLink size={13}/>
          </a>)}
        </div>
      </> : <p>No HOJ marketplace listing or sale prices have been recorded for this NFT yet.</p>}
    </>}
  </div>;
}
