"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowUpRight, Check, Copy, ExternalLink, Heart, ImageIcon, Share2, ShieldCheck, ShoppingCart, Tag, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { favoriteId, useFavorite } from "./favorites";
import { getMarketplaceChain, isMarketplaceChainId, tokenUrl, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Nft={name:string|null;collection:string|null;imageUrl:string|null;description:string|null;externalUrl:string|null;traits:Array<{type:string;value:string}>;error?:string};
type Listing={id:string;chainId:MarketplaceChainId;nftAddress:`0x${string}`;tokenId:string;seller:`0x${string}`;price:string;transactionHash:`0x${string}`;updatedBlock:number};
type Activity={id:string;chainId:MarketplaceChainId;eventType:string;nftAddress:`0x${string}`|null;tokenId:string|null;seller:`0x${string}`|null;buyer:`0x${string}`|null;price:string|null;transactionHash:`0x${string}`;blockNumber:number};
type Indexer={configured:boolean;marketplaceAddress?:`0x${string}`;listings:Listing[];activity:Activity[];syncError?:string|null};

const marketplaceAbi=[{type:"function",name:"buyItem",stateMutability:"payable",inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"}],outputs:[]}] as const;
const short=(value:string)=>`${value.slice(0,6)}…${value.slice(-4)}`;

export function NftPage({chainId,contract,tokenId}:{chainId:number;contract:string;tokenId:string}){
  const valid=isMarketplaceChainId(chainId)&&/^0x[a-fA-F0-9]{40}$/.test(contract)&&/^\d+$/.test(tokenId);
  const marketChainId:MarketplaceChainId=isMarketplaceChainId(chainId)?chainId:109;
  const chain=getMarketplaceChain(marketChainId);
  const[nft,setNft]=useState<Nft|null>(null);
  const[indexer,setIndexer]=useState<Indexer|null>(null);
  const[error,setError]=useState("");
  const[status,setStatus]=useState("");
  const[copied,setCopied]=useState(false);
  const favorite=useFavorite(favoriteId(chainId,contract,tokenId));
  const{address}=useAccount();
  const walletChainId=useChainId();
  const{switchChainAsync}=useSwitchChain();
  const{writeContractAsync}=useWriteContract();

  useEffect(()=>{let active=true;void(async()=>{
    if(!valid){setError("This NFT link is not valid.");return;}
    const[metadataResult,indexerResult]=await Promise.allSettled([
      fetch(`/api/nft?chainId=${chainId}&contract=${contract}&tokenId=${tokenId}`,{cache:"no-store"}).then(async response=>{const body=await response.json() as Nft;if(!response.ok)throw new Error(body.error??"NFT metadata is unavailable.");return body;}),
      fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"}).then(async response=>{const body=await response.json() as Indexer;if(!response.ok&&!body.configured)throw new Error("Marketplace activity is unavailable.");return body;}),
    ]);
    if(!active)return;
    if(metadataResult.status==="fulfilled")setNft(metadataResult.value);else setError(metadataResult.reason instanceof Error?metadataResult.reason.message:"NFT metadata is unavailable.");
    if(indexerResult.status==="fulfilled")setIndexer(indexerResult.value);
  })();return()=>{active=false;};},[chainId,contract,tokenId,valid]);

  const listing=useMemo(()=>indexer?.listings.find(item=>item.nftAddress.toLowerCase()===contract.toLowerCase()&&item.tokenId===tokenId)??null,[indexer,contract,tokenId]);
  const activity=useMemo(()=>indexer?.activity.filter(item=>item.nftAddress?.toLowerCase()===contract.toLowerCase()&&item.tokenId===tokenId)??[],[indexer,contract,tokenId]);
  const isSeller=!!address&&!!listing&&address.toLowerCase()===listing.seller.toLowerCase();

  async function buy(){
    if(!address||!listing||!indexer?.marketplaceAddress)return;
    try{
      if(walletChainId!==marketChainId)await switchChainAsync({chainId:marketChainId});
      setStatus("Confirm the purchase in your wallet.");
      const hash=await writeContractAsync({address:indexer.marketplaceAddress,abi:marketplaceAbi,functionName:"buyItem",args:[listing.nftAddress,BigInt(listing.tokenId)],value:BigInt(listing.price),chainId:marketChainId});
      setStatus(`Purchase submitted · ${short(hash)}`);
    }catch(reason){setStatus(reason instanceof Error?reason.message.split("\n")[0]:"Purchase failed.");}
  }

  async function copyContract(){await navigator.clipboard.writeText(contract);setCopied(true);window.setTimeout(()=>setCopied(false),1400);}
  async function share(){
    const data={title:nft?.name??`Token #${tokenId}`,text:`View ${nft?.name??`Token #${tokenId}`} on The House of Joshi NFT Marketplace`,url:window.location.href};
    if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(window.location.href);setStatus("NFT link copied.");}
  }

  return <main className="standalone-nft-page">
    <nav className="nft-page-nav"><Link href="/market"><ArrowLeft size={15}/> Marketplace</Link><div><button onClick={share} aria-label="Share NFT"><Share2 size={16}/><span>Share</span></button><button className={favorite.favorite?"active":""} onClick={favorite.toggle}><Heart size={16} fill={favorite.favorite?"currentColor":"none"}/><span>{favorite.favorite?"Saved":"Favorite"}</span></button></div></nav>

    <section className="nft-hero-layout">
      <div className="nft-media-column">
        <div className={`standalone-nft-art ${nft?.imageUrl?"":"empty"}`} style={nft?.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}>{!nft?.imageUrl&&<><ImageIcon size={34}/><span>{error||"Loading verified NFT…"}</span><strong>#{tokenId}</strong></>}</div>
        <div className="nft-media-note"><ShieldCheck size={15}/><span>Metadata and ownership are read from the {chain.name} network.</span></div>
      </div>

      <article className="nft-commerce-column">
        <div className="nft-chain-line"><span>{chain.name}</span><i>ERC-721</i><i>Token #{tokenId}</i></div>
        <p className="standalone-collection">{nft?.collection??short(contract)}</p>
        <h1>{nft?.name??`Token #${tokenId}`}</h1>
        <p className="nft-owner">{listing?<>Listed by <a href={`${chain.explorerUrl}/address/${listing.seller}`} target="_blank" rel="noreferrer">{short(listing.seller)}</a></>:"This NFT is not currently listed for sale."}</p>

        <section className="nft-sale-card">
          {listing?<><span>CURRENT PRICE</span><strong>{formatEther(BigInt(listing.price))} <small>{chain.currency}</small></strong><p>Settlement takes place directly through the House of Joshi marketplace contract on {chain.name}.</p><div>{isSeller?<Link href="/profile">Manage your listing <ArrowUpRight size={15}/></Link>:address?<button onClick={buy}>Buy now <ShoppingCart size={16}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect wallet to buy <Wallet size={16}/></button>}</ConnectButton.Custom>}<Link href="/market">View marketplace <ArrowUpRight size={15}/></Link></div></>:<><span>SALE STATUS</span><strong className="not-listed">Not listed</strong><p>When the owner lists this NFT, the verified order will appear here automatically.</p><div><Link href="/market">Explore listed NFTs <ArrowUpRight size={15}/></Link></div></>}
        </section>

        {nft?.description&&<section className="nft-description-panel"><header><Tag size={15}/><span>Description</span></header><p>{nft.description}</p></section>}
      </article>
    </section>

    <section className="nft-information-grid">
      <article className="nft-information-panel"><header><span>Traits</span><small>{nft?.traits?.length??0}</small></header>{nft?.traits?.length?<div className="standalone-traits">{nft.traits.map(trait=><div key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></div>)}</div>:<p>No traits were supplied in this NFT&apos;s metadata.</p>}</article>
      <article className="nft-information-panel"><header><span>Blockchain details</span><small>{chain.name}</small></header><dl><div><dt>Contract</dt><dd><button onClick={copyContract}>{short(contract)} {copied?<Check size={13}/>:<Copy size={13}/>}</button></dd></div><div><dt>Token ID</dt><dd>{tokenId}</dd></div><div><dt>Token standard</dt><dd>ERC-721</dd></div><div><dt>Network</dt><dd>{chain.name}</dd></div></dl><div className="nft-detail-links"><a href={tokenUrl(marketChainId,contract,tokenId)} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={13}/></a>{nft?.externalUrl&&<a href={nft.externalUrl} target="_blank" rel="noreferrer">Collection website <ExternalLink size={13}/></a>}</div></article>
      <article className="nft-information-panel nft-activity-panel"><header><span>Orders & activity</span><small>{activity.length}</small></header>{activity.length?<div>{activity.map(item=><a key={item.id} href={transactionUrl(item.chainId,item.transactionHash)} target="_blank" rel="noreferrer"><i>{item.eventType}</i><span>{item.price?`${formatEther(BigInt(item.price))} ${chain.currency}`:"—"}</span><small>Block {item.blockNumber}</small><ExternalLink size={12}/></a>)}</div>:<p>No marketplace activity has been confirmed for this NFT.</p>}</article>
    </section>
    {status&&<div className="toast" role="status"><ShieldCheck size={18}/><span>{status}</span><button onClick={()=>setStatus("")} aria-label="Dismiss">×</button></div>}
  </main>;
}
