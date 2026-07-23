"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowUpRight, ExternalLink, Grid2X2, List, ShieldCheck, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther, getAddress, parseEther, zeroAddress } from "viem";
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { shibarium } from "./web3-provider";

type View = "market" | "sell" | "activity" | "account" | "protocol";
type Listing = { id:string; nftAddress:`0x${string}`; tokenId:string; seller:`0x${string}`; price:string; transactionHash:`0x${string}`; updatedBlock:number };
type Activity = { id:string; eventType:string; nftAddress:`0x${string}`|null; tokenId:string|null; seller:`0x${string}`|null; buyer:`0x${string}`|null; price:string|null; marketplaceFee?:string|null; royaltyAmount?:string|null; transactionHash:`0x${string}`; blockNumber:number };
type IndexerData = { configured:boolean; marketplaceAddress?:`0x${string}`; listings:Listing[]; activity:Activity[]; syncError?:string|null };
type WalletNft = { contractAddress:string; tokenId:string; name:string|null; collection:string|null; imageUrl:string|null; description:string|null; externalUrl:string|null; traits:Array<{type:string;value:string}> };

const abi = [
  { type:"function", name:"listItem", stateMutability:"nonpayable", inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"},{name:"price",type:"uint256"}], outputs:[] },
  { type:"function", name:"buyItem", stateMutability:"payable", inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"}], outputs:[] },
  { type:"function", name:"cancelListing", stateMutability:"nonpayable", inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"}], outputs:[] },
  { type:"function", name:"withdrawProceeds", stateMutability:"nonpayable", inputs:[], outputs:[] },
  { type:"function", name:"getProceeds", stateMutability:"view", inputs:[{name:"recipient",type:"address"}], outputs:[{name:"",type:"uint256"}] },
] as const;
const erc721Abi = [{ type:"function", name:"approve", stateMutability:"nonpayable", inputs:[{name:"to",type:"address"},{name:"tokenId",type:"uint256"}], outputs:[] }] as const;

function short(value:string) { return `${value.slice(0,6)}…${value.slice(-4)}`; }

function useIndexer() {
  const [data,setData] = useState<IndexerData>({ configured:false, listings:[], activity:[] });
  const [loading,setLoading] = useState(true);
  async function refresh() {
    try { const response=await fetch("/api/indexer",{cache:"no-store"}); if(!response.ok) throw new Error("Indexer unavailable"); setData(await response.json() as IndexerData); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void refresh(); const timer=window.setInterval(refresh,30_000); return()=>window.clearInterval(timer); },[]);
  return { data, loading, refresh };
}

function useWalletNfts(address?: string) {
  const [nfts,setNfts]=useState<WalletNft[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void (async()=>{
      await Promise.resolve();
      if(!active)return;
      if(!address){setNfts([]);setLoading(false);setError("");return;}
      setLoading(true);setError("");
      try{const response=await fetch(`/api/wallet-nfts?owner=${encodeURIComponent(address)}`,{cache:"no-store"});const body=await response.json() as {nfts?:WalletNft[];error?:string};if(!response.ok)throw new Error(body.error??"Could not load wallet NFTs.");if(active)setNfts(body.nfts??[]);}
      catch(e){if(active)setError(e instanceof Error?e.message:"Could not load wallet NFTs.");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[address]);
  return {nfts,loading,error};
}

export function Portal({ view }: { view:View }) {
  const { data,loading,refresh }=useIndexer();
  const { address }=useAccount();
  const walletNfts=useWalletNfts(address);
  const chainId=useChainId();
  const { switchChainAsync }=useSwitchChain();
  const { writeContractAsync }=useWriteContract();
  const [status,setStatus]=useState("");
  const addressForRead=data.marketplaceAddress ?? zeroAddress;
  const { data:proceeds, refetch:refetchProceeds }=useReadContract({ address:addressForRead, abi, functionName:"getProceeds", args:[address ?? zeroAddress], chainId:shibarium.id, query:{enabled:!!address && !!data.marketplaceAddress} });

  async function ensureChain(){ if(chainId!==shibarium.id) await switchChainAsync({chainId:shibarium.id}); }
  async function buy(item:Listing){ if(!address||!data.marketplaceAddress)return; try{await ensureChain();setStatus("Confirm the purchase in your wallet.");const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"buyItem",args:[item.nftAddress,BigInt(item.tokenId)],value:BigInt(item.price),chainId:shibarium.id});setStatus(`Purchase submitted · ${short(hash)}`);window.setTimeout(refresh,5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Purchase failed");} }
  async function list(nft:string,token:string,price:string){ if(!address||!data.marketplaceAddress)return; try{await ensureChain();const nftAddress=getAddress(nft);setStatus("Step 1 of 2 · Approve the marketplace.");await writeContractAsync({address:nftAddress,abi:erc721Abi,functionName:"approve",args:[data.marketplaceAddress,BigInt(token)],chainId:shibarium.id});setStatus("Step 2 of 2 · Confirm the listing.");const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"listItem",args:[nftAddress,BigInt(token),parseEther(price)],chainId:shibarium.id});setStatus(`Listing submitted · ${short(hash)}`);window.setTimeout(refresh,5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Listing failed");} }
  async function cancel(item:Listing){ if(!address||!data.marketplaceAddress)return;try{await ensureChain();const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"cancelListing",args:[item.nftAddress,BigInt(item.tokenId)],chainId:shibarium.id});setStatus(`Cancellation submitted · ${short(hash)}`);window.setTimeout(refresh,5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Cancellation failed");} }
  async function withdraw(){ if(!address||!data.marketplaceAddress)return;try{await ensureChain();const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"withdrawProceeds",chainId:shibarium.id});setStatus(`Withdrawal submitted · ${short(hash)}`);window.setTimeout(()=>refetchProceeds(),5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Withdrawal failed");} }

  const mine=useMemo(()=>data.listings.filter(x=>address&&x.seller.toLowerCase()===address.toLowerCase()),[data.listings,address]);
  const labels:Record<View,[string,string,string]>= { market:["01 / MARKET","Works before the court","Active listings verified from confirmed Shibarium events."], sell:["02 / PRESENT","Present a work","Approve and list an ERC-721 you own. The NFT remains in your wallet until sold."], activity:["03 / ACTIVITY","The onchain record","Listings, sales, cancellations, and withdrawals—directly from the contract log."], account:["04 / ACCOUNT","Your court account","Manage active listings and withdraw settled BONE proceeds."], protocol:["05 / PROTOCOL","Rules of the court","Transparent settlement, fees, royalties, and ownership mechanics."] };
  const [section,title,description]=labels[view];

  return <main className="portal-page">
    <PortalHeader />
    <section className="portal-hero"><Link href="/" className="back-link"><ArrowLeft size={14}/> House of Joshi</Link><span className="section-no">{section}</span><h1>{title}</h1><p>{description}</p></section>
    <section className="portal-content">
      {view==="market"&&<MarketView data={data} loading={loading} connected={!!address} onBuy={buy}/>} 
      {view==="sell" && (
        <SellView configured={!!data.marketplaceAddress} connected={!!address} walletNfts={walletNfts} onList={list}/>
      )}
      {view==="activity"&&<ActivityView items={data.activity} loading={loading}/>} 
      {view==="account"&&<AccountView connected={!!address} configured={!!data.marketplaceAddress} listings={mine} proceeds={proceeds ?? 0n} onCancel={cancel} onWithdraw={withdraw}/>} 
      {view==="protocol"&&<ProtocolView address={data.marketplaceAddress}/>} 
    </section>
    <PortalFooter />
    {status&&<div className="toast" role="status"><ShieldCheck size={18}/><span>{status}</span><button onClick={()=>setStatus("")}><X size={16}/></button></div>}
  </main>;
}

function PortalHeader(){return <header className="portal-header"><Link href="/" className="wordmark"><span className="sigil">HJ</span><span>HOUSE OF JOSHI</span></Link><nav><Link href="/market">Market</Link><Link href="/sell">Sell</Link><Link href="/activity">Activity</Link><Link href="/account">Account</Link><Link href="/protocol">Protocol</Link></nav><CourtConnect/></header>}
function CourtConnect(){return <ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=>!mounted||!account||!chain?<button className="wallet-button" onClick={openConnectModal}>Connect wallet</button>:chain.unsupported?<button className="wallet-button wrong-network" onClick={openChainModal}>Wrong network</button>:<button className="wallet-button" onClick={openAccountModal}><Wallet size={14}/>{account.displayName}</button>}</ConnectButton.Custom>}

function MarketView({data,loading,connected,onBuy}:{data:IndexerData;loading:boolean;connected:boolean;onBuy:(x:Listing)=>void}){if(!data.listings.length)return <Empty eyebrow={loading?"SYNCING SHIBARIUM":data.configured?"NO ACTIVE LISTINGS":"SETUP REQUIRED"} title={loading?"Reading the onchain record.":data.configured?"No works are listed.":"Connect the deployed contract."} detail={data.syncError||"Only verified active listings appear here."}/>;return <div className="portal-grid">{data.listings.map(x=><ListingTile key={x.id} item={x} action={connected?<button onClick={()=>onBuy(x)}>Acquire <ArrowUpRight size={14}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect to acquire</button>}</ConnectButton.Custom>}/>)}</div>}
function ListingTile({item,action}:{item:Listing;action:React.ReactNode}){return <article className="portal-card"><div className="portal-token"><span>ERC-721</span><strong>#{item.tokenId}</strong><i>{short(item.nftAddress)}</i></div><div className="portal-card-copy"><small>{short(item.nftAddress)}</small><h2>Token #{item.tokenId}</h2><p>Seller · {short(item.seller)}</p><div><span>Total price</span><strong>{formatEther(BigInt(item.price))} BONE</strong></div>{action}</div></article>}

function SellView({configured,connected,walletNfts,onList}:{configured:boolean;connected:boolean;walletNfts:{nfts:WalletNft[];loading:boolean;error:string};onList:(n:string,t:string,p:string)=>void}){
  const[nft,setNft]=useState("");const[token,setToken]=useState("");const[price,setPrice]=useState("");const[layout,setLayout]=useState<"grid"|"list">("grid");const[active,setActive]=useState<WalletNft|null>(null);
  const valid=/^0x[a-fA-F0-9]{40}$/.test(nft)&&/^\d+$/.test(token)&&Number(price)>0;
  function choose(item:WalletNft){setNft(item.contractAddress);setToken(item.tokenId);setActive(null);window.requestAnimationFrame(()=>document.getElementById("listing-price")?.focus());}
  return <><div className="sell-layout"><form onSubmit={e=>{e.preventDefault();if(valid)onList(nft,token,price)}}>{connected&&<section className="wallet-nfts"><div className="wallet-nfts-head"><div><span>YOUR SHIBARIUM NFTs</span><small>{walletNfts.loading?"Loading your wallet…":`${walletNfts.nfts.length} ERC-721 found`}</small></div><div className="layout-toggle" aria-label="NFT view"><button className={layout==="grid"?"active":""} type="button" onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={14}/></button><button className={layout==="list"?"active":""} type="button" onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div></div>{walletNfts.error?<p className="wallet-nfts-message">{walletNfts.error}</p>:walletNfts.loading?<p className="wallet-nfts-message">Reading your onchain holdings…</p>:walletNfts.nfts.length?<div className={`wallet-nft-grid ${layout}`}>{walletNfts.nfts.map(item=><button className="wallet-nft" type="button" key={`${item.contractAddress}:${item.tokenId}`} onClick={()=>setActive(item)}>{item.imageUrl?<span className="wallet-nft-image" style={{backgroundImage:`url(${item.imageUrl})`}}/>:<span className="wallet-nft-image empty"/>}<span>{item.collection??short(item.contractAddress)}</span><strong>{item.name??`Token #${item.tokenId}`}</strong><small>#{item.tokenId}</small></button>)}</div>:<p className="wallet-nfts-message">No ERC-721 NFTs found in this Shibarium wallet.</p>}</section>}<div className="listing-fields"><label><span>NFT contract</span><input value={nft} onChange={e=>setNft(e.target.value)} placeholder="0x…"/></label><div className="field-row"><label><span>Token ID</span><input value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter token ID"/></label><label><span>Total price in BONE</span><input id="listing-price" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Enter amount"/></label></div></div>{connected?<button disabled={!configured||!valid}>Approve & list <ArrowUpRight/></button>:<ConnectButton.Custom>{({openConnectModal})=><button type="button" onClick={openConnectModal}>Connect wallet <Wallet/></button>}</ConnectButton.Custom>}</form><aside><span>SETTLEMENT TERMS</span><h2>Your asset stays with you.</h2><p>Open a work to inspect its metadata, then set a BONE price and list it.</p><dl><div><dt>Marketplace fee</dt><dd>2%</dd></div><div><dt>Creator royalty</dt><dd>ERC-2981, if supported</dd></div><div><dt>Seller proceeds</dt><dd>Withdrawable in BONE</dd></div></dl></aside></div>{active&&<NftDetail item={active} onClose={()=>setActive(null)} onList={()=>choose(active)}/>}</>}

function NftDetail({item,onClose,onList}:{item:WalletNft;onClose:()=>void;onList:()=>void}){return <div className="nft-detail-backdrop" role="dialog" aria-modal="true" aria-label="NFT details" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><article className="nft-detail"><button className="nft-detail-close" onClick={onClose} aria-label="Close NFT details"><X size={18}/></button>{item.imageUrl?<div className="nft-detail-image" style={{backgroundImage:`url(${item.imageUrl})`}}/>:<div className="nft-detail-image empty"/>}<div className="nft-detail-copy"><small>{item.collection??short(item.contractAddress)} · ERC-721</small><h2>{item.name??`Token #${item.tokenId}`}</h2><p className="nft-token-id">#{item.tokenId} · {short(item.contractAddress)}</p>{item.description&&<p className="nft-description">{item.description}</p>}{item.traits.length>0&&<section className="nft-traits"><span>TRAITS</span><div>{item.traits.map(trait=><article key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></article>)}</div></section>}<div className="nft-detail-actions"><button onClick={onList}>List this NFT <ArrowUpRight size={15}/></button>{item.externalUrl&&<a href={item.externalUrl} target="_blank" rel="noreferrer">Collection link <ExternalLink size={14}/></a>}<a href={`https://shibariumscan.io/token/${item.contractAddress}/instance/${item.tokenId}`} target="_blank" rel="noreferrer">View on ShibariumScan <ExternalLink size={14}/></a></div></div></article></div>}

function ActivityView({items,loading}:{items:Activity[];loading:boolean}){if(!items.length)return <Empty eyebrow={loading?"SYNCING":"NO EVENTS"} title={loading?"Reading confirmed blocks.":"No activity recorded."} detail="Contract events will appear here after confirmation."/>;return <div className="portal-activity">{items.map(x=><a key={x.id} href={`https://shibariumscan.io/tx/${x.transactionHash}`} target="_blank" rel="noreferrer"><b>{x.eventType.toUpperCase()}</b><span>{x.nftAddress&&x.tokenId?`${short(x.nftAddress)} · #${x.tokenId}`:x.seller?short(x.seller):"Marketplace"}</span><span>{x.price?`${formatEther(BigInt(x.price))} BONE`:"—"}</span><span>Block {x.blockNumber}</span><ExternalLink size={14}/></a>)}</div>}

function AccountView({connected,configured,listings,proceeds,onCancel,onWithdraw}:{connected:boolean;configured:boolean;listings:Listing[];proceeds:bigint;onCancel:(x:Listing)=>void;onWithdraw:()=>void}){if(!connected)return <ConnectButton.Custom>{({openConnectModal})=><Empty eyebrow="WALLET REQUIRED" title="Connect to enter your account." detail="Your active listings and withdrawable proceeds will appear here." action={<button onClick={openConnectModal}>Connect wallet <Wallet size={15}/></button>}/>}</ConnectButton.Custom>;return <><div className="account-balance"><span>WITHDRAWABLE PROCEEDS</span><strong>{formatEther(proceeds)} BONE</strong><button disabled={!configured||proceeds===0n} onClick={onWithdraw}>Withdraw proceeds <ArrowUpRight/></button></div><div className="account-section"><span className="section-no">ACTIVE LISTINGS</span>{listings.length?<div className="portal-grid account-grid">{listings.map(x=><ListingTile key={x.id} item={x} action={<button onClick={()=>onCancel(x)}>Cancel listing</button>}/>)}</div>:<p className="account-empty">You have no active listings.</p>}</div></>}

function ProtocolView({address}:{address?:string}){return <div className="protocol-grid"><article><span>01</span><h2>Non-custodial</h2><p>Listed NFTs stay in the owner’s wallet. The marketplace transfers only after exact payment and valid approval.</p></article><article><span>02</span><h2>Fixed 2% fee</h2><p>The buyer pays the displayed listing price. Two percent is permanently credited to the House of Joshi treasury; the remainder goes to the seller after royalties.</p></article><article><span>03</span><h2>Creator royalties</h2><p>Collections implementing ERC-2981 receive the royalty returned for the sale price, using the same BONE settlement.</p></article><article><span>04</span><h2>Pull payments</h2><p>Sellers, creators, and the treasury withdraw proceeds themselves, preventing a recipient from blocking a sale.</p></article><article><span>HOUSE TREASURY</span><h2>0x6736…6a5f</h2><p>Immutable fee recipient: 0x6736d2eA9807297F0e56967361B9410854B86a5f</p></article><article className="contract-record"><span>CONTRACT RECORD</span><h2>{address?short(address):"Not deployed"}</h2>{address&&<a href={`https://shibariumscan.io/address/${address}`} target="_blank" rel="noreferrer">View on ShibariumScan <ExternalLink size={14}/></a>}</article></div>}

function Empty({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail:string;action?:React.ReactNode}){return <div className="portal-empty"><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p>{action}</div>}
function PortalFooter(){return <footer className="portal-footer"><Link href="/" className="wordmark"><span className="sigil">HJ</span><span>HOUSE OF JOSHI</span></Link><span>SHIBARIUM · CHAIN 109 · 2% PROTOCOL FEE</span><a href="https://shibariumscan.io" target="_blank" rel="noreferrer">ShibariumScan <ExternalLink size={12}/></a></footer>}
