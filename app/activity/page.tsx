"use client";

import { Sparkles, Activity, Gift, ArrowRight, RefreshCw, Tag, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { sortActivity } from "@/lib/activity-sort";
import { formatEther } from "viem";

type IndexedActivity = {
  id: string;
  chainId: MarketplaceChainId;
  eventType: "listed" | "sold" | "canceled" | "withdrawn" | "mint" | "transfer" | "offer" | "airdrop" | "offer_accepted" | "offer_canceled";
  nftAddress: `0x${string}` | null;
  tokenId: string | null;
  seller: `0x${string}` | null;
  buyer: `0x${string}` | null;
  price: string | null;
  transactionHash: `0x${string}`;
  blockNumber: number;
  timestamp?: number;
  logIndex: number;
  collection?: string;
  from?: string;
  to?: string;
  quantity?: string;
};

type IndexerResponse = {
  activity: IndexedActivity[];
  configured?: boolean;
  syncError?: string | null;
};

export default function ActivityPage() {
  const [activity, setActivity] = useState<IndexedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "sale" | "mint" | "transfer" | "listing" | "offer" | "airdrop" | "canceled" | "withdrawn">("all");
  const [chainFilter, setChainFilter] = useState<"all" | MarketplaceChainId>("all");
  const [sortBy, setSortBy] = useState<"recent" | "price-high" | "price-low">("recent");

  useEffect(() => {
    async function loadActivity() {
      try {
        // Load Shibarium first for instant content
        const shibariumResponse = await fetch(`/api/indexer?chainId=109`, { cache: "no-store" });
        const shibariumData = shibariumResponse.ok ? await shibariumResponse.json() as IndexerResponse : null;
        
        if (shibariumData) {
          setActivity(shibariumData.activity || []);
          setLoading(false);
        }

        // Load other chains in background
        const otherChains = [1, 25, 137, 8453, 4663, 7777777, 33139] as MarketplaceChainId[];
        const otherResponses = await Promise.allSettled(
          otherChains.map(async chainId => {
            const res = await fetch(`/api/indexer?chainId=${chainId}`, { cache: "no-store" });
            return res.ok ? (await res.json()) as IndexerResponse : null;
          })
        );

        const allActivity: IndexedActivity[] = [...(shibariumData?.activity || [])];
        otherResponses.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            const data = result.value as IndexerResponse;
            allActivity.push(...(data.activity || []));
          }
        });

        setActivity(allActivity);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load activity:", error);
        setLoading(false);
      }
    }

    loadActivity();
  }, []);

  const filteredActivity = activity.filter(item => {
    if (chainFilter !== "all" && item.chainId !== chainFilter) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "sale") return item.eventType === "sold" || item.eventType === "offer_accepted";
    if (statusFilter === "listing") return item.eventType === "listed";
    if (statusFilter === "mint") return item.eventType === "mint";
    if (statusFilter === "transfer") return item.eventType === "transfer";
    if (statusFilter === "canceled") return item.eventType === "canceled";
    if (statusFilter === "withdrawn") return item.eventType === "withdrawn";
    if (statusFilter === "offer") return ["offer", "offer_canceled", "offer_accepted"].includes(item.eventType);
    if (statusFilter === "airdrop") return item.eventType === "airdrop";
    return true;
  });

  const sortedActivity = sortActivity(filteredActivity,sortBy,chainFilter);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "sold": return <TrendingUp size={16} />;
      case "listed": return <Tag size={16} />;
      case "mint": return <Sparkles size={16} />;
      case "transfer": return <ArrowRight size={16} />;
      case "offer": return <Gift size={16} />;
      case "airdrop": return <Activity size={16} />;
      default: return <RefreshCw size={16} />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "sold": return { color: "var(--royal-gold)" };
      case "listed": return { color: "var(--royal-gold)" };
      case "mint": return { color: "#22c55e" };
      case "transfer": return { color: "#3b82f6" };
      case "offer": return { color: "#a855f7" };
      case "airdrop": return { color: "#ec4899" };
      default: return { color: "var(--royal-light-gray)" };
    }
  };

  return (
    <main className="royal-page">
      <section className="royal-page-hero">
        <div className="royal-badge">
          <Activity size={16} />
          <span>Activity</span>
        </div>
        <h1>Marketplace Activity</h1>
        <p>Track the latest NFT transactions across all chains.</p>
      </section>

      <section className="royal-activity-filters">
        <div className="royal-filter-group">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All</option>
            <option value="sale">Sale</option>
            <option value="mint">Mint</option>
            <option value="transfer">Transfer</option><option value="canceled">Listing cancellation</option><option value="withdrawn">Withdrawal</option>
            <option value="listing">Listing</option>
            <option value="offer">Item Offer</option>
            <option value="airdrop">Airdrop</option>
          </select>
        </div>
        <div className="royal-filter-group">
          <span>{chainFilter==="all"?"Choose one chain to sort by price":"Price"}</span>
          <select value={chainFilter==="all"?"recent":sortBy} onChange={(e) => setSortBy(e.target.value as "recent" | "price-high" | "price-low")}>
            <option value="recent">Recent</option>
            <option disabled={chainFilter==="all"} value="price-high">Price: High to Low</option>
            <option disabled={chainFilter==="all"} value="price-low">Price: Low to High</option>
          </select>
        </div>
        <div className="royal-filter-group">
          <span>Chains</span>
          <select value={chainFilter} onChange={(e) => setChainFilter(e.target.value === "all" ? "all" : Number(e.target.value) as MarketplaceChainId)}>
            <option value="all">All Chains</option>
            {Object.entries(marketplaceChains).map(([id, chain]) => (
              <option key={id} value={id}>{chain.name}{chain.marketplaceStatus==="live"?"":" · Coming soon"}</option>
            ))}
          </select>
        </div>
        <div className="royal-filter-group">
          <span>Collections</span>
          <select>
            <option value="all">All Collections</option>
          </select>
        </div>
      </section>

      <section className="royal-activity-content">
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="royal-activity-table">
            <div className="royal-activity-header">
              <span>Event</span>
              <span>Item</span>
              <span>Price</span>
              <span>QTY</span>
              <span>Rarity</span>
              <span>From</span>
              <span>To</span>
              <span>Time</span>
            </div>
            {sortedActivity.length > 0 ? (
              sortedActivity.map((item) => {
                const chain = getMarketplaceChain(item.chainId);
                const price = item.price ? `${formatEther(BigInt(item.price))} ${chain.currency}` : "—";
                return (
                  <div key={item.id} className="royal-activity-row">
                    <div className="royal-activity-event">
                      <div className="royal-activity-icon" style={getEventColor(item.eventType)}>
                        {getEventIcon(item.eventType)}
                      </div>
                      <span className="royal-activity-type">{item.eventType.replaceAll("_"," ").toUpperCase()}</span>
                    </div>
                    <div className="royal-activity-item">
                      <strong>{item.collection || "Unknown Collection"}</strong>
                      <small>#{item.tokenId || "—"}</small>
                    </div>
                    <div className="royal-activity-price">
                      <strong>{price}</strong>
                    </div>
                    <div className="royal-activity-qty">
                      <span>{item.quantity || "1"}</span>
                    </div>
                    <div className="royal-activity-rarity">
                      <span>—</span>
                    </div>
                    <div className="royal-activity-from">
                      <span>{item.seller ? `${item.seller.slice(0, 6)}…${item.seller.slice(-4)}` : "—"}</span>
                    </div>
                    <div className="royal-activity-to">
                      <span>{item.buyer ? `${item.buyer.slice(0, 6)}…${item.buyer.slice(-4)}` : "—"}</span>
                    </div>
                    <div className="royal-activity-time">
                      <small>{item.timestamp?new Date(item.timestamp*1000).toLocaleString():"Time unavailable"}</small>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="royal-empty-state">
                <Activity size={64} />
                <h2>No Activity Found</h2>
                <p>Try adjusting your filters or check back later.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
