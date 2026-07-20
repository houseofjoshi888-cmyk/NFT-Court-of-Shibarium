"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleHelp,
  ExternalLink,
  Gavel,
  Menu,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  getAddress,
  parseEther,
} from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { shibarium } from "./web3-provider";

const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}` | undefined;

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

export function Marketplace() {
  const { address: account } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [status, setStatus] = useState("");

  async function listNft(nftAddress: string, tokenId: string, price: string) {
    if (!account) {
      setStatus("Connect a wallet before presenting a work.");
      return;
    }
    if (!marketplaceAddress) {
      setStatus("The marketplace contract address is not configured yet. Add the Puppynet deployment address to enable listing.");
      return;
    }
    try {
      const nft = getAddress(nftAddress);
      if (chainId !== shibarium.id) await switchChainAsync({ chainId: shibarium.id });
      setStatus("Step 1 of 2 · Approve the marketplace in your wallet.");
      await writeContractAsync({ address: nft, abi: erc721Abi, functionName: "approve", args: [marketplaceAddress, BigInt(tokenId)], chainId: shibarium.id });
      setStatus("Step 2 of 2 · Sign the listing transaction.");
      const hash = await writeContractAsync({ address: marketplaceAddress, abi: marketplaceAbi, functionName: "listItem", args: [nft, BigInt(tokenId), parseEther(price)], chainId: shibarium.id });
      setShowList(false);
      setStatus(`Listing submitted ${shortAddress(hash)}. It will appear after the indexer confirms it.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Listing was not completed.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="House of Joshi home">
          <span className="sigil">HJ</span>
          <span>HOUSE OF JOSHI</span>
        </a>
        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Primary navigation">
          <a href="#market">Market</a>
          <a href="#collections">Collections</a>
          <a href="#activity">Activity</a>
          <a href="#about">Court notes</a>
        </nav>
        <div className="header-actions">
          <span className="network"><i /> Shibarium · 109</span>
          <button className="present-button" onClick={() => setShowList(true)}>Present a work</button>
          <CourtWalletButton />
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>SHIBARIUM NETWORK</span><span>CURATED · NON-CUSTODIAL · ONCHAIN</span></div>
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="kicker">A marketplace for objects with consequence.</p>
            <h1>THE NFT<br />COURT OF<br /><em>SHIBARIUM</em></h1>
            <p className="lede">Discover, acquire, and present singular works on Shibarium. Final settlement in BONE, with provenance written onchain.</p>
            <div className="hero-actions">
              <a className="primary-action" href="#market">Enter the market <ArrowDownRight size={18} /></a>
              <a className="text-action" href="#about">Read the court notes <ArrowUpRight size={16} /></a>
            </div>
          </div>
          <div className="hero-art" aria-label="Abstract faceted marketplace artwork">
            <div className="artifact artifact-hero"><div className="facet one" /><div className="facet two" /><div className="facet three" /><span className="glow" /></div>
          </div>
        </div>
        <div className="proof-strip">
          <div><strong>ERC-721</strong><span>Asset standard</span></div>
          <div><strong>BONE</strong><span>Native settlement</span></div>
          <div><strong>109</strong><span>Shibarium chain</span></div>
          <div className="verified"><ShieldCheck /><span><b>Verified settlement</b>Every sale resolves on Shibarium</span></div>
        </div>
      </section>

      <section className="market-section" id="market">
        <div className="section-heading">
          <div><span className="section-no">01 / MARKET</span><h2>WORKS BEFORE<br />THE COURT</h2></div>
          <p>Verified active ERC-721 listings will be shown here when the onchain index is connected.</p>
        </div>
        <div className="empty-market" id="collections">
          <span className="empty-index">NO LIVE LISTINGS</span>
          <h3>The court is awaiting<br />its first presentation.</h3>
          <p>Listings will appear here only after the marketplace contract and onchain indexer are connected.</p>
          <button onClick={() => setShowList(true)}>Present a work <ArrowUpRight size={16} /></button>
        </div>
      </section>

      <section className="manifesto" id="about">
        <span className="section-no">02 / THE RECORD</span>
        <blockquote>“Ownership should be obvious.<br />Provenance should be permanent.<br /><em>The work should speak first.</em>”</blockquote>
        <div className="manifesto-notes"><p>House of Joshi is a non-custodial venue. The marketplace never holds your work; approved transfers settle directly between collector and owner.</p><div className="settlement-mark"><Gavel /><span>BUILT FOR<br /><b>SHIBARIUM</b></span></div></div>
      </section>

      <section className="activity-section" id="activity">
        <span className="section-no">03 / RECENT JUDGMENTS</span>
        <div className="empty-activity"><span>No indexed activity yet.</span><p>Verified listing, sale, cancellation, and withdrawal events will appear here.</p></div>
      </section>

      <footer>
        <div className="footer-brand"><span className="sigil">HJ</span><strong>HOUSE OF JOSHI</strong><p>An independent marketplace for Shibarium’s most considered digital works.</p></div>
        <div><span className="footer-label">NETWORK</span><a href="https://shibariumscan.io" target="_blank" rel="noreferrer">ShibariumScan <ExternalLink size={13} /></a><span>Chain ID 109</span><span>Settlement in BONE</span></div>
        <div><span className="footer-label">COURT</span><a href="#market">Market</a><a href="#collections">Collections</a><a href="#activity">Activity</a></div>
        <div><span className="footer-label">PROTOCOL</span><a href="https://docs.shib.io/shibarium" target="_blank" rel="noreferrer">Documentation <ExternalLink size={13} /></a><a href="https://rpc.shibarium.shib.io" target="_blank" rel="noreferrer">RPC endpoint <ExternalLink size={13} /></a></div>
        <p className="copyright">© 2026 HOUSE OF JOSHI · ALL TRANSACTIONS ARE FINAL ONCHAIN.</p>
      </footer>

      {status && <div className="toast" role="status"><CircleHelp size={18} /><span>{status}</span><button onClick={() => setStatus("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {showList && <ListingPanel onClose={() => setShowList(false)} onSubmit={listNft} account={account} />}
    </main>
  );
}

function CourtWalletButton() {
  return <ConnectButton.Custom>{({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
    const connected = mounted && account && chain;
    if (!connected) return <button className="wallet-button" onClick={openConnectModal}>Enter the court</button>;
    if (chain.unsupported) return <button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>;
    return <button className="wallet-button" onClick={openAccountModal}><Wallet size={15} /> {account.displayName}</button>;
  }}</ConnectButton.Custom>;
}

function ListingPanel({ onClose, onSubmit, account }: { onClose: () => void; onSubmit: (nft: string, tokenId: string, price: string) => void; account: string | null }) {
  const [nft, setNft] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("");
  const valid = /^0x[a-fA-F0-9]{40}$/.test(nft) && /^\d+$/.test(tokenId) && Number(price) > 0;
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="purchase-panel listing-panel" role="dialog" aria-modal="true" aria-label="Present a work">
      <button className="close-button" onClick={onClose} aria-label="Close"><X /></button>
      <span className="section-no">NEW PRESENTATION / ERC-721</span>
      <h2>Present a work</h2>
      <p className="listing-intro">Enter the onchain details of a work you own. You will approve the marketplace, then sign the listing.</p>
      <label className="field"><span>NFT contract address</span><input value={nft} onChange={(e) => setNft(e.target.value)} placeholder="0x…" autoComplete="off" /></label>
      <div className="field-row"><label className="field"><span>Token ID</span><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="Enter token ID" inputMode="numeric" /></label><label className="field"><span>Price in BONE</span><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Enter amount" inputMode="decimal" /></label></div>
      <div className="listing-check"><ShieldCheck /><div><strong>Non-custodial by design</strong><p>Your NFT stays in your wallet until a collector buys it. Revoking approval invalidates the listing.</p></div></div>
      {account ? <button className="confirm-buy" disabled={!valid} onClick={() => onSubmit(nft, tokenId, price)}>Approve & present <ArrowUpRight /></button> : <ConnectButton.Custom>{({ openConnectModal }) => <button className="confirm-buy" onClick={openConnectModal}>Connect wallet first <Wallet /></button>}</ConnectButton.Custom>}
    </section>
  </div>;
}
