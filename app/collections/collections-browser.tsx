"use client";

import { ArrowUpRight, ExternalLink, Grid2X2, List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, tokenUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Mint = {
  tokenId:string; owner:string; transactionHash:string; sourceText:string; imageURI:string|null;
  numericalSignature:number; symmetry:number; rotation:number; hue:number; verificationStatus:string;
};
type MalkutaData = { status:string; collectionTotal:number; indexedThroughBlock:string; latestMints:Mint[] };
type Listing = { id:string; chainId:MarketplaceChainId; nftAddress:string; tokenId:string; seller:string; price:string; transactionHash:string };
type ChainListings = { chainId:MarketplaceChainId; chain:string; currency:string; configured:boolean; listings:Listing[] };
type NftMetadata = { name:string|null; collection:string|null; imageUrl:string|null };

const chainIds = Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[];
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
      const [malkutaResult,...chainResults]=await Promise.allSettled([
        fetch("/api/malkuta",{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject()),
        ...chainIds.map(chainId=>fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"}).then(response=>response.ok?response.json():Promise.reject())),
      ]);
      if(!active)return;
      if(malkutaResult.status==="fulfilled")setMalkuta(malkutaResult.value as MalkutaData);
      setChains(chainResults.flatMap(result=>result.status==="fulfilled"?[result.value as ChainListings]:[]));
      setLoading(false);
    }
    void refresh();
    const timer=window.setInterval(refresh,30_000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);

  const listings=useMemo(()=>chains.flatMap(chain=>chain.listings),[chains]);
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

    <section className="listed-collections">
      <header><div><span>MARKETPLACE</span><h2>Listed NFTs by network</h2></div><div className="collection-view-toggle"><button className={layout==="grid"?"active":""} onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={15}/></button><button className={layout==="list"?"active":""} onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div></header>
      <div className="collection-browser">
        <aside><label><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search contract or token"/></label><span>CHAINS</span><button className={activeChain==="all"?"active":""} onClick={()=>setActiveChain("all")}><b>All networks</b><em>{listings.length}</em></button>{chainIds.map(chainId=>{const chain=getMarketplaceChain(chainId);const count=listings.filter(item=>item.chainId===chainId).length;return <button key={chainId} className={activeChain===chainId?"active":""} onClick={()=>setActiveChain(chainId)}><i/><b>{chain.name}</b><em>{count}</em></button>})}</aside>
        <div className={`chain-listings ${layout}`}>{visibleListings.length?visibleListings.map(item=><ListedNft key={item.id} item={item}/>):<div className="collection-loading">{loading?"Reading confirmed listings…":"No active NFT listings on this selection."}</div>}</div>
      </div>
    </section>
  </main>;
}

function ListedNft({item}:{item:Listing}){
  const [nft,setNft]=useState<NftMetadata|null>(null);
  const chain=getMarketplaceChain(item.chainId);
  useEffect(()=>{let active=true;void fetch(`/api/nft?contract=${item.nftAddress}&tokenId=${item.tokenId}&chainId=${item.chainId}`).then(response=>response.ok?response.json():null).then(value=>{if(active)setNft(value as NftMetadata|null)});return()=>{active=false};},[item]);
  return <article className="chain-listing"><a className="chain-listing-art" href={tokenUrl(item.chainId,item.nftAddress,item.tokenId)} target="_blank" rel="noreferrer" style={nft?.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}>{!nft?.imageUrl&&<strong>#{item.tokenId}</strong>}<span>{chain.name}</span></a><div><small>{nft?.collection??short(item.nftAddress)}</small><h3>{nft?.name??`Token #${item.tokenId}`}</h3><p><span>PRICE</span><strong>{formatEther(BigInt(item.price))} {chain.currency}</strong></p><a href="/market">View listing <ArrowUpRight size={13}/></a></div></article>;
}
