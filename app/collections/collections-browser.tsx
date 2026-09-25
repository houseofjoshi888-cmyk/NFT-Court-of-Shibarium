"use client";

import { ArrowUpRight, ExternalLink, Flame, Grid2X2, List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import { getMarketplaceChain, isMarketplaceLive, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Mint = {
  tokenId:string; owner:string; transactionHash:string; sourceText:string; imageURI:string|null;
  numericalSignature:number; symmetry:number; rotation:number; hue:number; verificationStatus:string;
};
type MalkutaData = { status:string; collectionTotal:number; indexedThroughBlock:string; latestMints:Mint[] };
type Listing = { id:string; chainId:MarketplaceChainId; nftAddress:string; tokenId:string; seller:string; price:string; transactionHash:string };
type Activity = { id:string; chainId:MarketplaceChainId; eventType:string; nftAddress:string|null; tokenId:string|null; price:string|null; blockNumber:number };
type ChainListings = { chainId:MarketplaceChainId; chain:string; currency:string; configured:boolean; listings:Listing[]; activity:Activity[] };
type NftMetadata = { name:string|null; collection:string|null; imageUrl:string|null };
type TrendingCollection = { key:string; chainId:MarketplaceChainId; nftAddress:string; sales:number; recentEvents:number; activeListings:number; floorPrice:bigint; representativeTokenId:string };

const chainIds = Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[];
const liveChainIds = chainIds.filter(isMarketplaceLive);
const short = (value:string) => `${value.slice(0,6)}…${value.slice(-4)}`;
const ipfs = (value:string|null) => value?.startsWith("ipfs://")?`https://ipfs.io/ipfs/${value.slice(7)}`:value;

export function CollectionsBrowser(){
  const [malkuta,setMalkuta]=useState<MalkutaData|null>(null);
  const [chains,setChains]=useState<ChainListings[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [activeChain,setActiveChain]=useState<"all"|MarketplaceChainId>("all");
  const [layout,setLayout]=useState<"grid"|"list">("grid");

  useEffect(()=>{
    let active=true;
    async function refresh(){
      // Load Shibarium first for instant content
      const shibariumResult = await Promise.allSettled([
        fetch("/api/malkuta",{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject()),
        fetch(`/api/indexer?chainId=109`,{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject()),
      ]);
      
      if(!active)return;
      if(shibariumResult[0].status==="fulfilled")setMalkuta(shibariumResult[0].value as MalkutaData);
      const shibarium=shibariumResult[1];
      if(shibarium.status==="fulfilled")setChains(previous=>[...previous.filter(chain=>chain.chainId!==109),shibarium.value as ChainListings]);
      setLoading(false);

      // Load other chains in background
      const otherChains = chainIds.filter(id => id !== 109);
      const otherResults = await Promise.allSettled(
        otherChains.map(chainId=>fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject()))
      );
      
      if(active){
        setChains(prev => {
          const latest=new Map(prev.map(chain=>[chain.chainId,chain]));
          otherResults.forEach(result=>{if(result.status==="fulfilled"){const chain=result.value as ChainListings;latest.set(chain.chainId,chain);}});
          return [...latest.values()];
        });
      }
    }
    void refresh();
    const timer=window.setInterval(refresh,30_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);

  const listings=useMemo(()=>chains.flatMap(chain=>chain.listings),[chains]);
  const trending=useMemo<TrendingCollection[]>(()=>{
    const records=new Map<string,TrendingCollection>();
    for(const chain of chains){
      for(const listing of chain.listings){
        const key=`${chain.chainId}:${listing.nftAddress.toLowerCase()}`;
        const current=records.get(key)??{key,chainId:chain.chainId,nftAddress:listing.nftAddress,sales:0,recentEvents:0,activeListings:0,floorPrice:BigInt(0),representativeTokenId:listing.tokenId};
        current.activeListings+=1;
        if(BigInt(listing.price) < current.floorPrice || current.floorPrice === 0n) {
          current.floorPrice = BigInt(listing.price);
        }
        records.set(key,current);
      }
      for(const event of chain.activity??[]){
        if(!event.nftAddress||!event.tokenId)continue;
        const key=`${chain.chainId}:${event.nftAddress.toLowerCase()}`;
        const current=records.get(key)??{key,chainId:chain.chainId,nftAddress:event.nftAddress,sales:0,recentEvents:0,activeListings:0,floorPrice:BigInt(0),representativeTokenId:event.tokenId};
        current.recentEvents+=1;
        if((["sold","offer_accepted"].includes(event.eventType)))current.sales+=1;
        records.set(key,current);
      }
    }
    return [...records.values()].filter(item=>item.recentEvents||item.activeListings).sort((a,b)=>(b.sales*10+b.recentEvents*2+b.activeListings)-(a.sales*10+a.recentEvents*2+a.activeListings)).slice(0,6);
  },[chains]);
  const visibleListings=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return listings.filter(item=>(activeChain==="all"||item.chainId===activeChain)&&(!term||item.nftAddress.toLowerCase().includes(term)||item.tokenId.includes(term)));
  },[listings,activeChain,query]);

  return <main className="collections-page">
    <section className="collections-hero">
      <div><span>VERIFIED COLLECTIONS</span><h1>Marketplace Collections</h1><p>Minted works and active marketplace listings, organized by their onchain network.</p></div>
      <a href="https://kingdomwithin.thehouseofjoshi.com/" target="_blank" rel="noreferrer">Visit Kingdom Within <ExternalLink size={14}/></a>
    </section>

    <section className="featured-collection">
      <header><div><span>TRENDING · BASE</span><h2>Malkuta Mandalas</h2><p>Verified canonical mints from the Kingdom Within Malkuta Protocol.</p></div><dl><div><dt>MINTED</dt><dd>{malkuta?.collectionTotal??(loading?"…":"—")}</dd></div><div><dt>NETWORK</dt><dd>BASE</dd></div></dl></header>
      {malkuta?.latestMints?.length?<div className="malkuta-grid">{malkuta.latestMints.map(mint=><article className="malkuta-card" key={mint.tokenId}><a className="malkuta-art" href={`https://kingdomwithin.thehouseofjoshi.com/verify?token=${mint.tokenId}`} target="_blank" rel="noreferrer" style={ipfs(mint.imageURI)?{backgroundImage:`url(${ipfs(mint.imageURI)})`}:undefined}><span>#{mint.tokenId.slice(0,8)}…</span><small>{mint.verificationStatus==="verified"?"✓ VERIFIED":"METADATA PENDING"}</small></a><div><span>MALKUTA MANDALA</span><h3>{mint.sourceText.split("\n")[0]||`Signal ${mint.numericalSignature}`}</h3><dl><div><dt>SIGNATURE</dt><dd>Σ {mint.numericalSignature}</dd></div><div><dt>SYMMETRY</dt><dd>{mint.symmetry} PETALS</dd></div></dl><a href={`https://kingdomwithin.thehouseofjoshi.com/verify?token=${mint.tokenId}`} target="_blank" rel="noreferrer">Verify NFT <ArrowUpRight size={13}/></a></div></article>)}</div>:<div className="collection-loading">{loading?"Reading verified Malkuta mints…":"The official mint archive is temporarily unavailable."}</div>}
    </section>

    {(loading||trending.length>0)&&<section className="trending-collections">
      <header><div><span><Flame size={13}/> LIVE MARKET SIGNALS</span><h2>Trending collections</h2><p>Ranked from recent confirmed sales, marketplace activity, and active listings.</p></div><small>Updates every 30 seconds</small></header>
      {trending.length?<div className="trending-collection-grid">{trending.map((item,index)=><TrendingCollectionCard key={item.key} item={item} rank={index+1}/>)}</div>:<div className="collection-loading">Reading marketplace activity…</div>}
    </section>}

    <section className="listed-collections">
      <header><div><span>MARKETPLACE</span><h2>Listed NFTs by network</h2></div><div className="collection-view-toggle"><button className={layout==="grid"?"active":""} onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={15}/></button><button className={layout==="list"?"active":""} onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div></header>
      <div className="collection-browser">
        <aside aria-label="Filter listed NFTs">
          <label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search contract or token" aria-label="Search contract or token"/></label>
          <span>LIVE NETWORKS</span>
          <div className="collection-chain-filters">
            <button type="button" className={activeChain==="all"?"active":""} aria-pressed={activeChain==="all"} onClick={()=>setActiveChain("all")}><b>All networks</b><em>{listings.length} NFTs</em></button>
            {liveChainIds.map(chainId=>{const chain=getMarketplaceChain(chainId);const chainListings=listings.filter(item=>item.chainId===chainId);const count=chainListings.length;const floorPrice=chainListings.length>0?chainListings.reduce((min,item)=>{const price=BigInt(item.price);return price<min?price:min;},BigInt(chainListings[0].price)):0n;return <button key={chainId} type="button" className={activeChain===chainId?"active":""} aria-pressed={activeChain===chainId} onClick={()=>setActiveChain(chainId)}><i aria-hidden="true"/><b>{chain.name}</b><em>{count} NFTs</em><small>Lowest: {floorPrice>0n?formatEther(floorPrice):"—"} {chain.currency}</small></button>})}
          </div>
        </aside>
        <div className={`chain-listings ${layout}`}>{visibleListings.length?visibleListings.map(item=><ListedNft key={item.id} item={item}/>):<div className="collection-loading">{loading?"Reading confirmed listings…":<div><p>{query.trim()?"No NFTs match your search.":`No active NFT listings${activeChain==="all"?"":` on ${getMarketplaceChain(activeChain).name}`} yet.`}</p><Link href="/sell">List an NFT <ArrowUpRight size={15}/></Link></div>}</div>}</div>
      </div>
    </section>
  </main>;
}

function TrendingCollectionCard({item,rank}:{item:TrendingCollection;rank:number}){
  const [nft,setNft]=useState<NftMetadata|null>(null);
  const chain=getMarketplaceChain(item.chainId);
  useEffect(()=>{let active=true;void fetch(`/api/nft?contract=${item.nftAddress}&tokenId=${item.representativeTokenId}&chainId=${item.chainId}`,{cache:"no-store"}).then(response=>response.ok?response.json():null).then(value=>{if(active)setNft(value as NftMetadata|null)}).catch(()=>{});return()=>{active=false};},[item]);
  return <a className="trending-collection-card" href={`/collection/${item.chainId}/${item.nftAddress}`}><div className="trending-collection-art" style={nft?.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}><b>#{rank}</b>{!nft?.imageUrl&&<span>{short(item.nftAddress)}</span>}</div><div><small>{chain.name}</small><h3>{nft?.collection??short(item.nftAddress)}</h3><dl><div><dt>OBSERVED HOJ LOW</dt><dd>{item.floorPrice > 0n ? formatEther(item.floorPrice) : "—"} {chain.currency}</dd></div><div><dt>RECENT SALES</dt><dd>{item.sales}</dd></div><div><dt>ACTIVE LISTINGS</dt><dd>{item.activeListings}</dd></div><div><dt>ACTIVITY</dt><dd>{item.recentEvents}</dd></div></dl><span>Explore collection <ArrowUpRight size={13}/></span></div></a>;
}

function ListedNft({item}:{item:Listing}){
  const [nft,setNft]=useState<NftMetadata|null>(null);
  const chain=getMarketplaceChain(item.chainId);
  useEffect(()=>{let active=true;void fetch(`/api/nft?contract=${item.nftAddress}&tokenId=${item.tokenId}&chainId=${item.chainId}`).then(response=>response.ok?response.json():null).then(value=>{if(active)setNft(value as NftMetadata|null)}).catch(()=>{});return()=>{active=false};},[item]);
  return <Link href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}`} className="chain-listing">
    <div className="chain-listing-art" style={nft?.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}>{!nft?.imageUrl&&<strong>#{item.tokenId}</strong>}<span>{chain.name}</span></div>
    <div><small>{nft?.collection??short(item.nftAddress)}</small><h3>{nft?.name??`Token #${item.tokenId}`}</h3><p><span>LISTING PRICE</span><strong>{formatEther(BigInt(item.price))} {chain.currency}</strong></p><span>View NFT <ArrowUpRight size={13}/></span></div>
  </Link>;
}
