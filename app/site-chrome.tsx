"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Activity, BookOpen, CircleHelp, Compass, ExternalLink, Gavel, LayoutDashboard, ShieldCheck, Store, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Court", icon: LayoutDashboard },
  { href: "/market", label: "Explore", icon: Compass },
  { href: "/sell", label: "Sell NFT", icon: Store },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/account", label: "My assets", icon: UserRound },
] as const;

export function GlobalHeader() {
  const pathname = usePathname();
  return <>
    <aside className="court-sidebar">
      <Link href="/" className="court-brand"><span className="court-brand-mark"><Gavel size={22}/></span><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link>
      <nav aria-label="Court navigation">{navigation.map(({href,label,icon:Icon})=><Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <div className="court-sidebar-secondary"><Link href="/protocol"><ShieldCheck size={15}/> How it works</Link><Link href="/faq"><CircleHelp size={15}/> Help center</Link><Link href="/about"><BookOpen size={15}/> About the court</Link></div>
      <div className="court-pass"><small>COURT ACCESS</small><strong>Multichain · Open</strong><p>Collect and list verified ERC-721 works across five networks.</p><Link href="/sell">Present a work</Link></div>
    </aside>
    <header className="court-topbar">
      <Link href="/" className="court-topbar-brand"><Gavel size={18}/><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link>
      <div className="court-topbar-actions"><ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=><><button className="court-network-button" type="button" onClick={account?openChainModal:openConnectModal}><i className={chain?`chain-${chain.id}`:""}/><span>{chain?.name??"Choose network"}</span></button>{!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}</>}</ConnectButton.Custom></div>
    </header>
  </>;
}

export function GlobalFooter() {
  return <footer className="court-footer"><div><span>SECURE &amp; TRUSTLESS</span><p>All marketplace actions settle onchain from your wallet.</p></div><div><span>PROVENANCE VERIFIED</span><p>Every work remains linked to its original contract and network.</p></div><div><span>MULTICHAIN COURT</span><p>Ethereum, Shibarium, Polygon, Base, and Robinhood Chain.</p></div><div className="court-footer-links"><span>© 2026 House of Joshi</span><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link><a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer">X <ExternalLink size={11}/></a></div></footer>;
}
