"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  Gavel,
  Layers3,
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

  const soldActivity = activity.filter((item) => item.eventType === "sold");
  const totalVolume = soldActivity.reduce((sum, item) => sum + BigInt(item.price ?? "0"), 0n);
  const recentListings = listings.slice(0, 5);
  const recentSales = soldActivity.slice(0, 5);

  return (
    <main className="court-dashboard">
      <section className="court-welcome">
        <div><span>VERIFIED · CURATED · ONCHAIN</span><h1>Welcome to the Court</h1><p>Discover, collect, and present exceptional NFTs across multiple chains. Every listing below comes from the confirmed onchain record.</p></div>
        <div className="court-welcome-mark" aria-hidden="true"><Gavel/></div>
      </section>

      <NetworkRail />

      <div className="court-dashboard-grid">
        <section className="court-live-panel">
          <div className="court-panel-heading"><div><span>ACTIVE WORKS</span><small>{selectedChain.name}</small></div><a href="/market">View all <ArrowUpRight size={13}/></a></div>
          {listings.length > 0?<div className="court-dashboard-cards">{listings.slice(0,3).map(listing=><IndexedListingCard key={listing.id} listing={listing} connected={!!account} onBuy={buyListing}/>)}</div>:<div className="court-dashboard-empty"><strong>{indexerReady===null?"Synchronizing the court.":indexerReady?"No active works are listed.":`${selectedChain.name} marketplace is not configured.`}</strong><p>{indexerError||(indexerReady?"New verified listings will appear here after confirmation.":"Deploy and configure the marketplace contract to activate this network.")}</p><button onClick={()=>setShowList(true)}>Present a work <ArrowUpRight size={14}/></button></div>}
        </section>

        <aside className="court-status-panel">
          <div className="court-panel-heading"><span>COURT STATUS</span></div>
          <dl><div><dt>Marketplace</dt><dd>{indexerReady===null?"Syncing":indexerReady?"Live":"Not configured"}</dd></div><div><dt>Active listings</dt><dd>{listings.length}</dd></div><div><dt>Confirmed sales</dt><dd>{soldActivity.length}</dd></div><div><dt>Recorded volume</dt><dd>{formatEther(totalVolume)} {selectedChain.currency}</dd></div></dl>
        </aside>

        <section className="court-record-panel">
          <div className="court-panel-heading"><span>RECENT LISTINGS</span><a href="/activity">View activity <ArrowUpRight size={13}/></a></div>
          {recentListings.length?<div className="court-record-table"><div className="court-record-head"><span>ITEM</span><span>SELLER</span><span>PRICE</span><span>BLOCK</span></div>{recentListings.map(item=><a key={item.id} href={transactionUrl(item.chainId,item.transactionHash)} target="_blank" rel="noreferrer"><span><b>#{item.tokenId}</b><small>{shortAddress(item.nftAddress)}</small></span><span>{shortAddress(item.seller)}</span><strong>{formatEther(BigInt(item.price))} {selectedChain.currency}</strong><span>{item.updatedBlock}</span></a>)}</div>:<div className="court-compact-empty">No confirmed listings yet.</div>}
        </section>

        <aside className="court-side-stack">
          <section className="court-network-panel"><div className="court-panel-heading"><span>NETWORK STATUS</span></div>{networkOptions.map(network=><div key={network.id}><i className={network.tone}/><span>{network.name}</span><small>{network.id===selectedChainId?(indexerReady?"Marketplace live":"Selected"):"Supported"}</small></div>)}</section>
          <section className="court-sales-panel"><div className="court-panel-heading"><span>RECENT SALES</span></div>{recentSales.length?recentSales.map(item=><a key={item.id} href={transactionUrl(item.chainId,item.transactionHash)} target="_blank" rel="noreferrer"><span>#{item.tokenId}</span><strong>{formatEther(BigInt(item.price??"0"))} {selectedChain.currency}</strong></a>):<p>No confirmed sales yet.</p>}</section>
        </aside>
      </div>

      {status && <div className="toast" role="status"><CircleHelp size={18} /><span>{status}</span><button onClick={() => setStatus("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {showList && <ListingPanel onClose={() => setShowList(false)} onSubmit={listNft} account={account ?? null} chainId={selectedChainId} configured={!!marketplaceAddress} />}
    </main>
  );
}

const networkOptions = [
  { id: shibarium.id, name: "Shibarium", currency: "BONE", state: "MARKET LIVE", tone: "shibarium" },
  { id: 1, name: "Ethereum", currency: "ETH", state: "WALLET READY", tone: "ethereum" },
  { id: polygon.id, name: "Polygon", currency: "POL", state: "WALLET READY", tone: "polygon" },
  { id: base.id, name: "Base", currency: "ETH", state: "WALLET READY", tone: "base" },
  { id: robinhood.id, name: "Robinhood", currency: "ETH", state: "WALLET READY", tone: "robinhood" },
] as const;

function NetworkRail() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  return <ConnectButton.Custom>{({account,openConnectModal})=><section className="network-rail" aria-label="Supported networks">
      <div className="network-rail-intro"><Layers3 size={18} /><span>SELECT<br />NETWORK</span></div>
      {networkOptions.map((network) => <button
        type="button"
        key={network.id}
        className={`network-card ${network.tone} ${account && chainId === network.id ? "active" : ""}`}
        onClick={() => account ? switchChain({ chainId: network.id }) : openConnectModal()}
      >
        <span className="network-mark" aria-hidden="true" />
        <span className="network-card-copy"><small>{account ? network.state : "CONNECT WALLET"}</small><strong>{network.name}</strong><em>Chain {network.id} · {network.currency}</em></span>
        <ArrowUpRight size={16} />
      </button>)}
    </section>}</ConnectButton.Custom>;
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
