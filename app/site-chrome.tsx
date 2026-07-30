"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Activity, BookOpen, CircleHelp, ExternalLink, Gavel, Gem, Headphones, LayoutDashboard, Network, Repeat2, Rocket, Sparkles, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation: ReadonlyArray<{ href:string; label:string; icon:typeof LayoutDashboard; external?:boolean }> = [
  { href: "/", label: "Court", icon: LayoutDashboard },
  { href: "/collections", label: "Collections", icon: Gem },
  { href: "/drops", label: "Drops", icon: Sparkles },
  { href: "https://swap.thehouseofjoshi.com/", label: "Swap", icon: Repeat2, external: true },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "https://www.nftlaunchpad.thehouseofjoshi.com/", label: "Launchpad", icon: Rocket, external: true },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/support", label: "Support", icon: Headphones },
];

export function GlobalHeader() {
  const pathname = usePathname();
  return <>
    <aside className="court-sidebar">
      <Link href="/" className="court-brand"><span className="court-brand-mark"><Gavel size={22}/></span><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link>
      <nav aria-label="Court navigation">{navigation.map(({href,label,icon:Icon,...item})=>item.external?<a key={href} href={href} target="_blank" rel="noreferrer"><Icon size={16}/><span>{label}</span></a>:<Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <div className="court-sidebar-secondary"><Link href="/protocol"><CircleHelp size={15}/> How it works</Link><Link href="/help-centre"><CircleHelp size={15}/> Help centre</Link><Link href="/about"><BookOpen size={15}/> About the court</Link></div>
      <div className="court-pass"><small>COURT ACCESS</small><strong>Multichain · Open</strong><p>Collect and list verified ERC-721 works across five networks.</p><Link href="/sell">Present a work</Link></div>
    </aside>
    <header className="court-topbar">
      <Link href="/" className="court-topbar-brand"><Gavel size={18}/><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link>
      <div className="court-topbar-actions"><ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=><><button className="court-network-button symbol-only" type="button" onClick={account?openChainModal:openConnectModal} aria-label={chain?`Change network. Current network: ${chain.name}`:"Choose network"} title={chain?.name??"Choose network"}>{chain?.iconUrl?<span className="chain-symbol" style={{backgroundImage:`url(${chain.iconUrl})`}}/>:chain?<i className={`chain-${chain.id}`}/>:<Network size={17}/>}</button>{!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}</>}</ConnectButton.Custom></div>
    </header>
  </>;
}

export function GlobalFooter() {
  return <footer className="court-footer"><div><span>SECURE &amp; TRUSTLESS</span><p>All marketplace actions settle onchain from your wallet.</p></div><div><span>PROVENANCE VERIFIED</span><p>Every work remains linked to its original contract and network.</p></div><div><span>MULTICHAIN COURT</span><p>Ethereum, Shibarium, Polygon, Base, and Robinhood Chain.</p></div><div className="court-footer-links"><span>© 2026 House of Joshi</span><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link><a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer">X <ExternalLink size={11}/></a></div></footer>;
}
