"use client";

import { ImageIcon, TrendingUp, Activity, Users, DollarSign, Zap, Clock, Heart, ExternalLink, Check, Grid3X3, List } from "lucide-react";
import { useState, useEffect } from "react";
import { getMarketplaceChain, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { formatEther } from "viem";
import Link from "next/link";

type NftMetadata = {
  name: string | null;
  collection: string | null;
  imageUrl: string | null;
  description: string | null;
  externalUrl: string | null;
  traits: Array<{ type: string; value: string }>;
};

type ListedNft = NftMetadata & { listing: IndexedListing };

type IndexedListing = {
  id: string;
  chainId: MarketplaceChainId;
  nftAddress: `0x${string}`;
  tokenId: string;
  seller: `0x${string}`;
  price: string;
  transactionHash: `0x${string}`;
  createdBlock: number;
  updatedBlock: number;
};

type IndexedActivity = {
  id: string;
  chainId: MarketplaceChainId;
  eventType: "listed" | "sold" | "canceled" | "withdrawn";
  nftAddress: `0x${string}` | null;
  tokenId: string | null;
  seller: `0x${string}` | null;
  buyer: `0x${string}` | null;
  price: string | null;
  transactionHash: `0x${string}`;
  blockNumber: number;
  logIndex: number;
};

type IndexerResponse = {
  listings: IndexedListing[];
  activity: IndexedActivity[];
  collections?: Array<{ nftAddress: string; floorPrice: string; listingCount: number }>;
  sync?: { caughtUp: boolean } | null;
  configured?: boolean;
  syncError?: string | null;
};

type CollectionStats = {
  totalItems: number;
  totalOwners: number;
  totalVolume: bigint;
  floorPrice: bigint;
  listedItems: number;
  totalSales: number;
};

type CollectionData = {
  name: string;
  description: string | null;
  banner: string | null;
  avatar: string | null;
  externalUrl: string | null;
  socialLinks: Record<string, string>;
  verified: boolean;
};

export default function CollectionPage({ params }: { params: Promise<{ chainId: string; contract: string }> }) {
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [nfts, setNfts] = useState<ListedNft[]>([]);
  const [activity, setActivity] = useState<IndexedActivity[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [floorComplete, setFloorComplete] = useState(false);
  const [currency, setCurrency] = useState("ETH");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "activity" | "analytics" | "offers">("items");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"price" | "recent" | "rarity">("recent");
  const [priceFilter, setPriceFilter] = useState("all");
  const [followKey, setFollowKey] = useState("");
  const [following, setFollowing] = useState(false);

  function toggleFollow() {
    if (!followKey) return;
    const next = !following;
    window.localStorage.setItem(followKey, next ? "1" : "0");
    setFollowing(next);
  }

  async function shareCollection() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: collectionData?.name ?? "NFT collection", url }); }
      catch (error) { if ((error as Error).name !== "AbortError") console.error("Could not share collection", error); }
    } else {
      await navigator.clipboard.writeText(url);
      window.alert("Collection link copied.");
    }
  }

  useEffect(() => {
    async function loadCollectionData() {
      try {
        const paramsValue = await params;
        const chainId = Number(paramsValue.chainId);
        const contract = paramsValue.contract;
        const key = `hoj:followed-collection:${chainId}:${contract.toLowerCase()}`;
        setFollowKey(key);
        setFollowing(window.localStorage.getItem(key) === "1");
        setCurrency(getMarketplaceChain(chainId as MarketplaceChainId).currency);

        console.log(`Loading collection data for contract ${contract} on chain ${chainId}`);

        // Load indexer data
        const indexerResponse = await fetch(`/api/indexer?chainId=${chainId}`, { cache: "no-store" });
        const indexerData = indexerResponse.ok ? await indexerResponse.json() as IndexerResponse : null;

        if (indexerData) {
          const collectionListings = indexerData.listings.filter(
            (l: IndexedListing) => l.nftAddress.toLowerCase() === contract.toLowerCase()
          );
          const collectionActivity = indexerData.activity.filter(
            (a: IndexedActivity) => a.nftAddress?.toLowerCase() === contract.toLowerCase()
          );

          console.log(`Found ${collectionListings.length} listings and ${collectionActivity.length} activity events`);

          setActivity(collectionActivity);

          // Calculate collection stats
          const summary = indexerData.collections?.find(item => item.nftAddress.toLowerCase() === contract.toLowerCase());
          setFloorComplete(Boolean(indexerData.sync?.caughtUp && !indexerData.syncError));
          const floorPrice = summary ? BigInt(summary.floorPrice) : collectionListings.length > 0
            ? collectionListings.reduce((min: bigint, l: IndexedListing) => {
                const price = BigInt(l.price);
                return price < min ? price : min;
              }, BigInt(collectionListings[0].price))
            : 0n;

          const totalVolume = collectionActivity
            .filter((a: IndexedActivity) => ["sold","offer_accepted"].includes(a.eventType) && a.price)
            .reduce((sum: bigint, a: IndexedActivity) => sum + BigInt(a.price || "0"), 0n);

          const totalSales = collectionActivity.filter((a: IndexedActivity) => ["sold","offer_accepted"].includes(a.eventType)).length;
          // Get unique owners from activity
          const uniqueOwners = new Set([
            ...collectionListings.map((l: IndexedListing) => l.seller.toLowerCase()),
            ...collectionActivity.map((a: IndexedActivity) => a.buyer?.toLowerCase()).filter(Boolean)
          ]);

          const indexedItems = new Set([
            ...collectionListings.map(item => item.tokenId),
            ...collectionActivity.flatMap(item => item.tokenId ? [item.tokenId] : []),
          ]).size;

          setStats({
            totalItems: indexedItems,
            totalOwners: uniqueOwners.size,
            totalVolume,
            floorPrice,
            listedItems: summary?.listingCount ?? collectionListings.length,
            totalSales,
          });

          // Load NFT metadata for listed items
          const nftMetadata = await Promise.all(
            collectionListings.slice(0, 20).map(async (listing: IndexedListing) => {
              const res = await fetch(`/api/nft?contract=${listing.nftAddress}&tokenId=${listing.tokenId}&chainId=${chainId}`, { cache: "no-store" });
              return res.ok ? { ...(await res.json()) as NftMetadata, listing } : null;
            })
          );
          const resolvedMetadata = nftMetadata.filter(Boolean) as ListedNft[];
          setNfts(resolvedMetadata);
          const first = resolvedMetadata[0];
          setCollectionData({
            name: first?.collection ?? `${contract.slice(0, 6)}…${contract.slice(-4)} collection`,
            description: first?.description ?? null,
            banner: null,
            avatar: first?.imageUrl ?? null,
            externalUrl: first?.externalUrl ?? null,
            socialLinks: {},
            verified: false,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to load collection data:", error);
        setLoading(false);
      }
    }

    loadCollectionData();
  }, [params]);

  const sortedNfts = nfts.filter(({listing}) => {
    const price = BigInt(listing.price);
    if (priceFilter === "low") return price < 100_000_000_000_000_000n;
    if (priceFilter === "medium") return price >= 100_000_000_000_000_000n && price <= 1_000_000_000_000_000_000n;
    if (priceFilter === "high") return price > 1_000_000_000_000_000_000n;
    return true;
  }).sort((a, b) => sortBy === "price"
    ? (BigInt(a.listing.price) < BigInt(b.listing.price) ? -1 : BigInt(a.listing.price) > BigInt(b.listing.price) ? 1 : 0)
    : b.listing.updatedBlock - a.listing.updatedBlock);

  return (
    <main className="royal-collection-page">
      {loading ? (
        <div className="royal-loading-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="royal-skeleton-card" />
          ))}
        </div>
      ) : (
        <>
          {/* Collection Header */}
          <section className="royal-collection-header">
            <div className="royal-collection-banner">
              {collectionData?.banner ? (
                <img src={collectionData.banner} alt="Collection Banner" />
              ) : (
                <div className="royal-banner-placeholder">
                  <ImageIcon size={48} />
                </div>
              )}
            </div>
            <div className="royal-collection-info">
              <div className="royal-collection-avatar">
                {collectionData?.avatar ? (
                  <img src={collectionData.avatar} alt="Collection Avatar" />
                ) : (
                  <div className="royal-avatar-placeholder">
                    <ImageIcon size={32} />
                  </div>
                )}
                {collectionData?.verified && (
                  <div className="royal-verified-badge">
                    <Check size={16} />
                  </div>
                )}
              </div>
              <div className="royal-collection-details">
                <h1>{collectionData?.name || "Unknown Collection"}</h1>
                <p>{collectionData?.description || "No description available."}</p>
                <div className="royal-collection-links">
                  {collectionData?.externalUrl && (
                    <a href={collectionData.externalUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={16} />
                      Website
                    </a>
                  )}
                </div>
              </div>
              <div className="royal-collection-actions">
                <button className="royal-primary-button" onClick={toggleFollow} aria-pressed={following}>
                  <Heart size={16} />
                  {following ? "Following" : "Follow"}
                </button>
                <button className="royal-secondary-button" onClick={() => { void shareCollection(); }}>
                  <ExternalLink size={16} />
                  Share
                </button>
              </div>
            </div>
          </section>

          {/* Collection Stats */}
          <section className="royal-collection-stats">
            <div className="royal-stat-card">
              <div className="royal-stat-icon">
                <DollarSign size={24} />
              </div>
              <div className="royal-stat-content">
                <span>{floorComplete ? "Marketplace Floor" : "Observed Listing Low"}</span>
                <strong>{stats && stats.floorPrice > 0n ? formatEther(stats.floorPrice) : "—"} {currency}</strong>
              </div>
            </div>
            <div className="royal-stat-card">
              <div className="royal-stat-icon">
                <TrendingUp size={24} />
              </div>
              <div className="royal-stat-content">
                <span title="Sales visible in the latest indexed activity; not all-time volume.">Recent HOJ Volume</span>
                <strong>{stats?.totalVolume ? formatEther(stats.totalVolume) : "—"} {currency}</strong>
              </div>
            </div>
            <div className="royal-stat-card">
              <div className="royal-stat-icon">
                <Users size={24} />
              </div>
              <div className="royal-stat-content">
                <span title="Unique sellers and buyers in indexed activity, not the collection's total holder count.">Observed traders</span>
                <strong>{stats?.totalOwners || 0}</strong>
              </div>
            </div>
            <div className="royal-stat-card">
              <div className="royal-stat-icon">
                <Activity size={24} />
              </div>
              <div className="royal-stat-content">
                <span>Indexed Items</span>
                <strong>{stats?.totalItems || 0}</strong>
              </div>
            </div>
            <div className="royal-stat-card">
              <div className="royal-stat-icon">
                <Zap size={24} />
              </div>
              <div className="royal-stat-content">
                <span>Listed</span>
                <strong>{stats?.listedItems || 0}</strong>
              </div>
            </div>
            <div className="royal-stat-card">
              <div className="royal-stat-icon">
                <Clock size={24} />
              </div>
              <div className="royal-stat-content">
                <span>Total Sales</span>
                <strong>{stats?.totalSales || 0}</strong>
              </div>
            </div>
          </section>

          {/* Collection Tabs */}
          <section className="royal-collection-tabs">
            <button className={activeTab === "items" ? "active" : ""} onClick={() => setActiveTab("items")}>
              Items
            </button>
            <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>
              Activity
            </button>
            <button className={activeTab === "analytics" ? "active" : ""} onClick={() => setActiveTab("analytics")}>
              Analytics
            </button>
            <button className={activeTab === "offers" ? "active" : ""} onClick={() => setActiveTab("offers")}>
              Offers
            </button>
          </section>

          {/* Collection Filters */}
          <section className="royal-collection-filters">
            <div className="royal-filter-group">
              <span>Sort by</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="recent">Recently Listed</option>
                <option value="price">Price: Low to High</option>
              </select>
            </div>
            <div className="royal-filter-group">
              <span>Price</span>
              <select value={priceFilter} onChange={event => setPriceFilter(event.target.value)}>
                <option value="all">All Prices</option>
                <option value="low">Under 0.1</option>
                <option value="medium">0.1 - 1</option>
                <option value="high">Over 1</option>
              </select>
            </div>
            <div className="royal-filter-group">
              <span>View</span>
              <div className="royal-view-toggle">
                <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
                  <Grid3X3 size={16} />
                </button>
                <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
                  <List size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Collection Content */}
          <section className="royal-collection-content">
            {activeTab === "items" && (
              <div className={`royal-nft-grid ${viewMode}`}>
                {sortedNfts.length > 0 ? (
                  sortedNfts.map((nft) => {
                    const listing = nft.listing;
                    const chain = getMarketplaceChain(listing.chainId);
                    return (
                      <Link
                        key={listing.id}
                        href={`/nft/${listing.chainId}/${listing.nftAddress}/${listing.tokenId}`}
                        className="royal-nft-card"
                      >
                        <div className="royal-nft-image" style={nft.imageUrl ? { backgroundImage: `url(${nft.imageUrl})` } : undefined}>
                          {!nft.imageUrl && <ImageIcon size={32} />}
                        </div>
                        <div className="royal-nft-details">
                          <small>{nft.collection || "Unknown Collection"}</small>
                          <h3>{nft.name || `Token #${listing.tokenId}`}</h3>
                          <div className="royal-nft-price">
                            <span>{formatEther(BigInt(listing.price))} {chain.currency}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="royal-empty-state">
                    <ImageIcon size={48} />
                    <h2>No items listed</h2>
                    <p>This collection has no items currently listed for sale.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="royal-activity-timeline">
                {activity.length > 0 ? (
                  activity.map((item) => {
                    const chain = getMarketplaceChain(item.chainId);
                    return (
                      <div key={item.id} className="royal-activity-item">
                        <div className="royal-activity-icon">
                          {item.eventType === "sold" && <TrendingUp size={16} />}
                          {item.eventType === "listed" && <Activity size={16} />}
                          {item.eventType === "canceled" && <Clock size={16} />}
                        </div>
                        <div className="royal-activity-content">
                          <span className="royal-activity-type">{item.eventType.toUpperCase()}</span>
                          <p>#{item.tokenId} • {item.price ? `${formatEther(BigInt(item.price))} ${chain.currency}` : "—"}</p>
                        </div>
                        <div className="royal-activity-time">
                          <small>Block {item.blockNumber}</small>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="royal-empty-state">
                    <Activity size={64} />
                    <h2>No activity yet</h2>
                    <p>This collection has no recorded activity.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="royal-analytics-dashboard">
                <div className="royal-analytics-card">
                  <h3>Volume Chart</h3>
                  <p>Volume tracking coming soon</p>
                </div>
                <div className="royal-analytics-card">
                  <h3>Price Distribution</h3>
                  <p>Price analytics coming soon</p>
                </div>
                <div className="royal-analytics-card">
                  <h3>Rarity Rankings</h3>
                  <p>Rarity analysis coming soon</p>
                </div>
              </div>
            )}

            {activeTab === "offers" && (
              <div className="royal-empty-state">
                <Heart size={64} />
                <h2>No offers yet</h2>
                <p>Offers on this collection will appear here.</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
