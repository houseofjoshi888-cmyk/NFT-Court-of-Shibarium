"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Activity, BookOpen, CircleHelp, ExternalLink, Gem, Headphones, LayoutDashboard, Network, Repeat2, Rocket, Sparkles, UserRound, Wallet } from "lucide-react";
import Image from "next/image";
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
      <Link href="/" className="court-brand"><Image className="court-brand-logo" src="/house-of-joshi.png" alt="House of Joshi NFT Marketplace" width={48} height={48} priority/><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link>
      <nav aria-label="Court navigation">{navigation.map(({href,label,icon:Icon,...item})=>item.external?<a key={href} href={href} target="_blank" rel="noreferrer"><Icon size={16}/><span>{label}</span></a>:<Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <div className="court-sidebar-secondary"><Link href="/protocol"><CircleHelp size={15}/> How it works</Link><Link href="/help-centre"><CircleHelp size={15}/> Help centre</Link><Link href="/about"><BookOpen size={15}/> About the court</Link></div>
      <div className="court-pass"><small>COURT ACCESS</small><strong>Multichain · Open</strong><p>Collect and list verified ERC-721 works across five networks.</p><Link href="/sell">Present a work</Link></div>
    </aside>
    <header className="court-topbar">
      <Link href="/" className="court-topbar-brand"><Image className="court-topbar-logo" src="/house-of-joshi.png" alt="" width={34} height={34}/><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link>
      <div className="court-topbar-actions"><ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=><><button className="court-network-button symbol-only" type="button" onClick={account?openChainModal:openConnectModal} aria-label={chain?`Change network. Current network: ${chain.name}`:"Choose network"} title={chain?.name??"Choose network"}>{chain?.iconUrl?<span className="chain-symbol" style={{backgroundImage:`url(${chain.iconUrl})`}}/>:chain?<i className={`chain-${chain.id}`}/>:<Network size={17}/>}</button>{!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}</>}</ConnectButton.Custom></div>
    </header>
  </>;
}

export function GlobalFooter() {
  return <footer className="court-footer">
    <div className="court-footer-main">
      <section className="court-footer-brand"><Link href="/"><Image className="court-footer-logo" src="/house-of-joshi.png" alt="" width={38} height={38}/><span><strong>HOUSE OF JOSHI</strong><small>NFT COURT</small></span></Link><p>The premier multichain NFT marketplace. Built for collectors. Governed by the court.</p></section>
      <nav aria-label="Marketplace footer links"><span>MARKETPLACE</span><Link href="/market">Explore</Link><Link href="/collections">Collections</Link><Link href="/drops">Drops</Link></nav>
      <nav aria-label="Resource footer links"><span>RESOURCES</span><Link href="/learn">Learn</Link><Link href="/protocol">Court Pass</Link><Link href="/help-centre">Help Centre</Link></nav>
      <nav aria-label="Company footer links"><span>COMPANY</span><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/support">Support</Link></nav>
      <nav aria-label="Social footer links"><span>FOLLOW</span><a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer">X <ExternalLink size={10}/></a><a href="https://discord.com/invite/uH9zVeAwDu" target="_blank" rel="noreferrer">Discord <ExternalLink size={10}/></a><a href="https://www.instagram.com/thehouseofjoshi" target="_blank" rel="noreferrer">Instagram <ExternalLink size={10}/></a></nav>
    </div>
    <div className="court-footer-legal"><span>© 2026 The House of Joshi- NFT Marketplace All rights reserved.</span><nav aria-label="Legal footer links"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></nav></div>
  </footer>;
}
