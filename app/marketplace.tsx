"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleHelp,
  ExternalLink,
  Gavel,
  Layers3,
  Menu,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  getAddress,
  formatEther,
  parseEther,
} from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import { base, polygon } from "viem/chains";
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { robinhood, shibarium } from "./web3-provider";
import { getMarketplaceChain, isMarketplaceChainId, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";

const marketplaceAbi = [
  {
    type: "function",
    name: "listItem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftAddress", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyItem",
    stateMutability: "payable",
    inputs: [
      { name: "nftAddress", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const erc721Abi = [{
  type: "function",
  name: "approve",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }],
  outputs: [],
}] as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

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
  chainId: MarketplaceChainId;
  chain: string;
  currency: string;
  configured: boolean;
  marketplaceAddress?: `0x${string}`;
  listings: IndexedListing[];
  activity: IndexedActivity[];
  sync: { caughtUp: boolean; syncedThrough: number; safeLatest: number } | null;
  syncError?: string | null;
};

export function Marketplace() {
  const { address: account } = useAccount();
  const chainId = useChainId();
  const selectedChainId: MarketplaceChainId = isMarketplaceChainId(chainId) ? chainId : 109;
  const selectedChain = getMarketplaceChain(selectedChainId);
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [status, setStatus] = useState("");
  const [listings, setListings] = useState<IndexedListing[]>([]);
  const [activity, setActivity] = useState<IndexedActivity[]>([]);
  const [indexerReady, setIndexerReady] = useState<boolean | null>(null);
  const [indexerError, setIndexerError] = useState("");
  const [marketplaceAddress, setMarketplaceAddress] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    let active = true;
    async function loadOnchainData() {
      try {
        await Promise.resolve();
        if (!active) return;
        setIndexerReady(null);
        setListings([]);
        setActivity([]);
        setMarketplaceAddress(null);
        const response = await fetch(`/api/indexer?chainId=${selectedChainId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Indexer API is unavailable");
        const data = await response.json() as IndexerResponse;
        if (!active) return;
        setIndexerReady(data.configured);
        setListings(data.listings);
        setActivity(data.activity);
        setMarketplaceAddress(data.marketplaceAddress ?? null);
        setIndexerError(data.syncError ?? "");
      } catch (error) {
        if (!active) return;
        setIndexerReady(false);
        setIndexerError(error instanceof Error ? error.message : "Indexer API is unavailable");
      }
    }
    void loadOnchainData();
    const refresh = window.setInterval(loadOnchainData, 30_000);
    return () => { active = false; window.clearInterval(refresh); };
  }, [selectedChainId]);

  async function listNft(nftAddress: string, tokenId: string, price: string) {
    if (!account) {
      setStatus("Connect a wallet before presenting a work.");
      return;
    }
    if (!marketplaceAddress) {
      setStatus(`The ${selectedChain.name} marketplace is not deployed or configured yet.`);
      return;
    }
    try {
      const nft = getAddress(nftAddress);
      if (chainId !== selectedChainId) await switchChainAsync({ chainId: selectedChainId });
      setStatus("Step 1 of 2 · Approve the marketplace in your wallet.");
      await writeContractAsync({ address: nft, abi: erc721Abi, functionName: "approve", args: [marketplaceAddress, BigInt(tokenId)], chainId: selectedChainId });
      setStatus("Step 2 of 2 · Sign the listing transaction.");
      const hash = await writeContractAsync({ address: marketplaceAddress, abi: marketplaceAbi, functionName: "listItem", args: [nft, BigInt(tokenId), parseEther(price)], chainId: selectedChainId });
      setShowList(false);
      setStatus(`Listing submitted ${shortAddress(hash)}. It will appear after the indexer confirms it.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Listing was not completed.");
    }
  }

  async function buyListing(listing: IndexedListing) {
    if (!account) {
      setStatus("Connect a wallet before acquiring a work.");
      return;
    }
    if (!marketplaceAddress) {
      setStatus("The marketplace contract address is not configured.");
      return;
    }
    try {
      if (chainId !== listing.chainId) await switchChainAsync({ chainId: listing.chainId });
      setStatus(`Confirm purchase of token #${listing.tokenId} in your wallet.`);
      const hash = await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyItem",
        args: [getAddress(listing.nftAddress), BigInt(listing.tokenId)],
        value: BigInt(listing.price),
        chainId: listing.chainId,
      });
      setStatus(`Purchase submitted ${shortAddress(hash)}. The indexer will update after confirmation.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Purchase was not completed.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="House of Joshi home">
          <Image src="/house-of-joshi.png" alt="House of Joshi" width={42} height={42} className="header-logo"/>
          <span>HOUSE OF JOSHI</span>
        </a>
        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Primary navigation">
          <a href="/market">Market</a>
          <a href="/sell">Sell</a>
          <a href="/activity">Activity</a>
          <a href="/account">Account</a>
          <a href="/protocol">Protocol</a>
        </nav>
        <div className="header-actions">
          <NetworkMenu />
          <button className="present-button" onClick={() => setShowList(true)}>Present a work</button>
          <CourtWalletButton />
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>MULTICHAIN MARKETPLACE</span><span>CURATED · NON-CUSTODIAL · ONCHAIN</span></div>
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="kicker">A marketplace for objects with consequence.</p>
            <h1>THE NFT<br />COURT<br /><em>WITHOUT BORDERS</em></h1>
            <p className="lede">Discover, acquire, and present singular works across Shibarium, Polygon, Base, and Robinhood—one court, with provenance written onchain.</p>
            <div className="hero-actions">
              <a className="primary-action" href="/market">Enter the market <ArrowDownRight size={18} /></a>
              <a className="text-action" href="/protocol">Read the court notes <ArrowUpRight size={16} /></a>
            </div>
          </div>
          <div className="hero-art" aria-label="Abstract faceted marketplace artwork">
            <div className="artifact artifact-hero"><div className="facet one" /><div className="facet two" /><div className="facet three" /><span className="glow" /></div>
          </div>
        </div>
        <NetworkRail />
        <div className="proof-strip">
          <div><strong>ERC-721</strong><span>Asset standard</span></div>
          <div><strong>4</strong><span>Supported networks</span></div>
          <div><strong>NATIVE</strong><span>BONE · POL · ETH</span></div>
          <div className="verified"><ShieldCheck /><span><b>Chain-specific settlement</b>Every sale resolves on its origin network</span></div>
        </div>
      </section>

      <section className="market-section" id="market">
        <div className="section-heading">
          <div><span className="section-no">01 / MARKET</span><h2>WORKS BEFORE<br />THE COURT</h2></div>
          <p>Browse by network without mixing currencies or provenance. Shibarium is live; Polygon, Base, and Robinhood open as their marketplace deployments are indexed.</p>
        </div>
        {listings.length > 0 ? <div className="indexed-lots" id="collections">{listings.map((listing) => <IndexedListingCard key={listing.id} listing={listing} connected={!!account} onBuy={buyListing} />)}</div> : <div className="empty-market" id="collections">
          <span className="empty-index">{indexerReady === null ? `SYNCING ${selectedChain.name.toUpperCase()}` : indexerReady ? "NO ACTIVE LISTINGS" : `${selectedChain.name.toUpperCase()} DEPLOYMENT NEEDED`}</span>
          <h3>{indexerReady === null ? <>Reading the<br />onchain record.</> : indexerReady ? <>The court is awaiting<br />its first presentation.</> : <>Connect the contract<br />to open the court.</>}</h3>
          <p>{indexerError || (indexerReady ? "No active marketplace listings were found in the confirmed event record." : "Listings will appear only after the deployed marketplace address and block are configured.")}</p>
          <button onClick={() => setShowList(true)}>Present a work <ArrowUpRight size={16} /></button>
        </div>}
      </section>

      <section className="manifesto" id="about">
        <span className="section-no">02 / THE RECORD</span>
        <blockquote>“Ownership should be obvious.<br />Provenance should be permanent.<br /><em>The work should speak first.</em>”</blockquote>
        <div className="manifesto-notes"><p>House of Joshi is a non-custodial venue. The marketplace never holds your work; approved transfers settle directly between collector and owner.</p><div className="settlement-mark"><Gavel /><span>ONE COURT<br /><b>FOUR CHAINS</b></span></div></div>
      </section>

      <section className="activity-section" id="activity">
        <span className="section-no">03 / RECENT JUDGMENTS</span>
        {activity.length > 0 ? <div className="activity-list">{activity.map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <div className="empty-activity"><span>{indexerReady === null ? "Synchronizing confirmed blocks." : "No indexed activity yet."}</span><p>Verified listing, sale, cancellation, and withdrawal events will appear here.</p></div>}
      </section>

      <footer>
        <div className="footer-brand"><Image src="/house-of-joshi.png" alt="House of Joshi" width={36} height={36} className="footer-logo"/><strong>HOUSE OF JOSHI</strong><p>An independent marketplace for considered digital works across four EVM networks.</p></div>
        <div><span className="footer-label">NETWORKS</span><a href="https://shibariumscan.io" target="_blank" rel="noreferrer">Shibarium <ExternalLink size={13} /></a><a href="https://polygonscan.com" target="_blank" rel="noreferrer">Polygon <ExternalLink size={13} /></a><a href="https://basescan.org" target="_blank" rel="noreferrer">Base <ExternalLink size={13} /></a><a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">Robinhood <ExternalLink size={13} /></a><span>Protocol fee 2%</span></div>
        <div><span className="footer-label">COURT</span><a href="/market">Market</a><a href="/sell">Sell</a><a href="/activity">Activity</a><a href="/account">Account</a><a href="/faq">FAQ</a><a href="/about">About</a></div>
        <div><span className="footer-label">HOUSE ECOSYSTEM</span><a href="https://kingdomwithin.thehouseofjoshi.com/" target="_blank" rel="noreferrer">Kingdom Within</a><a href="https://swap.thehouseofjoshi.com/" target="_blank" rel="noreferrer">HOJ Swap</a><a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noreferrer">NFT Launchpad</a><a href="https://dreamweaver.thehouseofjoshi.com/" target="_blank" rel="noreferrer">Dreamweaver</a></div>
        <div><span className="footer-label">CONNECT</span><a href="/contact">Contact</a><a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer">X</a><a href="https://discord.com/invite/uH9zVeAwDu" target="_blank" rel="noreferrer">Discord</a><a href="https://www.instagram.com/thehouseofjoshi" target="_blank" rel="noreferrer">Instagram</a></div>
        <p className="copyright">© 2026 The House of Joshi. All rights reserved. · <a href="/terms">Terms &amp; Conditions</a> · <a href="/privacy">Privacy Policy</a></p>
      </footer>

      {status && <div className="toast" role="status"><CircleHelp size={18} /><span>{status}</span><button onClick={() => setStatus("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {showList && <ListingPanel onClose={() => setShowList(false)} onSubmit={listNft} account={account ?? null} chainId={selectedChainId} configured={!!marketplaceAddress} />}
    </main>
  );
}

const networkOptions = [
  { id: shibarium.id, name: "Shibarium", currency: "BONE", state: "MARKET LIVE", tone: "shibarium" },
  { id: polygon.id, name: "Polygon", currency: "POL", state: "WALLET READY", tone: "polygon" },
  { id: base.id, name: "Base", currency: "ETH", state: "WALLET READY", tone: "base" },
  { id: robinhood.id, name: "Robinhood", currency: "ETH", state: "WALLET READY", tone: "robinhood" },
] as const;

function NetworkMenu() {
  return <ConnectButton.Custom>{({ chain, openChainModal, mounted }) =>
    <button className="network network-menu" onClick={openChainModal} type="button" aria-label="Choose network">
      <i className={mounted && chain ? `chain-dot chain-${chain.id}` : "chain-dot"} />
      <span>{mounted && chain ? chain.name : "Networks"}</span>
      <span className="network-chevron">⌄</span>
    </button>
  }</ConnectButton.Custom>;
}

function NetworkRail() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  return <section className="network-rail" aria-label="Supported networks">
    <div className="network-rail-intro"><Layers3 size={18} /><span>CHOOSE<br />YOUR COURT</span></div>
    {networkOptions.map((network) => <button
      type="button"
      key={network.id}
      className={`network-card ${network.tone} ${chainId === network.id ? "active" : ""}`}
      onClick={() => switchChain({ chainId: network.id })}
    >
      <span className="network-mark" aria-hidden="true" />
      <span className="network-card-copy"><small>{network.state}</small><strong>{network.name}</strong><em>Chain {network.id} · {network.currency}</em></span>
      <ArrowUpRight size={16} />
    </button>)}
  </section>;
}

function IndexedListingCard({ listing, connected, onBuy }: { listing: IndexedListing; connected: boolean; onBuy: (listing: IndexedListing) => void }) {
  const price = formatEther(BigInt(listing.price));
  const chain = getMarketplaceChain(listing.chainId);
  return <article className="indexed-card">
    <div className="indexed-art"><span>ERC-721</span><strong>#{listing.tokenId}</strong><i>{shortAddress(listing.nftAddress)}</i></div>
    <div className="indexed-meta">
      <span className="collection-address">{shortAddress(listing.nftAddress)}</span>
      <h3>Token #{listing.tokenId}</h3>
      <p>Owner · {shortAddress(listing.seller)}</p>
      <div className="indexed-price"><span>ASKING · {chain.name}</span><strong>{price} <i>{chain.currency}</i></strong></div>
      {connected ? <button onClick={() => onBuy(listing)}>Acquire <ArrowUpRight size={15} /></button> : <ConnectButton.Custom>{({ openConnectModal }) => <button onClick={openConnectModal}>Connect to acquire <Wallet size={15} /></button>}</ConnectButton.Custom>}
    </div>
  </article>;
}

function ActivityRow({ item }: { item: IndexedActivity }) {
  const subject = item.nftAddress && item.tokenId ? `${shortAddress(item.nftAddress)} · #${item.tokenId}` : item.seller ? shortAddress(item.seller) : "Marketplace";
  const participant = item.buyer ?? item.seller;
  const chain = getMarketplaceChain(item.chainId);
  return <a className="activity-row" href={transactionUrl(item.chainId, item.transactionHash)} target="_blank" rel="noreferrer">
    <span className={`activity-type ${item.eventType}`}>{item.eventType.toUpperCase()}</span>
    <span>{subject}</span>
    <span className="mono">{participant ? shortAddress(participant) : "Onchain"}</span>
    <strong>{item.price ? `${formatEther(BigInt(item.price))} ${chain.currency}` : "—"}</strong>
    <span>Block {item.blockNumber}</span>
  </a>;
}

function CourtWalletButton() {
  return <ConnectButton.Custom>{({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
    const connected = mounted && account && chain;
    if (!connected) return <button className="wallet-button" onClick={openConnectModal}>Enter the court</button>;
    if (chain.unsupported) return <button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>;
    return <button className="wallet-button" onClick={openAccountModal}><Wallet size={15} /> {account.displayName}</button>;
  }}</ConnectButton.Custom>;
}

function ListingPanel({ onClose, onSubmit, account, chainId, configured }: { onClose: () => void; onSubmit: (nft: string, tokenId: string, price: string) => void; account: string | null; chainId: MarketplaceChainId; configured: boolean }) {
  const [nft, setNft] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("");
  const valid = /^0x[a-fA-F0-9]{40}$/.test(nft) && /^\d+$/.test(tokenId) && Number(price) > 0;
  const chain = getMarketplaceChain(chainId);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="purchase-panel listing-panel" role="dialog" aria-modal="true" aria-label="Present a work">
      <button className="close-button" onClick={onClose} aria-label="Close"><X /></button>
      <span className="section-no">NEW PRESENTATION / {chain.name.toUpperCase()} / ERC-721</span>
      <h2>Present a work</h2>
      <p className="listing-intro">Enter the onchain details of a work you own. You will approve the marketplace, then sign the listing.</p>
      <label className="field"><span>NFT contract address</span><input value={nft} onChange={(e) => setNft(e.target.value)} placeholder="0x…" autoComplete="off" /></label>
      <div className="field-row"><label className="field"><span>Token ID</span><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="Enter token ID" inputMode="numeric" /></label><label className="field"><span>Price in {chain.currency}</span><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Enter amount" inputMode="decimal" /></label></div>
      <div className="listing-check"><ShieldCheck /><div><strong>Non-custodial by design</strong><p>Your NFT stays in your wallet until a collector buys it. Revoking approval invalidates the listing.</p></div></div>
      <p className="fee-disclosure">The listed price is the buyer’s total. A fixed 2% marketplace fee and any ERC-2981 creator royalty are deducted from seller proceeds at settlement.</p>
      {account ? <button className="confirm-buy" disabled={!configured || !valid} onClick={() => onSubmit(nft, tokenId, price)}>{configured ? "Approve & present" : `Deploy on ${chain.name} first`} <ArrowUpRight /></button> : <ConnectButton.Custom>{({ openConnectModal }) => <button className="confirm-buy" onClick={openConnectModal}>Connect wallet first <Wallet /></button>}</ConnectButton.Custom>}
    </section>
  </div>;
}
