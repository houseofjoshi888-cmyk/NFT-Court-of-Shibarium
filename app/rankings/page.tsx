"use client";

import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Collection={nftAddress:string;floorPrice:string;listingCount:number;latestBlock:number};
type Activity={nftAddress:string|null;eventType:string};
type Indexer={collections?:Collection[];activity?:Activity[]};
type RankedCollection={chainId:MarketplaceChainId;address:string;floorPrice:string|null;listingCount:number;sales:number;latestBlock:number};

export default function RankingsPage(){
  const[rankings,setRankings]=useState<RankedCollection[]>([]);
  const[loading,setLoading]=useState(true);
  const[partial,setPartial]=useState(false);
  useEffect(()=>{
    let active=true;
    const chains=Object.values(marketplaceChains).filter(chain=>chain.marketplaceStatus==="live");
    void Promise.allSettled(chains.map(async chain=>{
      const response=await fetch(`/api/indexer?chainId=${chain.id}`,{cache:"no-store",signal:AbortSignal.timeout(15_000)});
      if(!response.ok)throw new Error(`${chain.name} indexer unavailable`);
      return {chainId:chain.id as MarketplaceChainId,data:await response.json() as Indexer};
    })).then(results=>{
      if(!active)return;
      const rows:RankedCollection[]=[];
      let failed=false;
      for(const result of results){
        if(result.status!=="fulfilled"){failed=true;continue;}
        const {chainId,data}=result.value;
        const byAddress=new Map<string,RankedCollection>();
        for(const collection of data.collections??[]){
          const address=collection.nftAddress.toLowerCase();
          byAddress.set(address,{chainId,address:collection.nftAddress,floorPrice:collection.floorPrice,listingCount:collection.listingCount,sales:0,latestBlock:collection.latestBlock});
        }
        for(const activity of data.activity??[]){
          if(!activity.nftAddress||!["sold","offer_accepted"].includes(activity.eventType))continue;
          const key=activity.nftAddress.toLowerCase();
          const row=byAddress.get(key)??{chainId,address:activity.nftAddress,floorPrice:null,listingCount:0,sales:0,latestBlock:0};
          row.sales+=1;
          byAddress.set(key,row);
        }
        rows.push(...byAddress.values());
      }
      rows.sort((a,b)=>b.sales-a.sales||b.listingCount-a.listingCount||b.latestBlock-a.latestBlock);
      setRankings(rows);
      setPartial(failed);
      setLoading(false);
    });
    return()=>{active=false;};
  },[]);
  return <main className="royal-page">
    <section className="royal-page-hero"><div className="royal-badge"><TrendingUp size={16}/><span>Rankings</span></div><h1>Marketplace Rankings</h1><p>Collections ranked by confirmed marketplace sales, then active listings. Prices stay in each network’s own currency.</p></section>
    <section className="royal-content hoj-rankings-content">
      {loading?<p className="hoj-rankings-state">Reading confirmed marketplace activity…</p>:<>
        {partial&&<p className="hoj-rankings-state">Some networks are temporarily unavailable; rankings may be incomplete.</p>}
        {rankings.length===0?<p className="hoj-rankings-state">No ranked collections are available yet.</p>:<div className="hoj-rankings-list">{rankings.slice(0,50).map((item,index)=>{
          const chain=getMarketplaceChain(item.chainId);
          return <Link key={`${item.chainId}:${item.address.toLowerCase()}`} href={`/collection/${item.chainId}/${item.address}`} className="hoj-ranking-row">
            <span className="hoj-ranking-number">{index+1}</span><div className="hoj-ranking-collection"><strong>{item.address.slice(0,8)}…{item.address.slice(-6)}</strong><small>{chain.name}</small></div>
            <div><small>Sales</small><strong>{item.sales}</strong></div><div><small>Listed</small><strong>{item.listingCount}</strong></div><div><small>Floor</small><strong>{item.floorPrice!==null?`${formatEther(BigInt(item.floorPrice))} ${chain.currency}`:"—"}</strong></div>
          </Link>;
        })}</div>}
      </>}
    </section>
  </main>;
}
