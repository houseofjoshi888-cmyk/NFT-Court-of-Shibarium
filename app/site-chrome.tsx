"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ExternalLink, Menu, Wallet, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  ["/market", "Market"],
  ["/sell", "Sell"],
  ["/activity", "Activity"],
  ["/account", "Account"],
  ["/protocol", "How it works"],
] as const;

export function GlobalHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <header className="global-header">
    <Link href="/" className="wordmark" onClick={()=>setOpen(false)}><Image src="/house-of-joshi.png" alt="House of Joshi" width={42} height={42} className="header-logo"/><span>HOUSE OF JOSHI</span></Link>
    <button className="global-menu-button" type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label="Toggle navigation">{open?<X/>:<Menu/>}</button>
    <nav className={open?"open":""} aria-label="Main navigation">{navigation.map(([href,label])=><Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined} onClick={()=>setOpen(false)}>{label}</Link>)}</nav>
    <div className="global-header-actions"><ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=><>
      <button className="global-network-button" type="button" onClick={account?openChainModal:openConnectModal}><i className={chain?`chain-${chain.id}`:""}/><span>{chain?.name??"Network"}</span></button>
      {!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}
    </>}</ConnectButton.Custom></div>
  </header>;
}

export function GlobalFooter() {
  return <footer className="global-footer">
    <div className="global-footer-brand"><Link href="/" className="wordmark"><Image src="/house-of-joshi.png" alt="House of Joshi" width={42} height={42}/><span>HOUSE OF JOSHI</span></Link><p>A royal, non-custodial NFT marketplace across five EVM networks.</p></div>
    <div><span>MARKETPLACE</span><Link href="/market">Market</Link><Link href="/sell">Sell NFT</Link><Link href="/activity">Activity</Link><Link href="/account">Account</Link><Link href="/protocol">How it works</Link></div>
    <div><span>INFORMATION</span><Link href="/about">About</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
    <div><span>NETWORKS</span><a href="https://etherscan.io" target="_blank" rel="noreferrer">Ethereum <ExternalLink size={12}/></a><a href="https://shibariumscan.io" target="_blank" rel="noreferrer">Shibarium <ExternalLink size={12}/></a><a href="https://polygonscan.com" target="_blank" rel="noreferrer">Polygon <ExternalLink size={12}/></a><a href="https://basescan.org" target="_blank" rel="noreferrer">Base <ExternalLink size={12}/></a><a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">Robinhood <ExternalLink size={12}/></a></div>
    <div><span>HOUSE ECOSYSTEM</span><a href="https://kingdomwithin.thehouseofjoshi.com/" target="_blank" rel="noreferrer">Kingdom Within</a><a href="https://swap.thehouseofjoshi.com/" target="_blank" rel="noreferrer">HOJ Swap</a><a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noreferrer">NFT Launchpad</a><a href="https://dreamweaver.thehouseofjoshi.com/" target="_blank" rel="noreferrer">Dreamweaver</a></div>
    <div className="global-footer-legal"><span>© 2026 The House of Joshi. All rights reserved.</span><a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer">X</a><a href="https://discord.com/invite/uH9zVeAwDu" target="_blank" rel="noreferrer">Discord</a><a href="https://www.instagram.com/thehouseofjoshi" target="_blank" rel="noreferrer">Instagram</a></div>
  </footer>;
}
