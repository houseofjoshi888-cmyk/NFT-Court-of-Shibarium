"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc721Abi, formatEther, isAddress, type Address } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { marketplaceAbi, parseNativeAmount, type IndexedOffer } from "@/lib/marketplace-abi";
import { TransactionStatus, useMarketplaceTransaction } from "./use-marketplace-transaction";

type Props={nftAddress?:string;tokenId?:string;chainId:number;isOwner?:boolean;ownerAddress?:string;onChanged?:()=>void};
type Snapshot={marketplaceAddress:Address;version:number;proceeds:string;now:number;offers:IndexedOffer[];warning?:string|null};
export function OffersPanel(props:Props){
  const {address}=useAccount();
  if(!isMarketplaceChainId(props.chainId))return <p>Unsupported network.</p>;
  return <OfferControls key={`${props.chainId}:${props.nftAddress}:${props.tokenId}:${address}`} {...props} chainId={props.chainId}/>;
}
function OfferControls({nftAddress,tokenId,chainId,onChanged}:Props&{chainId:MarketplaceChainId}){
  const {address}=useAccount(),client=usePublicClient({chainId});
  const chain=getMarketplaceChain(chainId),tx=useMarketplaceTransaction(chainId);
  const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(!!nftAddress||!!address);
  const [amount,setAmount]=useState(""),[days,setDays]=useState("7");
  const [tab,setTab]=useState<"received"|"sent">("received");
  const [refresh,setRefresh]=useState(0),[clock,setClock]=useState(0);
  const query=new URLSearchParams({chainId:String(chainId)});
  if(nftAddress&&tokenId!==undefined){query.set("nftAddress",nftAddress);query.set("tokenId",tokenId);}
  if(address)query.set("wallet",address);
  const url=`/api/offers?${query}`;
  const reload=useCallback(()=>{setRefresh(n=>n+1);onChanged?.();},[onChanged]);
  useEffect(()=>{
    if(!nftAddress&&!address)return;
    const controller=new AbortController();
    async function load(){try{
      const response=await fetch(url,{cache:"no-store",signal:controller.signal});
      const body=await response.json() as Snapshot & {error?:string};if(!response.ok)throw new Error(body.error??"Offers unavailable.");
      if(!controller.signal.aborted){setData(body as Snapshot);setClock(Date.now());setError("");}
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Offers unavailable.");}
    finally{if(!controller.signal.aborted)setLoading(false);}}
    void load();const timer=window.setInterval(load,30_000);
    return()=>{controller.abort();window.clearInterval(timer);};
  },[url,refresh,nftAddress,address]);
  const [now,setNow]=useState(0);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1_000);return()=>window.clearInterval(timer);},[]);
  const chainNow=data?data.now+Math.max(0,Math.floor((now-clock)/1000)):0;
  let value=0n;try{value=parseNativeAmount(amount);}catch{/* Display validation at the input. */}
  const supported=!!data&&data.version>=2&&!error;
  const offers=data?.offers??[];
  const visible=nftAddress?offers:offers.filter(o=>tab==="sent"?o.buyer.toLowerCase()===address?.toLowerCase():o.owner?.toLowerCase()===address?.toLowerCase());
  async function makeOffer(){
    if(!supported||!data||!client||!address||!nftAddress||tokenId===undefined||value<=0n)return;
    const ok=await tx.run("Offer",async send=>{
      const block=await client.getBlock();
      await send({address:data.marketplaceAddress,abi:marketplaceAbi,functionName:"makeOffer",args:[nftAddress as Address,BigInt(tokenId),block.timestamp+BigInt(Number(days)*86400)],value});
    });
    if(ok){setAmount("");reload();}
  }
  async function cancel(offer:IndexedOffer){
    if(!data)return;
    const ok=await tx.run("Offer cancellation",async send=>{await send({address:data.marketplaceAddress,abi:marketplaceAbi,functionName:"cancelOffer",args:[offer.nftAddress,BigInt(offer.tokenId)]});});
    if(ok)reload();
  }
  async function accept(offer:IndexedOffer){
    if(!data||!client||!address)return;
    const ok=await tx.run("Offer acceptance",async send=>{
      const token=BigInt(offer.tokenId);
      const [owner,current,approved,all,block]=await Promise.all([
        client.readContract({address:offer.nftAddress,abi:erc721Abi,functionName:"ownerOf",args:[token]}),
        client.readContract({address:data.marketplaceAddress,abi:marketplaceAbi,functionName:"getOffer",args:[offer.nftAddress,token,offer.buyer]}),
        client.readContract({address:offer.nftAddress,abi:erc721Abi,functionName:"getApproved",args:[token]}),
        client.readContract({address:offer.nftAddress,abi:erc721Abi,functionName:"isApprovedForAll",args:[address,data.marketplaceAddress]}),client.getBlock(),
      ]);
      if(owner.toLowerCase()!==address.toLowerCase())throw new Error("Only the current NFT owner can accept this offer.");
      if(current.amount!==BigInt(offer.amount)||Number(current.expiresAt)!==offer.expiresAt)throw new Error("The offer changed. Refresh and review the new terms.");
      if(current.amount===0n||current.expiresAt<=block.timestamp)throw new Error("This offer is no longer active.");
      if(!all&&approved.toLowerCase()!==data.marketplaceAddress.toLowerCase())await send({address:offer.nftAddress,abi:erc721Abi,functionName:"approve",args:[data.marketplaceAddress,token]},"NFT approval");
      // Recheck after approval; do not accept changed terms after a second wallet prompt.
      const fresh=await client.readContract({address:data.marketplaceAddress,abi:marketplaceAbi,functionName:"getOffer",args:[offer.nftAddress,token,offer.buyer]});
      if(fresh.amount!==current.amount||fresh.expiresAt!==current.expiresAt)throw new Error("The offer changed. Refresh and review the new terms.");
      await send({address:data.marketplaceAddress,abi:marketplaceAbi,functionName:"acceptOffer",args:[offer.nftAddress,token,offer.buyer]});
    });
    if(ok)reload();
  }
  async function withdraw(){if(!data)return;const ok=await tx.run("Withdrawal",async send=>{await send({address:data.marketplaceAddress,abi:marketplaceAbi,functionName:"withdrawProceeds"});});if(ok)reload();}
  return <section className="royal-offers-panel">
    <div className="royal-offers-header"><h3>Offers · {chain.name}</h3><button type="button" onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div>
    <p>Offers deposit {chain.currency} into the marketplace. Cancel an active or expired offer, then withdraw its deposit below. Replacing an offer also makes the previous deposit withdrawable.</p>
    {error&&<p role="alert">{error}</p>}{data?.warning&&<p role="status">{data.warning}</p>}
    {!address&&<ConnectButton.Custom>{({openConnectModal})=><button type="button" onClick={openConnectModal}>Connect wallet</button>}</ConnectButton.Custom>}
    {nftAddress&&supported&&address&&<form className="royal-make-offer-form" onSubmit={e=>{e.preventDefault();void makeOffer();}}>
      <label>Offer amount ({chain.currency})<input aria-label={`Offer amount (${chain.currency})`} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.1"/></label>
      {amount&&value===0n&&<p role="alert">Enter an amount greater than zero with at most 18 decimal places.</p>}
      <label>Expires after<select value={days} onChange={e=>setDays(e.target.value)}>{[1,3,7,14,30].map(day=><option key={day} value={day}>{day} days</option>)}</select></label>
      <button type="submit" disabled={tx.pending||value===0n}>Deposit &amp; make offer</button>
    </form>}
    {!nftAddress&&<nav aria-label="Offer direction"><button onClick={()=>setTab("received")} aria-pressed={tab==="received"}>Received</button><button onClick={()=>setTab("sent")} aria-pressed={tab==="sent"}>Sent &amp; refundable</button></nav>}
    {loading?<p>Checking offers on chain…</p>:!visible.length?<p>{error?"Offers could not be loaded.":"No matching funded offers found."}</p>:<div className="royal-offers-list">{visible.map(offer=>{
      const expired=offer.expiresAt<=chainNow,own=offer.buyer.toLowerCase()===address?.toLowerCase(),owner=offer.owner?.toLowerCase()===address?.toLowerCase();
      return <article className="royal-offer-item" key={offer.id}>
        <div><Link href={`/nft/${chainId}/${offer.nftAddress}/${offer.tokenId}`}>NFT #{offer.tokenId}</Link><strong>{formatEther(BigInt(offer.amount))} {chain.currency}</strong><p>From {offer.buyer.slice(0,6)}…{offer.buyer.slice(-4)} · {expired?"Expired — deposit recoverable":`Expires ${new Date(offer.expiresAt*1000).toLocaleString()}`}</p></div>
        {own?<button disabled={tx.pending||!!error} onClick={()=>void cancel(offer)}>{expired?"Recover deposit":"Cancel offer"}</button>:owner&&!expired?<div><small>2% marketplace fee plus any creator royalty is deducted. Proceeds become withdrawable.</small><button disabled={tx.pending||!!error} onClick={()=>void accept(offer)}>Accept {formatEther(BigInt(offer.amount))} {chain.currency}</button></div>:null}
      </article>;
    })}</div>}
    {address&&data&&<div className="royal-withdrawal"><h4>Available to withdraw</h4><strong>{formatEther(BigInt(data.proceeds))} {chain.currency}</strong><p>Includes sale proceeds, canceled offers, and replaced offer deposits on {chain.name}.</p><button disabled={tx.pending||!!error||BigInt(data.proceeds)===0n} onClick={()=>void withdraw()}>Withdraw to wallet</button></div>}
    <TransactionStatus transaction={tx}/>
  </section>;
}
export function WalletOffers(){
  const [chainId,setChainId]=useState<MarketplaceChainId>(109),[contract,setContract]=useState(""),[token,setToken]=useState("");
  const valid=isAddress(contract,{strict:false})&&/^\d+$/.test(token);
  return <><label>Offers network<select value={chainId} onChange={e=>setChainId(Number(e.target.value) as MarketplaceChainId)}>{Object.values(marketplaceChains).map(chain=><option key={chain.id} value={chain.id}>{chain.name}</option>)}</select></label><OffersPanel chainId={chainId}/><details><summary>Find a missing offer or recover its deposit</summary><p>Open the NFT directly to read your funded offer even if the indexer has not caught up.</p><label>NFT contract<input value={contract} onChange={e=>setContract(e.target.value)} placeholder="0x…"/></label><label>Token ID<input value={token} onChange={e=>setToken(e.target.value)} inputMode="numeric"/></label>{valid&&<Link href={`/nft/${chainId}/${contract}/${token}`}>Open NFT and offers</Link>}</details></>;
}
