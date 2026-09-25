"use client";

import { ImageIcon, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Listing={id:string;chainId:MarketplaceChainId;nftAddress:string;tokenId:string;price:string};
type SearchItem=Listing&{name:string|null;collection:string|null;imageUrl:string|null};
type IndexerData={listings?:Listing[]};

export default function SearchPage(){
  const[query,setQuery]=useState("");const[items,setItems]=useState<SearchItem[]>([]);const[loading,setLoading]=useState(true);const[chainFilter,setChainFilter]=useState<"all"|MarketplaceChainId>("all");
  useEffect(()=>{let active=true;void(async()=>{
    const chainIds=Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[];
    const indexed=await Promise.allSettled(chainIds.map(async chainId=>{const response=await fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"});const data=response.ok?await response.json() as IndexerData:null;return data?.listings??[];}));
    const listings=indexed.flatMap(result=>result.status==="fulfilled"?result.value:[]);
    const enriched=await Promise.all(listings.map(async listing=>{try{const params=new URLSearchParams({chainId:String(listing.chainId),contract:listing.nftAddress,tokenId:listing.tokenId});const response=await fetch(`/api/nft?${params}`,{cache:"no-store"});const metadata=response.ok?await response.json() as Pick<SearchItem,"name"|"collection"|"imageUrl">:null;return{...listing,name:metadata?.name??null,collection:metadata?.collection??null,imageUrl:metadata?.imageUrl??null};}catch{return{...listing,name:null,collection:null,imageUrl:null};}}));
    if(active){setItems(enriched);setLoading(false);}
  })();return()=>{active=false;};},[]);
  const results=useMemo(()=>{const needle=query.trim().toLowerCase();if(!needle)return[];return items.filter(item=>(chainFilter==="all"||item.chainId===chainFilter)&&[item.name,item.collection,item.nftAddress,item.tokenId].some(value=>value?.toLowerCase().includes(needle)));},[query,items,chainFilter]);
  return <main className="royal-page"><section className="royal-page-hero"><div className="royal-badge"><Search size={16}/><span>Search</span></div><h1>Search NFTs</h1><p>Find live listings by NFT name, collection, contract address or token ID.</p></section><section className="royal-content"><div className="royal-search-container"><div className="royal-search-box"><Search size={22}/><input type="search" placeholder="Search name, collection, contract or token ID" value={query} onChange={event=>setQuery(event.target.value)} className="royal-search-input" autoFocus/></div><select className="royal-search-chain" value={chainFilter} onChange={event=>setChainFilter(event.target.value==="all"?"all":Number(event.target.value) as MarketplaceChainId)}><option value="all">All networks</option>{Object.entries(marketplaceChains).map(([id,chain])=><option value={id} key={id}>{chain.name}</option>)}</select></div>
    {loading?<div className="royal-loading-grid">{[...Array(4)].map((_,i)=><div key={i} className="royal-skeleton-card"/>)}</div>:query&&!results.length?<div className="royal-empty-state"><Search size={48}/><h2>No matching NFTs</h2><p>Try a collection name, exact contract address or token ID.</p></div>:results.length?<><p className="royal-search-count">{results.length} {results.length===1?"result":"results"}</p><div className="royal-portfolio-grid">{results.map(item=>{const chain=getMarketplaceChain(item.chainId);return <Link className="royal-profile-nft" href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}`} key={item.id}><div className="royal-nft-image" style={item.imageUrl?{backgroundImage:`url(${item.imageUrl})`}:undefined}>{!item.imageUrl&&<ImageIcon size={32}/>}</div><div className="royal-nft-details"><small>{item.collection??chain.name}</small><h3>{item.name??`Token #${item.tokenId}`}</h3><div className="royal-nft-status"><span className="listed">{formatEther(BigInt(item.price))} {chain.currency}</span></div></div></Link>;})}</div></>:<div className="royal-search-placeholder"><Search size={40}/><h2>Search the marketplace</h2><p>Results only include NFTs currently indexed by House of Joshi.</p></div>}
  </section></main>;
}
