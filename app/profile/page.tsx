"use client";

import { WalletOffers } from "../components/offers-panel";

import { Sparkles, Wallet, TrendingUp, Activity, Gift, ExternalLink, ImageIcon, ArrowUpRight, Mail, Bell } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import Image from "next/image";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

type WalletNft = {
  contractAddress: string;
  tokenId: string;
  tokenType?: string;
  quantity?: string;
  name: string | null;
  collection: string | null;
  imageUrl: string | null;
  description: string | null;
  externalUrl: string | null;
  explorerUrl?: string;
  traits: Array<{ type: string; value: string }>;
  chainId?: number;
};

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
  configured?: boolean;
  syncError?: string | null;
};

type WalletNftResponse = {
  complete?: boolean;
  nfts?: WalletNft[];
  error?: string;
  warnings?: string[];
  explorerAddressUrl?: string;
};

type ExplorerFallback = {
  chainId: MarketplaceChainId;
  chainName: string;
  url: string;
  reason: string;
};

function NftArtwork({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="royal-nft-image">
    {imageUrl && !failed
      ? <Image src={imageUrl} alt={name} width={320} height={320} unoptimized loading="lazy" onError={() => setFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      : <div className="royal-nft-artwork-fallback"><ImageIcon size={30} aria-hidden="true" /><span>Artwork unavailable</span></div>}
  </div>;
}

export default function ProfilePage() {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const [activeTab, setActiveTab] = useState<"portfolio" | "listings" | "offers" | "created" | "activity" | "notifications">("portfolio");
  const [statusFilter, setStatusFilter] = useState<"all" | "listed" | "not-listed">("all");
  const [walletNfts, setWalletNfts] = useState<WalletNft[]>([]);
  const [listings, setListings] = useState<IndexedListing[]>([]);
  const [activity, setActivity] = useState<IndexedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState<MarketplaceChainId | "all" | "wallet">("all");
  const [explorerFallbacks, setExplorerFallbacks] = useState<ExplorerFallback[]>([]);
  const [retry, setRetry] = useState(0);
  const [notificationSettings, setNotificationSettings] = useState({
    email: "",
    emailEnabled: false,
    salesEnabled: true,
    offersEnabled: true
  });

  useEffect(() => {
    if (!address) return;
    let active = true;
    const controller = new AbortController();
    
    async function loadWalletData() {
      if (!address) return;
      
      setLoading(true);
      try {
        // Load notification settings
        try {
          const settingsKey = `hoj:notification-settings:${address.toLowerCase()}`;
          const storedSettings = localStorage.getItem(settingsKey);
          if (storedSettings) {
            setNotificationSettings(JSON.parse(storedSettings));
          }
        } catch (error) {
          console.error("Failed to load notification settings:", error);
        }
        // Show holdings across networks by default, with Shibarium first.
        let chainIds: MarketplaceChainId[] = [];
        if (selectedChain === "all") {
          // Load Shibarium first, then other chains
          const allChains = Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[];
          const shibariumChain = allChains.find(id => id === 109);
          const otherChains = allChains.filter(id => id !== 109);
          chainIds = shibariumChain ? [shibariumChain, ...otherChains] : allChains;
        } else if (selectedChain === "wallet") {
          chainIds = walletChainId in marketplaceChains ? [walletChainId as MarketplaceChainId] : [109];
        } else {
          chainIds = [selectedChain];
        }

        // Keep requests below provider rate limits; a single network failure
        // must not prevent already-fetched holdings on other networks.
        const nftResponses: PromiseSettledResult<WalletNftResponse>[] = [];
        for(let offset=0;offset<chainIds.length;offset+=3){
          const batch=await Promise.allSettled(chainIds.slice(offset,offset+3).map(async chainId=>{
            const response=await fetch(`/api/wallet-nfts?owner=${encodeURIComponent(address)}&chainId=${chainId}`,{cache:"no-store",signal:controller.signal});
            const data=await response.json() as WalletNftResponse;
            if(!response.ok&&!data.error)throw new Error(`${getMarketplaceChain(chainId).name} holdings service returned ${response.status}.`);
            return data;
          }));
          nftResponses.push(...batch);
          if(!active)return;
        }
        if (!active) return;

        const allNfts: WalletNft[] = [];
        const failedExplorers: ExplorerFallback[] = [];
        nftResponses.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            const data = result.value as WalletNftResponse;
            if (data.nfts && data.nfts.length > 0) {
              // Add chainId to each NFT from the response
              const chainId = chainIds[index];
              allNfts.push(...data.nfts.map(nft => ({ ...nft, chainId })));
            }
            if (data.complete === false || data.error) {
              const reason=data.error??data.warnings?.join("; ")??"The NFT provider could not verify the full wallet history.";
              failedExplorers.push({
                chainId: chainIds[index],
                chainName: getMarketplaceChain(chainIds[index]).name,
                url: data.explorerAddressUrl ?? `${getMarketplaceChain(chainIds[index]).explorerUrl}/address/${address}`,
                reason,
              });
            }
          } else if (result.status === "rejected") {
            console.error(`Failed to load NFTs from chain ${chainIds[index]}:`, result.reason);
            failedExplorers.push({
              chainId: chainIds[index],
              chainName: getMarketplaceChain(chainIds[index]).name,
              url: `${getMarketplaceChain(chainIds[index]).explorerUrl}/address/${address}`,
              reason: "The network request failed. Retry this network or use its explorer while the provider recovers.",
            });
          }
        });

        setWalletNfts(allNfts);
        setExplorerFallbacks(failedExplorers);
        setLoading(false);

        // Load listings and activity from selected chain
        const listingResponses = await Promise.allSettled(
          chainIds.map(async chainId => {
            const res = await fetch(`/api/indexer?chainId=${chainId}`, { cache: "no-store", signal: controller.signal });
            return res.ok ? (await res.json()) as IndexerResponse : null;
          })
        );
        if (!active) return;

        const allListings: IndexedListing[] = [];
        const allActivity: IndexedActivity[] = [];

        listingResponses.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            const data = result.value as IndexerResponse;
            allListings.push(...(data.listings || []));
            allActivity.push(...(data.activity || []));
          }
        });

        // Filter listings for this wallet
        const myListings = allListings.filter(l => l.seller.toLowerCase() === address.toLowerCase());
        setListings(myListings);
        setActivity(allActivity.filter(a => 
          (a.seller?.toLowerCase() === address.toLowerCase() || a.buyer?.toLowerCase() === address.toLowerCase())
        ));

      } catch (error) {
        if (active) console.error("Failed to load wallet data:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWalletData();
    return () => { active = false; controller.abort(); };
  }, [address, selectedChain, walletChainId, retry]);

  const filteredNfts = walletNfts.filter(nft => {
    const isListed = listings.some(l => 
      l.chainId === nft.chainId &&
      l.nftAddress.toLowerCase() === nft.contractAddress.toLowerCase() && 
      l.tokenId === nft.tokenId
    );
    
    if (statusFilter === "listed") return isListed;
    if (statusFilter === "not-listed") return !isListed;
    return true;
  });

  const activeListingChain = selectedChain === "wallet" && walletChainId in marketplaceChains ? walletChainId as MarketplaceChainId : selectedChain;
  const filteredListings = activeListingChain === "all" 
    ? listings 
    : listings.filter(l => l.chainId === activeListingChain);

  if (!address) {
    return (
      <main className="royal-page">
        <section className="royal-page-hero">
          <div className="royal-badge">
            <Wallet size={16} />
            <span>Profile</span>
          </div>
          <h1>Your Royal Profile</h1>
          <p>Connect your wallet to view your profile and manage your NFTs.</p>
        </section>

        <section className="royal-content">
          <div className="royal-empty-state">
            <Wallet size={48} />
            <h2>Connect Your Wallet</h2>
            <p>Connect your wallet to view your profile and manage your NFTs.</p>
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button onClick={openConnectModal} className="royal-primary-button royal-profile-connect-button">
                  Connect Wallet
                  <Wallet size={18} />
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="royal-page">
      <section className="royal-profile-header">
        <div className="royal-profile-info">
          <div className="royal-wallet-address">
            <Wallet size={20} />
            <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
          </div>
          <Link href="/wallet" className="hoj-profile-withdraw-link">View withdrawable balance <ArrowUpRight size={15}/></Link>
          <div className="royal-portfolio-value">
            <span>Wallet status</span>
            <strong>Connected</strong>
          </div>
        </div>
        <div className="royal-profile-stats">
          <div>
            <strong>{walletNfts.length}</strong>
            <span>NFTs</span>
          </div>
          <div>
            <strong>{listings.length}</strong>
            <span>Listed</span>
          </div>
          <div>
            <strong>{activity.length}</strong>
            <span>Activity</span>
          </div>
        </div>
      </section>

      <section className="royal-profile-tabs">
        <button 
          className={activeTab === "portfolio" ? "active" : ""} 
          onClick={() => setActiveTab("portfolio")}
        >
          Portfolio
        </button>
        <button 
          className={activeTab === "listings" ? "active" : ""} 
          onClick={() => setActiveTab("listings")}
        >
          Listings
        </button>
        <button 
          className={activeTab === "offers" ? "active" : ""} 
          onClick={() => setActiveTab("offers")}
        >
          Offers
        </button>
        <button 
          className={activeTab === "created" ? "active" : ""} 
          onClick={() => setActiveTab("created")}
        >
          Created
        </button>
        <button 
          className={activeTab === "activity" ? "active" : ""} 
          onClick={() => setActiveTab("activity")}
        >
          Activity
        </button>
        <button 
          className={activeTab === "notifications" ? "active" : ""} 
          onClick={() => setActiveTab("notifications")}
        >
          <Bell size={16} /> Notifications
        </button>
      </section>

      <section className="royal-profile-filters">
        <div className="royal-filter-group">
          <span>Holdings network</span>
          <select 
            value={selectedChain} 
            onChange={(e) => setSelectedChain(e.target.value === "all" || e.target.value === "wallet" ? e.target.value : Number(e.target.value) as MarketplaceChainId)}
          >
            <option value="wallet">Wallet network</option>
            <option value="all">All Networks</option>
            {Object.entries(marketplaceChains).map(([id, chain]) => (
              <option key={id} value={id}>{chain.name}{chain.marketplaceStatus==="live"?"":" · Trading soon"}</option>
            ))}
          </select>
        </div>
        <div className="royal-filter-group">
          <span>Status</span>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as "all" | "listed" | "not-listed")}
          >
            <option value="all">All</option>
            <option value="listed">Listed</option>
            <option value="not-listed">Not Listed</option>
          </select>
        </div>
      </section>

      <section className="royal-profile-content">
        {explorerFallbacks.length > 0 && (
          <div className="royal-explorer-fallbacks" role="status">
            <div>
              <strong>Holdings could not be fully verified on {explorerFallbacks.map(item=>item.chainName).join(", ")}</strong>
              <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}>{loading ? "Retrying…" : "Retry missing networks"}</button>
              <p>NFTs we found are shown below. Missing items may appear after the provider recovers; this warning does not mean your wallet is empty.</p>
            </div>
            <div className="royal-explorer-links">
              {explorerFallbacks.map((fallback) => (
                <a key={fallback.chainId} href={fallback.url} target="_blank" rel="noreferrer">
                  {fallback.chainName} · View on explorer
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ))}
            </div>
            <ul>{explorerFallbacks.map(fallback=><li key={fallback.chainId}><strong>{fallback.chainName}:</strong> {fallback.reason}</li>)}</ul>
          </div>
        )}
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === "portfolio" && (
              <div className="royal-portfolio-grid">
                {filteredNfts.length > 0 ? (
                  filteredNfts.map((nft) => {
                    const nftChainId = nft.chainId || 109; // Default to Shibarium if not set
                    const activeListing=listings.find(l=>l.chainId===nftChainId&&l.nftAddress.toLowerCase()===nft.contractAddress.toLowerCase()&&l.tokenId===nft.tokenId);
                    return (
                      <Link key={`${nftChainId}-${nft.contractAddress}-${nft.tokenId}`} href={`/nft/${nftChainId}/${nft.contractAddress}/${nft.tokenId}?from=profile`} className="royal-profile-nft">
                        <NftArtwork key={nft.imageUrl ?? "no-image"} imageUrl={nft.imageUrl} name={nft.name || `Token #${nft.tokenId}`} />
                        <div className="royal-nft-details">
                          <small>{getMarketplaceChain(nftChainId).name} · {nft.collection || `${nft.contractAddress.slice(0, 8)}…`}</small>
                          <h3>{nft.name || `Token #${nft.tokenId}`}</h3>
                          <div className="royal-nft-status">
                            {activeListing ? (
                              <span className="listed">Listed · {formatEther(BigInt(activeListing.price))} {getMarketplaceChain(nftChainId).currency}</span>
                            ) : (
                              <span className="not-listed">Not Listed</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="royal-empty-state">
                    <ImageIcon size={48} />
                    <h2>No NFTs Found</h2>
                    <p>Try adjusting your filters or connect a different wallet.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "listings" && (
              <div className="royal-listings-grid">
                {filteredListings.length > 0 ? (
                  filteredListings.map((listing) => {
                    const chain = getMarketplaceChain(listing.chainId);
                    return (
                      <div key={listing.id} className="royal-listing-card">
                        <div className="royal-listing-price">
                          <span>Price</span>
                          <strong>{formatEther(BigInt(listing.price))} {chain.currency}</strong>
                        </div>
                        <div className="royal-listing-details">
                          <small>{chain.name}</small>
                          <h3>#{listing.tokenId}</h3><Link href={`/nft/${listing.chainId}/${listing.nftAddress}/${listing.tokenId}?from=profile`}>Manage listing</Link>
                          <p>{listing.nftAddress.slice(0, 8)}…</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="royal-empty-state">
                    <ImageIcon size={48} />
                    <h2>No Active Listings</h2>
                    <p>List your NFTs to see them here.</p>
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
                          {item.eventType === "listed" && <Gift size={16} />}
                          {item.eventType === "canceled" && <Activity size={16} />}
                        </div>
                        <div className="royal-activity-content">
                          <span className="royal-activity-type">{item.eventType.toUpperCase()}</span>
                          <h3>{item.nftAddress ? `Token #${item.tokenId}` : "Marketplace"}</h3>
                          <p>{item.price ? `${formatEther(BigInt(item.price))} ${chain.currency}` : "—"}</p>
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
                    <h2>No Activity Yet</h2>
                    <p>Your marketplace activity will appear here.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "offers" && <WalletOffers/>}

            {activeTab === "created" && (
              <div className="royal-empty-state">
                <Sparkles size={64} />
                <h2>No Created NFTs</h2>
                <p>NFTs you create will appear here.</p>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="royal-notifications-section">
                <div className="royal-email-settings">
                  <h3><Mail size={20} /> Email Notifications</h3>
                  <p>Receive email notifications when your NFTs are sold or when you receive offers.</p>
                  
                  <div className="royal-notification-inputs">
                    <label>
                      <span>Email Address</span>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={notificationSettings.email}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </label>
                    
                    <label className="royal-notification-toggle">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailEnabled}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailEnabled: e.target.checked }))}
                      />
                      <span>Enable email notifications</span>
                    </label>
                    
                    <label className="royal-notification-toggle">
                      <input
                        type="checkbox"
                        checked={notificationSettings.salesEnabled}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, salesEnabled: e.target.checked }))}
                      />
                      <span>Notify me when my NFTs sell</span>
                    </label>
                    
                    <label className="royal-notification-toggle">
                      <input
                        type="checkbox"
                        checked={notificationSettings.offersEnabled}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, offersEnabled: e.target.checked }))}
                      />
                      <span>Notify me about new offers</span>
                    </label>
                  </div>
                  
                  <button 
                    className="royal-primary-button"
                    onClick={async () => {
                      try {
                        // Save to localStorage
                        const settingsKey = `hoj:notification-settings:${address.toLowerCase()}`;
                        const settingsToSave = {
                          ...notificationSettings,
                          updatedAt: new Date().toISOString()
                        };
                        localStorage.setItem(settingsKey, JSON.stringify(settingsToSave));
                        
                        // Also save to API for future database integration
                        const response = await fetch('/api/notifications/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            walletAddress: address,
                            ...notificationSettings
                          })
                        });
                        
                        if (response.ok) {
                          alert('Notification settings saved successfully!');
                        } else {
                          alert('Notification settings saved locally (API failed).');
                        }
                      } catch (error) {
                        console.error('Failed to save notification settings:', error);
                        alert('Failed to save notification settings.');
                      }
                    }}
                  >
                    Save Notification Settings
                  </button>
                </div>
                
                <div className="royal-notification-info">
                  <h3><Bell size={20} /> Notification Information</h3>
                  <ul>
                    <li><strong>Sale Notifications:</strong> You'll receive an email when your listed NFT is sold</li>
                    <li><strong>Offer Notifications:</strong> Get notified when someone makes an offer on your NFT</li>
                    <li><strong>Transaction Details:</strong> Each email includes price, buyer, and transaction links</li>
                    <li><strong>Privacy:</strong> Your email is only used for marketplace notifications</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
