"use client";

import { ArrowUpRight, Sparkles, TrendingUp, Users, Clock, Search, ImageIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

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
  timestamp?: number;
};

type IndexerResponse = {
  chainId: MarketplaceChainId;
  chain: string;
  currency: string;
  configured: boolean;
  marketplaceAddress?: `0x${string}`;
  listings: IndexedListing[];
  activity: IndexedActivity[];
  collections?: Array<{ nftAddress: `0x${string}`; floorPrice: string; listingCount: number; latestBlock: number; sampleTokenId: string }>;
  sync: { caughtUp: boolean; syncedThrough: number; safeLatest: number } | null;
  syncError?: string | null;
};

type ListedCollection = {
  sampleTokenId: string;
  address: `0x${string}`;
  floorPrice: string;
  listingCount: number;
  complete: boolean;
  chainId: MarketplaceChainId;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ListedCollectionCard({collection,rank,featured=false}:{collection:ListedCollection;rank:number;featured?:boolean}) {
  const [metadata,setMetadata]=useState<{collection?:string;imageUrl?:string}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{collection?:string;imageUrl?:string}>:null).then(data=>{setMetadata(data);setFailed(false);}).catch(()=>{});
    return()=>controller.abort();
  },[collection.chainId,collection.address,collection.sampleTokenId]);
  return <Link href={`/collection/${collection.chainId}/${collection.address}`} className={`royal-collection-card${featured?" royal-featured-collection":""}`}>
    <div className="royal-collection-rank">{featured?"FEATURED COLLECTION":`#${rank}`}</div>
    <div className="royal-collection-avatar">{metadata?.imageUrl&&!failed?<Image src={metadata.imageUrl} alt={metadata.collection??"Collection artwork"} width={56} height={56} unoptimized onError={()=>setFailed(true)} style={{objectFit:"cover",borderRadius:8}}/>:<ImageIcon size={32}/>}</div>
    <div className="royal-collection-info"><h3>{metadata?.collection??shortAddress(collection.address)}</h3><span>{getMarketplaceChain(collection.chainId).name}</span>
      <div className="royal-collection-stats"><div><strong>{collection.listingCount}</strong><span>Listings</span></div><div><strong>{formatEther(BigInt(collection.floorPrice))} {getMarketplaceChain(collection.chainId).currency}</strong><span>{collection.complete?"HOJ floor":"Observed HOJ low"}</span></div></div>
    </div>
  </Link>;
}

function FeaturedArtwork({ listing }: { listing: IndexedListing }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/nft?chainId=${listing.chainId}&contract=${listing.nftAddress}&tokenId=${listing.tokenId}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ imageUrl?: string | null }> : null)
      .then(data => setImageUrl(data?.imageUrl ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [listing.chainId, listing.nftAddress, listing.tokenId]);
  return imageUrl && !failed
    ? <Image src={imageUrl} alt={`NFT #${listing.tokenId}`} width={360} height={360} unoptimized loading="lazy" onError={() => setFailed(true)} className="royal-featured-artwork" />
    : <div className="royal-nft-placeholder"><ImageIcon size={36} aria-label="Artwork unavailable" /></div>;
}

export default function Home() {
  const [listedCollections, setListedCollections] = useState<ListedCollection[]>([]);
  const [featuredNFTs, setFeaturedNFTs] = useState<IndexedListing[]>([]);
  const [recentActivity, setRecentActivity] = useState<IndexedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingCount, setListingCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    async function loadMarketplaceData() {
      try {
        const responses = await Promise.allSettled(
          (Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).map(async chainId => {
            const res = await fetch(`/api/indexer?chainId=${chainId}`, { cache: "no-store" });
            return res.ok ? (await res.json()) as IndexerResponse : null;
          })
        );

        if (!mounted) return;

        const allListings: IndexedListing[] = [];
        const allActivity: IndexedActivity[] = [];

        const collections: ListedCollection[] = [];
        responses.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            const data = result.value as IndexerResponse;
            if (!data.configured) return;
            allListings.push(...data.listings);
            allActivity.push(...data.activity);
            for (const collection of data.collections ?? []) {
              collections.push({
                address: collection.nftAddress,
                sampleTokenId: collection.sampleTokenId,
                chainId: data.chainId,
                floorPrice: collection.floorPrice,
                listingCount: collection.listingCount,
                complete: Boolean(data.sync?.caughtUp && !data.syncError),
              });
            }
          }
        });
        const activityTimes = new Map(allActivity.map(event => [`${event.chainId}:${event.transactionHash.toLowerCase()}`, event.timestamp ?? 0]));
        setFeaturedNFTs(allListings.sort((a,b) => {
          const aTime = activityTimes.get(`${a.chainId}:${a.transactionHash.toLowerCase()}`) ?? 0;
          const bTime = activityTimes.get(`${b.chainId}:${b.transactionHash.toLowerCase()}`) ?? 0;
          return bTime-aTime || (a.chainId===b.chainId ? b.updatedBlock-a.updatedBlock : 0);
        }).slice(0, 8));
        const sales = allActivity.filter(a => (["sold","offer_accepted"].includes(a.eventType)));
        setRecentActivity(sales.slice(0, 6));
        setSaleCount(sales.length);
        setListingCount(collections.reduce((sum, item) => sum + item.listingCount, 0));
        setListedCollections(collections.sort((a, b) => b.listingCount - a.listingCount));
      } catch (error) {
        console.error("Failed to load marketplace data:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMarketplaceData();
    const timer = window.setInterval(() => { if (!document.hidden) void loadMarketplaceData(); }, 30_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  return (
    <main className="royal-homepage">
      {/* Hero Section */}
      <section className="royal-hero">
        <div className="royal-hero-content">
          <div className="royal-badge">
            <Sparkles size={16} />
            <span>House of Joshi · NFT Marketplace</span>
          </div>
          <h1>Collect what moves you.</h1>
          <p className="royal-subtitle">
            Explore real listings across supported networks. Find a work you love, inspect its details, and trade from your wallet.
          </p>
          <div className="royal-hero-actions">
            <Link href="/market" className="royal-primary-button">
              Explore NFTs
              <ArrowUpRight size={18} />
            </Link>
            <a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer" className="royal-secondary-button">
              Create NFT
              <Sparkles size={18} />
            </a>
          </div>
        </div>
        <div className="royal-hero-visual">
        </div>
      </section>

      {/* Stats Bar */}
      <section className="royal-stats-bar">
        <div className="royal-stat">
          <Users size={20} />
          <div>
            <strong>{Object.keys(marketplaceChains).length}</strong>
            <span>Supported Networks</span>
          </div>
        </div>
        <div className="royal-stat">
          <TrendingUp size={20} />
          <div>
            <strong>{listingCount}</strong>
            <span>Active Listings</span>
          </div>
        </div>
        <div className="royal-stat">
          <Clock size={20} />
          <div>
            <strong>{saleCount}</strong>
            <span>Recent Sales</span>
          </div>
        </div>
      </section>

      {/* Collections with active marketplace listings */}
      <section className="royal-section royal-listed-section">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">MARKETPLACE</span>
            <h2>Listed Collections</h2>
          </div>
          <Link href="/collections" className="royal-view-all">
            View All
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="royal-collections-grid">
            {listedCollections.length === 0 && <p className="royal-market-empty">No collections have active indexed listings yet. Check back after a seller lists an NFT.</p>}
            {listedCollections.map((collection, index) => (
              <ListedCollectionCard key={`${collection.chainId}:${collection.address}`} collection={collection} rank={index+1} featured={index===0}/>
            ))}
          </div>
        )}
      </section>

      {/* Featured NFTs */}
      <section className="royal-section royal-section-alt royal-featured-section">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">EXPLORE</span>
            <h2>Explore listed NFTs</h2>
          </div>
          <Link href="/market" className="royal-view-all">
            View All
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="royal-nfts-grid">
            {featuredNFTs.length === 0 && <p className="royal-market-empty">No active NFTs are available to browse right now. Explore the market or list a work from your wallet.</p>}
            {featuredNFTs.map((nft) => {
              const chain = getMarketplaceChain(nft.chainId);
              return (
                <Link 
                  key={nft.id} 
                  href={`/nft/${nft.chainId}/${nft.nftAddress}/${nft.tokenId}`}
                  className="royal-nft-card"
                >
                  <div className="royal-nft-image">
                    <FeaturedArtwork listing={nft} />
                    <div className="royal-nft-overlay">
                      <span className="royal-quick-view" aria-hidden="true">
                        <Search size={20} />
                      </span>
                    </div>
                  </div>
                  <div className="royal-nft-info">
                    <div className="royal-nft-collection">
                      <span>{chain.name}</span>
                      <strong>{shortAddress(nft.nftAddress)}</strong>
                    </div>
                    <h3>Token #{nft.tokenId}</h3>
                    <div className="royal-nft-price">
                      <span>Current Price</span>
                      <strong>{formatEther(BigInt(nft.price))} {chain.currency}</strong>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section className="royal-section royal-section-alt">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">ACTIVITY</span>
            <h2>Recent Activity</h2>
          </div>
          <Link href="/activity" className="royal-view-all">
            View All
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="royal-activity-list">
          {loading ? (
            <div className="royal-loading-activity">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="royal-activity-skeleton" />
              ))}
            </div>
          ) : (
            recentActivity.map((activity) => {
              const chain = getMarketplaceChain(activity.chainId);
              return (
                <div key={activity.id} className="royal-activity-item">
                  <div className="royal-activity-type">
                    <Clock size={16} />
                    <span>Sold</span>
                  </div>
                  <div className="royal-activity-details">
                    <strong>Token #{activity.tokenId}</strong>
                    <span>{shortAddress(activity.nftAddress || "")}</span>
                  </div>
                  <div className="royal-activity-price">
                    <strong>{activity.price ? formatEther(BigInt(activity.price)) : "0"} {chain.currency}</strong>
                  </div>
                  <div className="royal-activity-chain">
                    <span>{chain.name}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Royal Vault CTA */}
      <section className="royal-vault-cta">
        <div className="royal-vault-content">
          <h2>Explore collections</h2>
          <p>
            Browse collections with marketplace activity, then open an NFT to see its verified metadata and listing details.
          </p>
          <Link href="/collections" className="royal-vault-button">
            Browse collections
            <Sparkles size={20} />
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="royal-section">
        <div className="royal-section-header centered">
          <span className="royal-section-label">GUIDE</span>
          <h2>How It Works</h2>
        </div>
        <div className="royal-steps-grid">
          <div className="royal-step-card">
            <div className="royal-step-number">1</div>
            <h3>Connect Your Wallet</h3>
            <p>Link your Web3 wallet to access your digital treasures and begin trading.</p>
          </div>
          <div className="royal-step-card">
            <div className="royal-step-number">2</div>
            <h3>Explore Collections</h3>
            <p>Browse curated NFTs across multiple blockchains in our elegant marketplace.</p>
          </div>
          <div className="royal-step-card">
            <div className="royal-step-number">3</div>
            <h3>Make Your Move</h3>
            <p>Purchase with confidence or list your own NFTs for fellow collectors to discover.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
