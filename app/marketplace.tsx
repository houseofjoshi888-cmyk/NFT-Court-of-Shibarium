"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Gavel,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import {
  createWalletClient,
  custom,
  defineChain,
  formatEther,
  getAddress,
  parseEther,
} from "viem";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

const shibarium = defineChain({
  id: 109,
  name: "Shibarium",
  nativeCurrency: { name: "BONE", symbol: "BONE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.shibarium.shib.io"] } },
  blockExplorers: { default: { name: "ShibariumScan", url: "https://shibariumscan.io" } },
});

const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}` | undefined;

const marketplaceAbi = [
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

type Art = {
  id: string;
  title: string;
  collection: string;
  creator: string;
  price: string;
  previous: string;
  tone: string;
  contract: `0x${string}`;
  tokenId: bigint;
};

const lots: Art[] = [
  { id: "01", title: "Ember Witness", collection: "Court Relics", creator: "0x7A3…91F", price: "245", previous: "198", tone: "ember", contract: "0x1111111111111111111111111111111111111111", tokenId: 17n },
  { id: "02", title: "Silent Decree", collection: "Monolith Studies", creator: "0x41C…8D2", price: "180", previous: "162", tone: "ivory", contract: "0x2222222222222222222222222222222222222222", tokenId: 41n },
  { id: "03", title: "Bone Orchard", collection: "Native Forms", creator: "0xB09…2EE", price: "320", previous: "280", tone: "sage", contract: "0x3333333333333333333333333333333333333333", tokenId: 8n },
  { id: "04", title: "The Ninth Seal", collection: "Court Relics", creator: "0x7A3…91F", price: "410", previous: "350", tone: "crimson", contract: "0x4444444444444444444444444444444444444444", tokenId: 109n },
  { id: "05", title: "Ashen Index", collection: "Protocol Objects", creator: "0x19D…0A4", price: "136", previous: "120", tone: "blue", contract: "0x5555555555555555555555555555555555555555", tokenId: 52n },
  { id: "06", title: "Terms of Light", collection: "Monolith Studies", creator: "0x41C…8D2", price: "275", previous: "—", tone: "gold", contract: "0x6666666666666666666666666666666666666666", tokenId: 73n },
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Marketplace() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Recently listed");
  const [selected, setSelected] = useState<Art | null>(null);
  const [showList, setShowList] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((items) => {
      const [first] = items as string[];
      if (first) setAccount(getAddress(first));
    });
  }, []);

  const visibleLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? lots.filter((lot) => `${lot.title} ${lot.collection} ${lot.creator}`.toLowerCase().includes(q))
      : lots;
    return [...filtered].sort((a, b) => {
      if (sort === "Price: low to high") return Number(a.price) - Number(b.price);
      if (sort === "Price: high to low") return Number(b.price) - Number(a.price);
      return Number(a.id) - Number(b.id);
    });
  }, [search, sort]);

  async function connect() {
    if (!window.ethereum) {
      setStatus("Install an EVM wallet such as MetaMask to continue.");
      return;
    }
    try {
      setStatus("Requesting wallet access…");
      const client = createWalletClient({ chain: shibarium, transport: custom(window.ethereum) });
      const [address] = await client.requestAddresses();
      try {
        await client.switchChain({ id: shibarium.id });
      } catch {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x6d",
            chainName: "Shibarium",
            nativeCurrency: { name: "BONE", symbol: "BONE", decimals: 18 },
            rpcUrls: ["https://rpc.shibarium.shib.io"],
            blockExplorerUrls: ["https://shibariumscan.io"],
          }],
        });
      }
      setAccount(address);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Wallet connection was cancelled.");
    }
  }

  async function buy(lot: Art) {
    if (!account) {
      setSelected(null);
      await connect();
      return;
    }
    if (!window.ethereum || !marketplaceAddress) {
      setStatus("The marketplace contract address is not configured yet. This preview is ready for a Puppynet deployment.");
      return;
    }
    try {
      setStatus(`Preparing purchase of ${lot.title}…`);
      const client = createWalletClient({ account, chain: shibarium, transport: custom(window.ethereum) });
      const hash = await client.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyItem",
        args: [getAddress(lot.contract), lot.tokenId],
        value: parseEther(lot.price),
      });
      setSelected(null);
      setStatus(`Submitted ${shortAddress(hash)}. Your wallet will update after confirmation.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Purchase was not completed.");
    }
  }

  async function listNft(nftAddress: string, tokenId: string, price: string) {
    if (!account) {
      setShowList(false);
      await connect();
      return;
    }
    if (!window.ethereum || !marketplaceAddress) {
      setStatus("The marketplace contract address is not configured yet. Add the Puppynet deployment address to enable listing.");
      return;
    }
    try {
      const nft = getAddress(nftAddress);
      const client = createWalletClient({ account, chain: shibarium, transport: custom(window.ethereum) });
      setStatus("Step 1 of 2 · Approve the marketplace in your wallet.");
      await client.writeContract({ address: nft, abi: erc721Abi, functionName: "approve", args: [marketplaceAddress, BigInt(tokenId)] });
      setStatus("Step 2 of 2 · Sign the listing transaction.");
      const hash = await client.writeContract({ address: marketplaceAddress, abi: marketplaceAbi, functionName: "listItem", args: [nft, BigInt(tokenId), parseEther(price)] });
      setShowList(false);
      setStatus(`Listing submitted ${shortAddress(hash)}. It will appear after the indexer confirms it.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Listing was not completed.");
    }
  }

  async function copyAddress() {
    if (!account) return;
    await navigator.clipboard.writeText(account);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
          <button className="wallet-button" onClick={account ? copyAddress : connect}>
            {account ? (copied ? <><Check size={15} /> Copied</> : <><Wallet size={15} /> {shortAddress(account)}</>) : "Enter the court"}
          </button>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>SEASON I</span><span>SHIBARIUM’S CURATED EXCHANGE</span></div>
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
          <div className="hero-art" aria-label="Featured digital artwork, The First Witness">
            <div className="artifact artifact-hero"><div className="facet one" /><div className="facet two" /><div className="facet three" /><span className="glow" /></div>
            <div className="lot-label"><span>LOT 001</span><strong>THE FIRST WITNESS</strong><span>RESERVE · 680 BONE</span></div>
          </div>
        </div>
        <div className="proof-strip">
          <div><strong>1,284</strong><span>Works presented</span></div>
          <div><strong>92.4K</strong><span>BONE volume</span></div>
          <div><strong>438</strong><span>Collectors</span></div>
          <div className="verified"><ShieldCheck /><span><b>Verified settlement</b>Every sale resolves on Shibarium</span></div>
        </div>
      </section>

      <section className="market-section" id="market">
        <div className="section-heading">
          <div><span className="section-no">01 / MARKET</span><h2>WORKS BEFORE<br />THE COURT</h2></div>
          <p>A live selection of listed ERC-721 works. Prices are final and settled in native BONE.</p>
        </div>
        <div className="market-tools">
          <label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search works, collections, creators" aria-label="Search marketplace" /></label>
          <label className="sort-box"><SlidersHorizontal size={16} /><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort listings"><option>Recently listed</option><option>Price: low to high</option><option>Price: high to low</option></select><ChevronDown size={15} /></label>
        </div>
        <div className="lots-grid" id="collections">
          {visibleLots.map((lot) => <LotCard key={lot.id} lot={lot} onSelect={setSelected} />)}
        </div>
        {visibleLots.length === 0 && <div className="empty-state">No works answer that search.</div>}
      </section>

      <section className="manifesto" id="about">
        <span className="section-no">02 / THE RECORD</span>
        <blockquote>“Ownership should be obvious.<br />Provenance should be permanent.<br /><em>The work should speak first.</em>”</blockquote>
        <div className="manifesto-notes"><p>House of Joshi is a non-custodial venue. The marketplace never holds your work; approved transfers settle directly between collector and owner.</p><div className="settlement-mark"><Gavel /><span>BUILT FOR<br /><b>SHIBARIUM</b></span></div></div>
      </section>

      <section className="activity-section" id="activity">
        <span className="section-no">03 / RECENT JUDGMENTS</span>
        <div className="activity-row"><span className="activity-type">SALE</span><span>Obsidian Brief #12</span><span className="mono">0xD21…809</span><strong>194 BONE</strong><span>2m ago</span></div>
        <div className="activity-row"><span className="activity-type listed">LISTED</span><span>The Ninth Seal</span><span className="mono">0x7A3…91F</span><strong>410 BONE</strong><span>18m ago</span></div>
        <div className="activity-row"><span className="activity-type">SALE</span><span>Form Without Name</span><span className="mono">0x8E4…117</span><strong>88 BONE</strong><span>43m ago</span></div>
      </section>

      <footer>
        <div className="footer-brand"><span className="sigil">HJ</span><strong>HOUSE OF JOSHI</strong><p>An independent marketplace for Shibarium’s most considered digital works.</p></div>
        <div><span className="footer-label">NETWORK</span><a href="https://shibariumscan.io" target="_blank" rel="noreferrer">ShibariumScan <ExternalLink size={13} /></a><span>Chain ID 109</span><span>Settlement in BONE</span></div>
        <div><span className="footer-label">COURT</span><a href="#market">Market</a><a href="#collections">Collections</a><a href="#activity">Activity</a></div>
        <div><span className="footer-label">PROTOCOL</span><a href="https://docs.shib.io/shibarium" target="_blank" rel="noreferrer">Documentation <ExternalLink size={13} /></a><a href="https://rpc.shibarium.shib.io" target="_blank" rel="noreferrer">RPC endpoint <ExternalLink size={13} /></a></div>
        <p className="copyright">© 2026 HOUSE OF JOSHI · ALL TRANSACTIONS ARE FINAL ONCHAIN.</p>
      </footer>

      {status && <div className="toast" role="status"><CircleHelp size={18} /><span>{status}</span><button onClick={() => setStatus("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {selected && <PurchasePanel lot={selected} onClose={() => setSelected(null)} onBuy={() => buy(selected)} account={account} />}
      {showList && <ListingPanel onClose={() => setShowList(false)} onSubmit={listNft} account={account} />}
    </main>
  );
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
      <div className="field-row"><label className="field"><span>Token ID</span><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="109" inputMode="numeric" /></label><label className="field"><span>Price in BONE</span><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250" inputMode="decimal" /></label></div>
      <div className="listing-check"><ShieldCheck /><div><strong>Non-custodial by design</strong><p>Your NFT stays in your wallet until a collector buys it. Revoking approval invalidates the listing.</p></div></div>
      <button className="confirm-buy" disabled={!!account && !valid} onClick={() => account ? onSubmit(nft, tokenId, price) : onSubmit("", "", "")}>
        {account ? <>Approve & present <ArrowUpRight /></> : <>Connect wallet first <Wallet /></>}
      </button>
    </section>
  </div>;
}

function LotCard({ lot, onSelect }: { lot: Art; onSelect: (lot: Art) => void }) {
  const change = lot.previous === "—" ? null : ((Number(lot.price) - Number(lot.previous)) / Number(lot.previous)) * 100;
  return <article className="lot-card">
    <button className={`lot-art ${lot.tone}`} onClick={() => onSelect(lot)} aria-label={`View ${lot.title}`}>
      <span className="lot-number">{lot.id}</span><div className="artifact small"><div className="facet one" /><div className="facet two" /></div><span className="view-lot">View lot <ArrowUpRight size={15} /></span>
    </button>
    <div className="lot-meta"><div><span>{lot.collection}</span><h3>{lot.title}</h3><small>by {lot.creator}</small></div><div className="price"><span>ASKING</span><strong>{formatEther(parseEther(lot.price))} <i>BONE</i></strong>{change ? <small>+{change.toFixed(1)}% last sale</small> : <small>First listing</small>}</div></div>
  </article>;
}

function PurchasePanel({ lot, onClose, onBuy, account }: { lot: Art; onClose: () => void; onBuy: () => void; account: string | null }) {
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="purchase-panel" role="dialog" aria-modal="true" aria-label={`Purchase ${lot.title}`}>
      <button className="close-button" onClick={onClose} aria-label="Close"><X /></button>
      <span className="section-no">LOT {lot.id} / {lot.collection}</span>
      <div className={`modal-art ${lot.tone}`}><div className="artifact modal-object"><div className="facet one" /><div className="facet two" /><div className="facet three" /></div></div>
      <h2>{lot.title}</h2><p className="modal-creator">Presented by {lot.creator}</p>
      <div className="sale-summary"><span>Asking price</span><strong>{lot.price} BONE</strong><span>Network fee</span><em>Calculated in wallet</em><span>Settlement</span><em>Shibarium · Chain 109</em></div>
      <button className="confirm-buy" onClick={onBuy}>{account ? <>Acquire for {lot.price} BONE <ArrowUpRight /></> : <>Connect wallet to acquire <Wallet /></>}</button>
      <p className="fine-print"><ShieldCheck size={15} /> Non-custodial transfer. Confirm the collection and token details in your wallet before signing.</p>
    </section>
  </div>;
}
