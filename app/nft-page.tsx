"use client";

import { ArrowLeft, ExternalLink, Heart, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { favoriteId, useFavorite } from "./favorites";
import { getMarketplaceChain, isMarketplaceChainId, tokenUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Nft={name:string|null;collection:string|null;imageUrl:string|null;description:string|null;externalUrl:string|null;traits:Array<{type:string;value:string}>;error?:string};

export function NftPage({chainId,contract,tokenId}:{chainId:number;contract:string;tokenId:string}){
  const valid=isMarketplaceChainId(chainId)&&/^0x[a-fA-F0-9]{40}$/.test(contract)&&/^\d+$/.test(tokenId);
  const chain=getMarketplaceChain(chainId);
  const[nft,setNft]=useState<Nft|null>(null);
  const[error,setError]=useState("");
  const favorite=useFavorite(favoriteId(chainId,contract,tokenId));
  useEffect(()=>{let active=true;void(async()=>{if(!valid){setError("This NFT link is not valid.");return;}try{const response=await fetch(`/api/nft?chainId=${chainId}&contract=${contract}&tokenId=${tokenId}`);const body=await response.json() as Nft;if(!response.ok)throw new Error(body.error??"NFT metadata is unavailable.");if(active)setNft(body);}catch(reason){if(active)setError(reason instanceof Error?reason.message:"NFT metadata is unavailable.");}})();return()=>{active=false;};},[chainId,contract,tokenId,valid]);
  return <main className="standalone-nft-page"><nav><Link href="/market"><ArrowLeft size={14}/> Marketplace</Link><button className={favorite.favorite?"active":""} onClick={favorite.toggle}><Heart size={16} fill={favorite.favorite?"currentColor":"none"}/>{favorite.favorite?"Saved":"Favorite"}</button></nav><section>{nft?.imageUrl?<div className="standalone-nft-art" style={{backgroundImage:`url(${nft.imageUrl})`}}/>:<div className="standalone-nft-art empty"><span>{error||"Loading verified NFT…"}</span><strong>#{tokenId}</strong></div>}<article><span>{chain.name} · ERC-721</span><h1>{nft?.name??`Token #${tokenId}`}</h1><p className="standalone-collection">{nft?.collection??contract}</p>{nft?.description&&<p className="standalone-description">{nft.description}</p>}<dl><div><dt>Contract</dt><dd>{contract}</dd></div><div><dt>Token ID</dt><dd>{tokenId}</dd></div><div><dt>Network</dt><dd>{chain.name}</dd></div></dl>{nft?.traits?.length?<div className="standalone-traits">{nft.traits.map(trait=><div key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></div>)}</div>:null}<div className="standalone-actions"><Link href="/market">View listing <ShieldCheck size={14}/></Link><a href={tokenUrl(chain.id as MarketplaceChainId,contract,tokenId)} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={14}/></a>{nft?.externalUrl&&<a href={nft.externalUrl} target="_blank" rel="noreferrer">Collection website <ExternalLink size={14}/></a>}</div></article></section></main>;
}
