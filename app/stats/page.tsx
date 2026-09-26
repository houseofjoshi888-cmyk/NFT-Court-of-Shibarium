"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Listing={chainId:MarketplaceChainId;nftAddress:string;price:string};
type Activity={chainId:MarketplaceChainId;eventType:string;nftAddress:string|null;price:string|null};
type IndexerData={listings?:Listing[];activity?:Activity[]};

export default function StatsPage(){
  const[listings,setListings]=useState<Listing[]>([]);const[activity,setActivity]=useState<Activity[]>([]);const[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;void(async()=>{const chainIds=Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[];const responses=await Promise.allSettled(chainIds.map(async chainId=>{const response=await fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"});return response.ok?await response.json() as IndexerData:null;}));if(!active)return;setListings(responses.flatMap(result=>result.status==="fulfilled"?result.value?.listings??[]:[]));setActivity(responses.flatMap(result=>result.status==="fulfilled"?result.value?.activity??[]:[]));setLoading(false);})();return()=>{active=false;};},[]);
  const sales=useMemo(()=>activity.filter(item=>(["sold","offer_accepted"].includes(item.eventType))&&item.price),[activity]);
  const collections=useMemo(()=>new Set([...listings.map(item=>`${item.chainId}:${item.nftAddress.toLowerCase()}`),...activity.flatMap(item=>item.nftAddress?[`${item.chainId}:${item.nftAddress.toLowerCase()}`]:[])]),[listings,activity]);
  const chainRows=useMemo(()=>(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).map(chainId=>{const chainSales=sales.filter(item=>item.chainId===chainId);return{chainId,listings:listings.filter(item=>item.chainId===chainId).length,sales:chainSales.length,volume:chainSales.reduce((sum,item)=>sum+BigInt(item.price??"0"),0n)};}),[listings,sales]);
  return <main className="royal-page"><section className="royal-page-hero"><div className="royal-badge"><BarChart3 size={16}/><span>Statistics</span></div><h1>Marketplace Statistics</h1><p>Confirmed listings and sales from House of Joshi contracts across supported networks.</p></section><section className="royal-content">{loading?<div className="royal-loading-grid">{[...Array(4)].map((_,i)=><div key={i} className="royal-skeleton-card"/>)}</div>:<><div className="royal-stats-grid"><div className="royal-stat-card"><h3>Active Listings</h3><p>{listings.length.toLocaleString()}</p></div><div className="royal-stat-card"><h3>Confirmed Sales</h3><p>{sales.length.toLocaleString()}</p></div><div className="royal-stat-card"><h3>Indexed Collections</h3><p>{collections.size.toLocaleString()}</p></div><div className="royal-stat-card"><h3>Supported Networks</h3><p>{Object.keys(marketplaceChains).length}</p></div></div><div className="royal-stats-table"><div className="royal-stats-row header"><span>Network</span><span>Listings</span><span>Sales</span><span>Volume</span></div>{chainRows.map(row=>{const chain=getMarketplaceChain(row.chainId);return <div className="royal-stats-row" key={row.chainId}><strong>{chain.name}</strong><span>{row.listings}</span><span>{row.sales}</span><span>{formatEther(row.volume)} {chain.currency}</span></div>;})}</div></>}</section></main>;
}
