"use client";

import { ArrowUpRight, ExternalLink, Flame, Grid2X2, List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import Image from "next/image";
import { getMarketplaceChain, isMarketplaceLive, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Listing = { id:string; chainId:MarketplaceChainId; nftAddress:string; tokenId:string; seller:string; price:string; transactionHash:string };
type Activity = { id:string; chainId:MarketplaceChainId; eventType:string; nftAddress:string|null; tokenId:string|null; price:string|null; blockNumber:number };
type ChainData = { chainId:MarketplaceChainId; chain:string; currency:string; configured:boolean; listings:Listing[]; activity:Activity[] };
type NftMetadata = { name:string|null; collection:string|null; imageUrl:string|null };

export function NetworkMarketplace({ chainId }: { chainId: MarketplaceChainId }) {
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const chain = getMarketplaceChain(chainId);
  const isLive = isMarketplaceLive(chainId);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/indexer?chainId=${chainId}`, { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (active) setChainData(data as ChainData);
        }
      } catch (error) {
        console.error(`Failed to load ${chain.name} data:`, error);
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [chainId, chain.name]);

  const listings = useMemo(() => chainData?.listings ?? [], [chainData]);
  const activity = useMemo(() => chainData?.activity ?? [], [chainData]);

  const visibleListings = useMemo(() => {
    const term = query.trim().toLowerCase();
    return listings.filter(item =>
      !term ||
      item.nftAddress.toLowerCase().includes(term) ||
      item.tokenId.includes(term)
    );
  }, [listings, query]);

  const visibleActivity = useMemo(() => {
    return activity.filter(event =>
      event.nftAddress && event.tokenId
    );
  }, [activity]);

  if (!isLive) {
    return (
      <main className="network-marketplace">
        <section className="network-hero">
          <div>
            <span>COMING SOON</span>
            <h1>{chain.name} Marketplace</h1>
            <p>The House of Joshi Marketplace is launching soon on {chain.name}. Stay tuned for announcements.</p>
          </div>
          <a href={chain.explorerUrl} target="_blank" rel="noreferrer">
            Visit {chain.name} Explorer <ExternalLink size={14} />
          </a>
        </section>
        <section className="network-coming-soon">
          <div>
            <h2>What to Expect</h2>
            <ul>
              <li>Real-time NFT listings and marketplace activity</li>
              <li>Secure trading with V7 smart contracts</li>
              <li>Low fees and instant settlements</li>
              <li>Royal black & gold marketplace experience</li>
            </ul>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="network-marketplace">
      <section className="network-hero">
        <div>
          <span>LIVE MARKETPLACE</span>
          <h1>{chain.name} NFT Marketplace</h1>
          <p>Trade NFTs securely on {chain.name} with instant settlements and low fees.</p>
        </div>
        <div className="network-stats">
          <div>
            <span>Active Listings</span>
            <strong>{listings.length}</strong>
          </div>
          <div>
            <span>Recent Activity</span>
            <strong>{activity.length}</strong>
          </div>
          <div>
            <span>Currency</span>
            <strong>{chain.currency}</strong>
          </div>
        </div>
      </section>

      {listings.length > 0 && (
        <section className="network-listings">
          <header>
            <div>
              <span>MARKETPLACE</span>
              <h2>Active Listings</h2>
            </div>
            <div className="collection-view-toggle">
              <button
                className={layout === "grid" ? "active" : ""}
                onClick={() => setLayout("grid")}
                aria-label="Grid view"
              >
                <Grid2X2 size={15} />
              </button>
              <button
                className={layout === "list" ? "active" : ""}
                onClick={() => setLayout("list")}
                aria-label="List view"
              >
                <List size={16} />
              </button>
            </div>
          </header>
          <div className="network-browser">
            <aside aria-label="Filter listings">
              <label>
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contract or token"
                  aria-label="Search contract or token"
                />
              </label>
            </aside>
            <div className={`network-listings-grid ${layout}`}>
              {visibleListings.length ? (
                visibleListings.map((item) => (
                  <ListedNft key={item.id} item={item} chain={chain} />
                ))
              ) : (
                <div className="collection-loading">
                  {loading ? (
                    "Reading confirmed listings…"
                  ) : (
                    <div>
                      <p>
                        {query.trim()
                          ? "No NFTs match your search."
                          : `No active NFT listings on ${chain.name} yet.`}
                      </p>
                      <Link href="/sell">
                        List an NFT <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activity.length > 0 && (
        <section className="network-activity">
          <header>
            <div>
              <span><Flame size={13} /> LIVE ACTIVITY</span>
              <h2>Recent Transactions</h2>
            </div>
            <small>Updates every 30 seconds</small>
          </header>
          <div className="activity-list">
            {visibleActivity.slice(0, 20).map((event) => (
              <ActivityEvent key={event.id} event={event} chain={chain} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ListedNft({ item, chain }: { item: Listing; chain: ReturnType<typeof getMarketplaceChain> }) {
  const [nft, setNft] = useState<NftMetadata | null>(null);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/nft?contract=${item.nftAddress}&tokenId=${item.tokenId}&chainId=${item.chainId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => { if (active) setNft(value as NftMetadata | null); })
      .catch(() => {});
    return () => { active = false; };
  }, [item]);

  return (
    <Link href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}`} className="network-listing">
      <div className="network-listing-art">
        {nft?.imageUrl && !artFailed ? (
          <Image
            src={nft.imageUrl}
            alt={nft.name ?? `NFT #${item.tokenId}`}
            fill
            unoptimized
            sizes="(max-width: 700px) 100vw, 220px"
            style={{ objectFit: "cover" }}
            onError={() => setArtFailed(true)}
          />
        ) : (
          <strong>
            #{item.tokenId}
            <small>Artwork unavailable</small>
          </strong>
        )}
        <span>{chain.name}</span>
      </div>
      <div>
        <small>{nft?.collection ?? item.nftAddress.slice(0, 6) + "…" + item.nftAddress.slice(-4)}</small>
        <h3>{nft?.name ?? `Token #${item.tokenId}`}</h3>
        <p>
          <span>LISTING PRICE</span>
          <strong>{formatEther(BigInt(item.price))} {chain.currency}</strong>
        </p>
        <span>
          View NFT <ArrowUpRight size={13} />
        </span>
      </div>
    </Link>
  );
}

function ActivityEvent({ event, chain }: { event: Activity; chain: ReturnType<typeof getMarketplaceChain> }) {
  const [nft, setNft] = useState<NftMetadata | null>(null);

  useEffect(() => {
    if (!event.nftAddress || !event.tokenId) return;
    let active = true;
    void fetch(`/api/nft?contract=${event.nftAddress}&tokenId=${event.tokenId}&chainId=${event.chainId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => { if (active) setNft(value as NftMetadata | null); })
      .catch(() => {});
    return () => { active = false; };
  }, [event]);

  if (!event.nftAddress || !event.tokenId) return null;

  return (
    <Link
      href={`/nft/${event.chainId}/${event.nftAddress}/${event.tokenId}`}
      className="activity-event"
    >
      <div>
        <small>{chain.name}</small>
        <span className={`event-type ${event.eventType}`}>
          {event.eventType.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div>
        <h3>{nft?.name ?? `Token #${event.tokenId}`}</h3>
        <small>{nft?.collection ?? event.nftAddress.slice(0, 6) + "…" + event.nftAddress.slice(-4)}</small>
      </div>
      <div>
        {event.price && (
          <strong>{formatEther(BigInt(event.price))} {chain.currency}</strong>
        )}
        <a
          href={`${chain.explorerUrl}/tx/${event.id}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          View transaction <ExternalLink size={12} />
        </a>
      </div>
    </Link>
  );
}