"use client";

import { ImageIcon, TrendingUp, Activity, Users, DollarSign, Zap, Clock, Heart, ExternalLink, Check, Grid3X3, List, ShoppingCart, Filter, Search, SlidersHorizontal, X } from "lucide-react";
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
  tokenType?: "ERC-721" | "ERC-1155";
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
  averagePrice: bigint;
  highestSale: bigint;
  createdDate: string | null;
  mintedPercentage: number;
};

type CollectionData = {
  name: string;
  description: string | null;
  banner: string | null;
  avatar: string | null;
  externalUrl: string | null;
  socialLinks: Record<string, string>;
  verified: boolean;
  creator: string | null;
  royaltyRecipient: string | null;
  royaltyPercentage: number | null;
  totalSupply: number | null;
  mintedDate: string | null;
  contractType: string | null;
  standard: string | null;
};

export default function CollectionPage({ params }: { params: Promise<{ chainId: string; contract: string }> }) {
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [nfts, setNfts] = useState<ListedNft[]>([]);
  const [allListings, setAllListings] = useState<IndexedListing[]>([]);
  const [sweepQuantity, setSweepQuantity] = useState(2);
  const [collectionChainId, setCollectionChainId] = useState<MarketplaceChainId | null>(null);
  const [contractAddress, setContractAddress] = useState<string>("");
  const [activity, setActivity] = useState<IndexedActivity[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [floorComplete, setFloorComplete] = useState(false);
  const [currency, setCurrency] = useState("ETH");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("items");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [priceFilter, setPriceFilter] = useState("all");
  const [followKey, setFollowKey] = useState("");
  const [following, setFollowing] = useState(false);
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<Array<{ date: string; price: string; event: string }>>([]);
  const [traitDistribution, setTraitDistribution] = useState<Array<{ traitType: string; value: string; count: number; percentage: number }>>([]);
  const [rarityRankings, setRarityRankings] = useState<Array<{ tokenId: string; rank: number; score: number }>>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "listed" | "not_listed" | "owned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [buySellTab, setBuySellTab] = useState<"buy" | "sell">("buy");
  const [maxPrice, setMaxPrice] = useState("");

  const sweepListings = [...allListings]
    .filter(listing => listing.tokenType !== "ERC-1155" && BigInt(listing.price) > 0n)
    .sort((a, b) => BigInt(a.price) < BigInt(b.price) ? -1 : BigInt(a.price) > BigInt(b.price) ? 1 : 0);
  const sweepCount = Math.min(Math.max(1, sweepQuantity), sweepListings.length);
  const sweepSelection = sweepListings.slice(0, sweepCount);
  const sweepTotal = sweepSelection.reduce((total, listing) => total + BigInt(listing.price), 0n);

  function addSweepToCart() {
    if (!collectionChainId || !sweepSelection.length) return;
    const key = `hoj-market-cart:${collectionChainId}`;
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
      const existing = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
      window.localStorage.setItem(key, JSON.stringify([...new Set([...existing, ...sweepSelection.map(item => item.id)])]));
      window.location.assign(`/market?chainId=${collectionChainId}&cart=1`);
    } catch {
      window.alert("Could not save this sweep to your cart. Please try again.");
    }
  }

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
        setCollectionChainId(chainId as MarketplaceChainId);
        const contract = paramsValue.contract;
        setContractAddress(contract);
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
          setAllListings(collectionListings);
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
            averagePrice: totalSales > 0n ? totalVolume / BigInt(totalSales) : 0n,
            highestSale: collectionActivity
              .filter((a: IndexedActivity) => ["sold","offer_accepted"].includes(a.eventType) && a.price)
              .reduce((max: bigint, a: IndexedActivity) => {
                const price = BigInt(a.price || "0");
                return price > max ? price : max;
              }, 0n),
            createdDate: null,
            mintedPercentage: 100,
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
            creator: null,
            royaltyRecipient: null,
            royaltyPercentage: null,
            totalSupply: null,
            mintedDate: null,
            contractType: null,
            standard: null,
          });

          // Try to fetch contract information
          try {
            const contractRes = await fetch(`/api/contract-info?chainId=${chainId}&contract=${contract}`, { cache: "no-store" });
            if (contractRes.ok) {
              const contractData = await contractRes.json();
              setContractInfo(contractData);
            }
          } catch (error) {
            console.log("Could not fetch contract info:", error);
          }

          // Calculate price history from activity
          const priceHistoryData = collectionActivity
            .filter((a: IndexedActivity) => ["sold","offer_accepted"].includes(a.eventType) && a.price)
            .map((a: IndexedActivity) => ({
              date: new Date().toISOString(),
              price: a.price || "0",
              event: a.eventType,
            }))
            .slice(-50); // Last 50 sales
          setPriceHistory(priceHistoryData);

          // Calculate trait distribution
          const traitMap = new Map<string, Map<string, number>>();
          for (const nft of resolvedMetadata) {
            for (const trait of nft.traits) {
              if (!traitMap.has(trait.type)) {
                traitMap.set(trait.type, new Map());
              }
              const typeMap = traitMap.get(trait.type)!;
              typeMap.set(trait.value, (typeMap.get(trait.value) || 0) + 1);
            }
          }

          const traitDistributionData: Array<{ traitType: string; value: string; count: number; percentage: number }> = [];
          for (const [traitType, valueMap] of traitMap) {
            const total = valueMap.size;
            for (const [value, count] of valueMap) {
              traitDistributionData.push({
                traitType,
                value,
                count,
                percentage: (count / resolvedMetadata.length) * 100,
              });
            }
          }
          setTraitDistribution(traitDistributionData.sort((a, b) => b.count - a.count).slice(0, 20));
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
  }).filter((nft) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (nft.name?.toLowerCase().includes(query) || nft.listing.tokenId.includes(query));
    }
    return true;
  }).filter(({listing}) => {
    if (statusFilter === "listed") return BigInt(listing.price) > 0n;
    if (statusFilter === "not_listed") return BigInt(listing.price) === 0n;
    return true;
  }).sort((a, b) => {
    if (sortBy === "price") {
      return BigInt(a.listing.price) < BigInt(b.listing.price) ? -1 : BigInt(a.listing.price) > BigInt(b.listing.price) ? 1 : 0;
    } else if (sortBy === "price_desc") {
      return BigInt(a.listing.price) > BigInt(b.listing.price) ? -1 : BigInt(a.listing.price) < BigInt(b.listing.price) ? 1 : 0;
    }
    return b.listing.updatedBlock - a.listing.updatedBlock;
  });

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
          {/* OpenSea-style Collection Header */}
          <section className="royal-collection-header opensea-style">
            <div className="royal-collection-banner">
              {collectionData?.banner ? (
                <img src={collectionData.banner || ""} alt="Collection Banner" />
              ) : (
                <div className="royal-banner-placeholder">
                  <ImageIcon size={48} />
                </div>
              )}
            </div>
            <div className="royal-collection-header-content">
              <div className="royal-collection-avatar-row">
                <div className="royal-collection-avatar">
                  {collectionData?.avatar ? (
                    <img src={collectionData.avatar || ""} alt="Collection Avatar" />
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
                <div className="royal-collection-name-section">
                  <h1>{collectionData?.name || "Unknown Collection"}</h1>
                  <div className="royal-collection-badges">
                    <span className="royal-badge">{stats?.totalItems || 0}</span>
                    {stats?.createdDate && <span className="royal-badge">{new Date(stats.createdDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}</span>}
                    <span className="royal-badge">PFPS</span>
                    {collectionData?.royaltyPercentage && <span className="royal-badge">{collectionData.royaltyPercentage}% CREATOR FEE</span>}
                  </div>
                </div>
              </div>
              <div className="royal-collection-actions-row">
                <button className="royal-primary-button" onClick={toggleFollow} aria-pressed={following}>
                  <Heart size={16} />
                  {following ? "Following" : "Follow"}
                </button>
                <button className="royal-secondary-button" onClick={() => { void shareCollection(); }}>
                  <ExternalLink size={16} />
                  Share
                </button>
                {collectionData?.externalUrl && (
                  <a href={collectionData.externalUrl || ""} target="_blank" rel="noopener noreferrer" className="royal-secondary-button">
                    <ExternalLink size={16} />
                    Website
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* OpenSea-style Stats Bar */}
          <section className="royal-collection-stats-bar opensea-style">
            <div className="royal-stat-item">
              <span className="royal-stat-label">FLOOR PRICE</span>
              <strong className="royal-stat-value">{stats && stats.floorPrice > 0n ? formatEther(stats.floorPrice) : "—"} {currency}</strong>
            </div>
            <div className="royal-stat-item">
              <span className="royal-stat-label">1D FLOOR %</span>
              <strong className="royal-stat-value">0%</strong>
            </div>
            <div className="royal-stat-item">
              <span className="royal-stat-label">TOP OFFER</span>
              <strong className="royal-stat-value">—</strong>
            </div>
            <div className="royal-stat-item">
              <span className="royal-stat-label">24H VOLUME</span>
              <strong className="royal-stat-value">{stats?.totalVolume ? formatEther(stats.totalVolume) : "—"} {currency}</strong>
            </div>
            <div className="royal-stat-item">
              <span className="royal-stat-label">TOTAL VOLUME</span>
              <strong className="royal-stat-value">{stats?.totalVolume ? formatEther(stats.totalVolume) : "—"} {currency}</strong>
            </div>
            <div className="royal-stat-item">
              <span className="royal-stat-label">LISTED</span>
              <strong className="royal-stat-value">{stats?.listedItems || 0} ({stats?.totalItems ? ((stats.listedItems / stats.totalItems) * 100).toFixed(1) : 0}%)</strong>
            </div>
            <div className="royal-stat-item">
              <span className="royal-stat-label">OWNERS (UNIQUE)</span>
              <strong className="royal-stat-value">{stats?.totalOwners || 0} ({stats?.totalItems ? ((stats.totalOwners / stats.totalItems) * 100).toFixed(1) : 0}%)</strong>
            </div>
          </section>

          {/* Collection Tabs */}
          <section className="royal-collection-tabs opensea-style">
            <button className={activeTab === "explore" ? "active" : ""} onClick={() => setActiveTab("explore")}>
              Explore
            </button>
            <button className={activeTab === "items" ? "active" : ""} onClick={() => setActiveTab("items")}>
              Items
            </button>
            <button className={activeTab === "offers" ? "active" : ""} onClick={() => setActiveTab("offers")}>
              Offers
            </button>
            <button className={activeTab === "holders" ? "active" : ""} onClick={() => setActiveTab("holders")}>
              Holders
            </button>
            <button className={activeTab === "traits" ? "active" : ""} onClick={() => setActiveTab("traits")}>
              Traits
            </button>
            <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>
              Activity
            </button>
            <button className={activeTab === "analytics" ? "active" : ""} onClick={() => setActiveTab("analytics")}>
              Analytics
            </button>
            <button className={activeTab === "details" ? "active" : ""} onClick={() => setActiveTab("details")}>
              About
            </button>
          </section>

          {/* Main Content Area with Sidebar */}
          <section className="royal-collection-main-layout">
            {/* Sidebar Filters */}
            <aside className="royal-collection-sidebar">
              <div className="royal-filter-section">
                <h3>Status</h3>
                <div className="royal-filter-buttons">
                  <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>
                    All
                  </button>
                  <button className={statusFilter === "listed" ? "active" : ""} onClick={() => setStatusFilter("listed")}>
                    Listed
                  </button>
                  <button className={statusFilter === "not_listed" ? "active" : ""} onClick={() => setStatusFilter("not_listed")}>
                    Not Listed
                  </button>
                  <button className={statusFilter === "owned" ? "active" : ""} onClick={() => setStatusFilter("owned")}>
                    Owned by you
                  </button>
                </div>
              </div>

              <div className="royal-filter-section">
                <h3>Rarity</h3>
                <select className="royal-filter-select">
                  <option>All Rarities</option>
                  <option>Common</option>
                  <option>Rare</option>
                  <option>Epic</option>
                  <option>Legendary</option>
                </select>
              </div>

              <div className="royal-filter-section">
                <h3>Price</h3>
                <select className="royal-filter-select">
                  <option>All Prices</option>
                  <option>Under 0.1</option>
                  <option>0.1 - 1</option>
                  <option>1 - 10</option>
                  <option>Over 10</option>
                </select>
              </div>

              <div className="royal-filter-section">
                <h3>Marketplaces</h3>
                <select className="royal-filter-select">
                  <option>All Marketplaces</option>
                  <option>House of Joshi</option>
                </select>
              </div>
            </aside>

            {/* Main Content */}
            <div className="royal-collection-content-area">
              {/* Search and Filter Bar */}
              <div className="royal-collection-toolbar">
                <div className="royal-search-bar">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by item or trait"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="royal-toolbar-actions">
                  <select className="royal-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="recent">Recently Listed</option>
                    <option value="price">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                  <div className="royal-view-toggle">
                    <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
                      <Grid3X3 size={16} />
                    </button>
                    <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
                      <List size={16} />
                    </button>
                  </div>
                  <button className="royal-insights-button">
                    <Activity size={16} />
                    Insights
                  </button>
                </div>
              </div>

              {/* Item Count */}
              <div className="royal-item-count">
                <strong>{stats?.totalItems || 0} ITEMS</strong>
              </div>

              {/* Sweep Floor Section */}
              {sweepListings.length > 0 && (
                <section className="royal-sweep-floor opensea-style" aria-label="Sweep floor">
                  <div className="royal-sweep-tabs">
                    <button className={buySellTab === "buy" ? "active" : ""} onClick={() => setBuySellTab("buy")}>
                      Buy
                    </button>
                    <button className={buySellTab === "sell" ? "active" : ""} onClick={() => setBuySellTab("sell")}>
                      Sell
                    </button>
                  </div>
                  <div className="royal-sweep-controls">
                    <div className="royal-sweep-input-group">
                      <label>Quantity</label>
                      <input
                        type="number"
                        min={1}
                        max={sweepListings.length}
                        value={sweepQuantity}
                        onChange={event => setSweepQuantity(Math.min(sweepListings.length, Math.max(1, Number(event.target.value) || 1)))}
                      />
                    </div>
                    <div className="royal-sweep-input-group">
                      <label>Max Price Per Item</label>
                      <input
                        type="text"
                        placeholder={`Max price in ${currency}`}
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                    <div className="royal-sweep-actions">
                      <button className="royal-primary-button" onClick={addSweepToCart}>
                        Make Collection Offer
                      </button>
                      <button className="royal-secondary-button" onClick={addSweepToCart}>
                        Buy Floor
                      </button>
                    </div>
                  </div>
                </section>
              )}
          <section className="royal-collection-tabs">
            <button className={activeTab === "items" ? "active" : ""} onClick={() => setActiveTab("items")}>
              Items
            </button>
            <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>
              Activity
            </button>
            <button className={activeTab === "details" ? "active" : ""} onClick={() => setActiveTab("details")}>
              Details
            </button>
            <button className={activeTab === "traits" ? "active" : ""} onClick={() => setActiveTab("traits")}>
              Traits
            </button>
            <button className={activeTab === "analytics" ? "active" : ""} onClick={() => setActiveTab("analytics")}>
              Analytics
            </button>
            <button className={activeTab === "offers" ? "active" : ""} onClick={() => setActiveTab("offers")}>
              Offers
            </button>
          </section>

              {/* Collection Content */}
              <div className="royal-collection-tab-content">
                {activeTab === "items" && (
                  <div className={`royal-nft-grid ${viewMode}`}>
                    {sortedNfts.length > 0 ? (
                      sortedNfts.map((nft) => {
                        const listing = nft.listing;
                        const chain = getMarketplaceChain(listing.chainId);
                        const lastSale = activity.find(a => a.tokenId === listing.tokenId && ["sold", "offer_accepted"].includes(a.eventType));
                        return (
                          <Link
                            key={listing.id}
                            href={`/nft/${listing.chainId}/${listing.nftAddress}/${listing.tokenId}`}
                            className="royal-nft-card opensea-style"
                          >
                            <div className="royal-nft-image" style={nft.imageUrl ? { backgroundImage: `url(${nft.imageUrl})` } : undefined}>
                              {!nft.imageUrl && <ImageIcon size={32} />}
                            </div>
                            <div className="royal-nft-details">
                              <div className="royal-nft-header">
                                <small>{collectionData?.name?.slice(0, 2).toUpperCase() || "UNK"}</small>
                                <strong>#{listing.tokenId}</strong>
                              </div>
                              <div className="royal-nft-price">
                                <span>{formatEther(BigInt(listing.price))} {chain.currency}</span>
                              </div>
                              {lastSale && (
                                <div className="royal-nft-last-sale">
                                  <small>Last sale {formatEther(BigInt(lastSale.price || "0"))} {chain.currency}</small>
                                </div>
                              )}
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

                {activeTab === "holders" && (
                  <div className="royal-empty-state">
                    <Users size={64} />
                    <h2>Holder information coming soon</h2>
                    <p>Unique holder statistics will appear here.</p>
                  </div>
                )}

                {activeTab === "explore" && (
                  <div className="royal-empty-state">
                    <Activity size={64} />
                    <h2>Explore coming soon</h2>
                    <p>Collection exploration features will appear here.</p>
                  </div>
                )}

                {activeTab === "details" && (
                  <div className="royal-collection-details-tab">
                    <div className="royal-details-section">
                      <h3>About Collection</h3>
                      <p>{collectionData?.description || "No description available for this collection."}</p>
                    </div>

                    {collectionData?.externalUrl && (
                      <div className="royal-details-section">
                        <h3>Website</h3>
                        <a href={collectionData.externalUrl || ""} target="_blank" rel="noopener noreferrer">
                          {collectionData.externalUrl} <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    <div className="royal-details-section">
                      <h3>Contract Information</h3>
                      <div className="royal-contract-info">
                        <div>
                          <span>Contract Address</span>
                          <code>{contractAddress || "Loading..."}</code>
                        </div>
                        <div>
                          <span>Token Standard</span>
                          <strong>{collectionData?.standard || "ERC-721"}</strong>
                        </div>
                        <div>
                          <span>Chain</span>
                          <strong>{getMarketplaceChain(collectionChainId || 109).name}</strong>
                        </div>
                        {collectionData?.creator && (
                          <div>
                            <span>Creator</span>
                            <code>{collectionData?.creator}</code>
                          </div>
                        )}
                        {collectionData?.royaltyPercentage !== null && (
                          <div>
                            <span>Royalty</span>
                            <strong>{collectionData?.royaltyPercentage}%</strong>
                          </div>
                        )}
                        {collectionData?.totalSupply !== null && (
                          <div>
                            <span>Total Supply</span>
                            <strong>{collectionData?.totalSupply?.toLocaleString() || "—"}</strong>
                          </div>
                        )}
                        {collectionData?.mintedDate && (
                          <div>
                            <span>Minted Date</span>
                            <strong>{new Date(collectionData.mintedDate || "").toLocaleDateString()}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="royal-details-section">
                      <h3>Links</h3>
                      <div className="royal-social-links">
                        {contractAddress && (
                          <a href={`${getMarketplaceChain(collectionChainId || 109).explorerUrl}/token/${contractAddress}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={14} /> View on Explorer
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "traits" && (
                  <div className="royal-traits-tab">
                    {traitDistribution.length > 0 ? (
                      <div className="royal-traits-distribution">
                        <h3>Trait Distribution</h3>
                        <p>Most common traits in this collection based on listed items.</p>
                        <div className="royal-traits-grid">
                          {traitDistribution.map((trait, index) => (
                            <div key={index} className="royal-trait-card">
                              <div className="royal-trait-header">
                                <span>{trait.traitType}</span>
                                <strong>{trait.value}</strong>
                              </div>
                              <div className="royal-trait-stats">
                                <span>{trait.count} NFTs</span>
                                <strong>{trait.percentage.toFixed(1)}%</strong>
                              </div>
                              <div className="royal-trait-bar">
                                <div style={{ width: `${trait.percentage}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="royal-empty-state">
                        <Activity size={64} />
                        <h2>No trait data available</h2>
                        <p>Trait information will appear when NFTs with metadata are listed.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
