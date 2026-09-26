"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Activity, Bell, BookOpen, CircleHelp, ExternalLink, Gem, Heart, LayoutDashboard, Menu, Network, Rocket, Search, ShoppingCart, Sparkles, TrendingUp, UserRound, Wallet, X, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { ChainLogo } from "./chain-logo";
import { marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { addNotification } from "@/lib/notifications";

function readCartCounts() {
  return Object.values(marketplaceChains).flatMap(chain => {
    try {
      const ids = JSON.parse(window.localStorage.getItem(`hoj-market-cart:${chain.id}`) ?? "[]") as unknown;
      const count = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string").length : 0;
      return count ? [{ chainId: chain.id as MarketplaceChainId, name: chain.name, count }] : [];
    } catch { return []; }
  });
}

const navigation: ReadonlyArray<{ href:string; label:string; icon:any; external?:boolean; admin?:boolean }> = [
  { href: "/", label: "Discover", icon: LayoutDashboard },
  { href: "/collections", label: "Collections", icon: Gem },
  { href: "https://swap.thehouseofjoshi.com/", label: "Swap", icon: Sparkles, external: true },
  { href: "/market", label: "Market", icon: Rocket },
  { href: "/sell", label: "Sell", icon: Gem },
  { href: "https://www.nftlaunchpad.thehouseofjoshi.com/", label: "Create", icon: Rocket, external: true },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/rankings", label: "Rankings", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/wallet", label: "Withdraw", icon: Wallet },
  { href: "/admin", label: "Admin", icon: Shield, admin: true },
];

export function GlobalHeader() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [chainStripHidden,setChainStripHidden]=useState(false);
  const [cartCounts,setCartCounts]=useState<ReturnType<typeof readCartCounts>>([]);
  const [notificationCount,setNotificationCount]=useState(0);
  const [notifications,setNotifications]=useState<Array<{id:string;type:string;message:string;timestamp:number;read:boolean}>>([]);
  const [showNotifications,setShowNotifications]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  
  // Admin wallet addresses (in production, this should be in a database)
  const ADMIN_WALLETS = [
    "0x69Bf308E5e30158072Cf9d2c6DE7b86F5Ae2f9B4", // Admin wallet
  ];
  
  useEffect(()=>{
    const update=()=>setCartCounts(readCartCounts());
    update();
    window.addEventListener("storage",update);
    window.addEventListener("hoj-cart-updated",update);
    return()=>{window.removeEventListener("storage",update);window.removeEventListener("hoj-cart-updated",update);};
  },[pathname]);

  // Load notifications when wallet connects
  useEffect(()=>{
    if(!address){
      setNotificationCount(0);
      setNotifications([]);
      return;
    }
    
    try{
      const storedNotifications=localStorage.getItem(`hoj:notifications:${address.toLowerCase()}`);
      if(storedNotifications){
        const parsed=JSON.parse(storedNotifications);
        setNotifications(parsed);
        setNotificationCount(parsed.filter((n:{read:boolean})=>!n.read).length);
      }else{
        // Add welcome notification for new users
        addNotification(address, "WELCOME", "Welcome to House of Joshi Marketplace! Connect your wallet to start trading NFTs.");
      }
    }catch(error){
      console.error("Failed to load notifications:",error);
    }
  },[address]);

  // Listen for new notifications
  useEffect(()=>{
    const handleNewNotification=(event:CustomEvent)=>{
      if(address){
        const notification=event.detail;
        const newNotifications=[notification,...notifications];
        localStorage.setItem(`hoj:notifications:${address.toLowerCase()}`,JSON.stringify(newNotifications));
        setNotifications(newNotifications);
        setNotificationCount(prev=>prev+1);
      }
    };
    
    window.addEventListener("hoj-new-notification",handleNewNotification as EventListener);
    return()=>window.removeEventListener("hoj-new-notification",handleNewNotification as EventListener);
  },[address,notifications]);

  // Mark notification as read
  const markAsRead=(id:string)=>{
    const updatedNotifications=notifications.map(n=>n.id===id?{...n,read:true}:n);
    localStorage.setItem(`hoj:notifications:${address?.toLowerCase()}`,JSON.stringify(updatedNotifications));
    setNotifications(updatedNotifications);
    setNotificationCount(updatedNotifications.filter(n=>!n.read).length);
  };

  // Mark all as read
  const markAllAsRead=()=>{
    const updatedNotifications=notifications.map(n=>({...n,read:true}));
    localStorage.setItem(`hoj:notifications:${address?.toLowerCase()}`,JSON.stringify(updatedNotifications));
    setNotifications(updatedNotifications);
    setNotificationCount(0);
  };

  // Check if wallet is admin
  useEffect(()=>{
    if(address){
      setIsAdmin(ADMIN_WALLETS.includes(address.toLowerCase()));
    }else{
      setIsAdmin(false);
    }
  },[address]);
  useEffect(()=>{
    const rememberNftOrigin=(event:MouseEvent)=>{
      const target=event.target;
      if(!(target instanceof Element)||window.location.pathname.startsWith("/nft/"))return;
      const anchor=target.closest<HTMLAnchorElement>("a[href]");
      if(!anchor)return;
      const destination=new URL(anchor.href,window.location.href);
      if(destination.origin!==window.location.origin||!destination.pathname.startsWith("/nft/"))return;
      try{window.sessionStorage.setItem("hoj-nft-origin",JSON.stringify({href:window.location.pathname+window.location.search,at:Date.now()}));}catch{/* Navigation still works when storage is unavailable. */}
    };
    document.addEventListener("click",rememberNftOrigin,true);
    return()=>document.removeEventListener("click",rememberNftOrigin,true);
  },[]);
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
      <nav aria-label="Marketplace navigation">{navigation.filter(item=>!item.admin||isAdmin).map(({href,label,icon:Icon,...item})=>item.external?<a key={href} href={href} target="_blank" rel="noreferrer"><Icon size={16}/><span>{label}</span></a>:<Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined}><Icon size={16}/><span>{label}</span></Link>)}</nav>
      <div className="court-sidebar-secondary"><Link href="/protocol"><CircleHelp size={15}/> How it works</Link><Link href="/help-centre"><CircleHelp size={15}/> Help centre</Link><Link href="/about"><BookOpen size={15}/> About marketplace</Link><a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer"><Rocket size={15}/> Create NFTs</a></div>
      <div className="court-pass"><small>MARKETPLACE ACCESS</small><strong>Multichain · Open</strong><p>Trade on Base, Cronos, Polygon, Shibarium, and Zora. More networks are coming soon.</p><a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer">Create NFTs</a></div>
    </aside>
    <header className="court-topbar">
      <Link href="/" className="court-topbar-brand"><Image className="court-topbar-logo" src="/house-of-joshi-logo.png" alt="" width={34} height={34} style={{height:"auto"}} priority unoptimized/><span><strong>HOUSE OF JOSHI</strong><small>NFT MARKETPLACE</small></span></Link>
      <div className="court-topbar-actions">
        <Link href="/search" className="court-topbar-icon" aria-label="Search"><Search size={18}/></Link>
        <Link href="/favorites" className="court-topbar-icon" aria-label="Favorites"><Heart size={18}/></Link>
        <div className="court-notification-wrap">
          <button 
            className="court-topbar-icon" 
            aria-label="Notifications"
            onClick={()=>setShowNotifications(!showNotifications)}
          >
            <Bell size={18}/>
            {notificationCount>0&&<b>{notificationCount}</b>}
          </button>
          {showNotifications&&(
            <div className="court-notification-dropdown">
              <div className="court-notification-header">
                <span>Notifications</span>
                {notificationCount>0&&<button onClick={markAllAsRead}>Mark all as read</button>}
              </div>
              <div className="court-notification-list">
                {notifications.length>0?(
                  notifications.slice(0,5).map(notification=>(
                    <div 
                      key={notification.id} 
                      className={`court-notification-item ${notification.read?'read':''}`}
                      onClick={()=>markAsRead(notification.id)}
                    >
                      <div className="court-notification-content">
                        <span className="court-notification-type">{notification.type}</span>
                        <p>{notification.message}</p>
                        <small>{new Date(notification.timestamp).toLocaleString()}</small>
                      </div>
                    </div>
                  ))
                ):(
                  <div className="court-notification-empty">
                    <Bell size={32}/>
                    <p>No notifications yet</p>
                  </div>
                )}
              </div>
              {notifications.length>0&&(
                <Link href="/notifications" className="court-notification-footer" onClick={()=>setShowNotifications(false)}>
                  View all notifications
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="court-cart-wrap"><Link href="/cart" className="court-topbar-icon court-header-cart" aria-label={`View cart, ${cartCounts.reduce((total,item)=>total+item.count,0)} items`}><ShoppingCart size={18}/>{cartCounts.length>0&&<b>{cartCounts.reduce((total,item)=>total+item.count,0)}</b>}</Link></div>
        <ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=><><button className="court-network-button symbol-only" type="button" onClick={account?openChainModal:openConnectModal} aria-label={chain?`Change network. Current network: ${chain.name}`:"Choose network"} title={chain?.name??"Choose network"}>{chain?<ChainLogo chainId={chain.id}/>:<Network size={17}/>}</button>{!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}</>}</ConnectButton.Custom><button className="court-mobile-menu-button" type="button" onClick={()=>setMobileMenuOpen(open=>!open)} aria-label={mobileMenuOpen?"Close menu":"Open menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-marketplace-menu">{mobileMenuOpen?<X size={19}/>:<Menu size={19}/>}</button></div>
    </header>
    <div className={`supported-chain-strip ${chainStripHidden&&!mobileMenuOpen?"is-hidden":""}`} aria-label="Supported blockchain networks" aria-hidden={chainStripHidden&&!mobileMenuOpen}>
      {Object.values(marketplaceChains).map(chain=><div key={chain.id} className={`chain-strip-${chain.id}`} title={`${chain.name} · ${chain.marketplaceStatus==="live"?"Live":"Coming soon"}`} aria-label={`${chain.name}: ${chain.marketplaceStatus==="live"?"Live":"Coming soon"}`}><ChainLogo chainId={chain.id}/></div>)}
    </div>
    <div id="mobile-marketplace-menu" className={`court-mobile-menu ${mobileMenuOpen?"open":""}`} aria-hidden={!mobileMenuOpen}>
      <nav aria-label="Mobile marketplace navigation">{navigation.filter(item=>!item.admin||isAdmin).map(({href,label,icon:Icon,...item})=>item.external?<a key={href} href={href} target="_blank" rel="noreferrer" onClick={()=>setMobileMenuOpen(false)}><Icon size={18}/><span>{label}</span><ExternalLink size={13}/></a>:<Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined} onClick={()=>setMobileMenuOpen(false)}><Icon size={18}/><span>{label}</span></Link>)}</nav>
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
