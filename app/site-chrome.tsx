"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Activity, Bell, BookOpen, CircleHelp, ExternalLink, Gem, Headphones, Heart, LayoutDashboard, Menu, Network, Repeat2, Rocket, Search, ShoppingCart, Sparkles, TrendingUp, UserRound, Wallet, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChainLogo } from "./chain-logo";
import { marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

function readCartCounts() {
  return Object.values(marketplaceChains).flatMap(chain => {
    try {
      const ids = JSON.parse(window.localStorage.getItem(`hoj-market-cart:${chain.id}`) ?? "[]") as unknown;
      const count = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string").length : 0;
      return count ? [{ chainId: chain.id as MarketplaceChainId, name: chain.name, count }] : [];
    } catch { return []; }
  });
}

const navigation: ReadonlyArray<{ href:string; label:string; icon:typeof LayoutDashboard; external?:boolean }> = [
  { href: "/", label: "Discover", icon: LayoutDashboard },
  { href: "/collections", label: "Collections", icon: Gem },
  { href: "https://swap.thehouseofjoshi.com/", label: "Swap", icon: Sparkles, external: true },
  { href: "/market", label: "Market", icon: Rocket },
  { href: "/sell", label: "Sell", icon: Gem },
  { href: "https://www.nftlaunchpad.thehouseofjoshi.com/", label: "Create", icon: Rocket, external: true },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/rankings", label: "Rankings", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function GlobalHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [chainStripHidden,setChainStripHidden]=useState(false);
  const [cartOpen,setCartOpen]=useState(false);
  const [cartCounts,setCartCounts]=useState<ReturnType<typeof readCartCounts>>([]);
  useEffect(()=>{
    const update=()=>setCartCounts(readCartCounts());
    update();
    window.addEventListener("storage",update);
    window.addEventListener("hoj-cart-updated",update);
    return()=>{window.removeEventListener("storage",update);window.removeEventListener("hoj-cart-updated",update);};
  },[pathname]);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>setChainStripHidden(window.scrollY>24));
    };
    update();
    window.addEventListener("scroll",update,{passive:true});
    return()=>{
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll",update);
    };
  },[]);
  useEffect(()=>{
    if(!mobileMenuOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous};
  },[mobileMenuOpen]);
  return <>
    <aside className="court-sidebar">
      <Link href="/" className="court-brand"><Image className="court-brand-logo" src="/house-of-joshi-logo.png" alt="House of Joshi NFT Marketplace" width={48} height={48} style={{height:"auto"}} priority unoptimized/><span><strong>HOUSE OF JOSHI</strong><small>NFT MARKETPLACE</small></span></Link>
      <nav aria-label="Marketplace navigation">{navigation.map(({href,label,icon:Icon,...item})=>item.external?<a key={href} href={href} target="_blank" rel="noreferrer"><Icon size={16}/><span>{label}</span></a>:<Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <div className="court-sidebar-secondary"><Link href="/protocol"><CircleHelp size={15}/> How it works</Link><Link href="/help-centre"><CircleHelp size={15}/> Help centre</Link><Link href="/about"><BookOpen size={15}/> About marketplace</Link><a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer"><Rocket size={15}/> Create NFTs</a></div>
      <div className="court-pass"><small>MARKETPLACE ACCESS</small><strong>Multichain · Open</strong><p>Trade on Base, Cronos, Polygon, Shibarium, and Zora. More networks are coming soon.</p><a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer">Create NFTs</a></div>
    </aside>
    <header className="court-topbar">
      <Link href="/" className="court-topbar-brand"><Image className="court-topbar-logo" src="/house-of-joshi-logo.png" alt="" width={34} height={34} style={{height:"auto"}} priority unoptimized/><span><strong>HOUSE OF JOSHI</strong><small>NFT MARKETPLACE</small></span></Link>
      <div className="court-topbar-actions">
        <Link href="/search" className="court-topbar-icon" aria-label="Search"><Search size={18}/></Link>
        <Link href="/favorites" className="court-topbar-icon" aria-label="Favorites"><Heart size={18}/></Link>
        <Link href="/notifications" className="court-topbar-icon" aria-label="Notifications"><Bell size={18}/></Link>
        <div className="court-cart-wrap"><button type="button" className="court-topbar-icon court-header-cart" aria-label={`Open cart, ${cartCounts.reduce((total,item)=>total+item.count,0)} items`} aria-expanded={cartOpen} onClick={()=>setCartOpen(open=>!open)}><ShoppingCart size={18}/>{cartCounts.length>0&&<b>{cartCounts.reduce((total,item)=>total+item.count,0)}</b>}</button>{cartOpen&&<div className="court-cart-menu"><strong>Your cart</strong>{cartCounts.length?cartCounts.map(item=><a key={item.chainId} href={`/market?chainId=${item.chainId}&cart=1`}><span>{item.name}</span><small>{item.count} {item.count===1?"NFT":"NFTs"}</small></a>):<p>No NFTs added yet.</p>}<Link href="/market" onClick={()=>setCartOpen(false)}>Explore NFTs</Link></div>}</div>
        <ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=><><button className="court-network-button symbol-only" type="button" onClick={account?openChainModal:openConnectModal} aria-label={chain?`Change network. Current network: ${chain.name}`:"Choose network"} title={chain?.name??"Choose network"}>{chain?<ChainLogo chainId={chain.id}/>:<Network size={17}/>}</button>{!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}</>}</ConnectButton.Custom><button className="court-mobile-menu-button" type="button" onClick={()=>setMobileMenuOpen(open=>!open)} aria-label={mobileMenuOpen?"Close menu":"Open menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-marketplace-menu">{mobileMenuOpen?<X size={19}/>:<Menu size={19}/>}</button></div>
    </header>
    <div className={`supported-chain-strip ${chainStripHidden&&!mobileMenuOpen?"is-hidden":""}`} aria-label="Supported blockchain networks" aria-hidden={chainStripHidden&&!mobileMenuOpen}>
      {Object.values(marketplaceChains).map(chain=><div key={chain.id} className={`chain-strip-${chain.id}`} title={`${chain.name} · ${chain.marketplaceStatus==="live"?"Live":"Coming soon"}`} aria-label={`${chain.name}: ${chain.marketplaceStatus==="live"?"Live":"Coming soon"}`}><ChainLogo chainId={chain.id}/></div>)}
    </div>
    <div id="mobile-marketplace-menu" className={`court-mobile-menu ${mobileMenuOpen?"open":""}`} aria-hidden={!mobileMenuOpen}>
      <nav aria-label="Mobile marketplace navigation">{navigation.map(({href,label,icon:Icon,...item})=>item.external?<a key={href} href={href} target="_blank" rel="noreferrer" onClick={()=>setMobileMenuOpen(false)}><Icon size={18}/><span>{label}</span><ExternalLink size={13}/></a>:<Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined} onClick={()=>setMobileMenuOpen(false)}><Icon size={18}/><span>{label}</span></Link>)}</nav>
      <div><Link href="/protocol" onClick={()=>setMobileMenuOpen(false)}>How it works</Link><Link href="/help-centre" onClick={()=>setMobileMenuOpen(false)}>Help centre</Link><Link href="/about" onClick={()=>setMobileMenuOpen(false)}>About marketplace</Link></div>
    </div>
  </>;
}

export function GlobalFooter() {
  return <footer className="court-footer">
    <div className="court-footer-main">
      <section className="court-footer-brand"><Link href="/"><Image className="court-footer-logo" src="/house-of-joshi-logo.png" alt="" width={38} height={38} style={{height:"auto"}} unoptimized/><span><strong>HOUSE OF JOSHI</strong><small>NFT MARKETPLACE</small></span></Link><p>The premier multichain NFT marketplace, built for collectors and creators.</p></section>
      <nav aria-label="Marketplace footer links"><span>MARKETPLACE</span><Link href="/market">Explore</Link><Link href="/collections">Collections</Link><Link href="/drops">Drops</Link></nav>
      <nav aria-label="Resource footer links"><span>RESOURCES</span><Link href="/learn">Learn</Link><Link href="/protocol">How it works</Link><Link href="/help-centre">Help Centre</Link></nav>
      <nav aria-label="Company footer links"><span>COMPANY</span><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/support">Support</Link></nav>
      <nav aria-label="Social footer links"><span>FOLLOW</span><a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer">X <ExternalLink size={10}/></a><a href="https://discord.com/invite/uH9zVeAwDu" target="_blank" rel="noreferrer">Discord <ExternalLink size={10}/></a><a href="https://www.instagram.com/thehouseofjoshi" target="_blank" rel="noreferrer">Instagram <ExternalLink size={10}/></a></nav>
    </div>
    <div className="court-footer-legal"><span>© 2026 The House of Joshi- NFT Marketplace All rights reserved.</span><nav aria-label="Legal footer links"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></nav></div>
  </footer>;
}
