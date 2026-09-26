"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, ExternalLink, Heart, ImageIcon, RefreshCw, Share2, ShieldCheck, ShoppingCart, Tag, Wallet, TrendingUp, Activity, Layers, History, Info, Plus, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther, erc1155Abi, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { favoriteId, useFavorite } from "./favorites";
import { getMarketplaceChain, isMarketplaceChainId, tokenUrl, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { marketplaceAbi, parseNativeAmount, type IndexedOffer } from "@/lib/marketplace-abi";
import { inspectListing } from "@/lib/prepare-listing";
import { TransactionStatus, useMarketplaceTransaction } from "./components/use-marketplace-transaction";
import { OffersPanel } from "./components/offers-panel";
import { EditionTrading } from "./components/edition-trading";
import { NftPriceHistory } from "./components/nft-price-history";

type Nft={name:string|null;collection:string|null;imageUrl:string|null;description:string|null;externalUrl:string|null;traits:Array<{type:string;value:string}>;error?:string};
type Listing={id:string;chainId:MarketplaceChainId;nftAddress:`0x${string}`;tokenId:string;seller:`0x${string}`;price:string;transactionHash:`0x${string}`;updatedBlock:number;tokenType?:"ERC-721"|"ERC-1155";quantity?:string};
type Activity={id:string;chainId:MarketplaceChainId;eventType:string;nftAddress:`0x${string}`|null;tokenId:string|null;seller:`0x${string}`|null;buyer:`0x${string}`|null;price:string|null;transactionHash:`0x${string}`;blockNumber:number};
type CollectionSummary={nftAddress:string;floorPrice:string;listingCount:number;latestBlock:number;sampleTokenId:string};
type Indexer={configured:boolean;marketplaceAddress?:`0x${string}`;listings:Listing[];offers?:IndexedOffer[];collections?:CollectionSummary[];activity:Activity[];sync?:{caughtUp:boolean}|null;syncError?:string|null};

const erc721Abi=[
  {type:"function",name:"ownerOf",stateMutability:"view",inputs:[{name:"tokenId",type:"uint256"}],outputs:[{name:"owner",type:"address"}]},
  {type:"function",name:"getApproved",stateMutability:"view",inputs:[{name:"tokenId",type:"uint256"}],outputs:[{name:"approved",type:"address"}]},
  {type:"function",name:"isApprovedForAll",stateMutability:"view",inputs:[{name:"owner",type:"address"},{name:"operator",type:"address"}],outputs:[{name:"approved",type:"bool"}]},
  {type:"function",name:"approve",stateMutability:"nonpayable",inputs:[{name:"to",type:"address"},{name:"tokenId",type:"uint256"}],outputs:[]},
] as const;
const erc1155SupplyAbi=[{type:"function",name:"totalSupply",stateMutability:"view",inputs:[{name:"id",type:"uint256"}],outputs:[{name:"",type:"uint256"}]}] as const;
const short=(value:string)=>`${value.slice(0,6)}…${value.slice(-4)}`;

export function NftPage({chainId,contract,tokenId,returnTo="/market"}:{chainId:number;contract:string;tokenId:string;returnTo?:"/market"|"/profile"}){
  const[returnHref,setReturnHref]=useState(returnTo==="/market"?"/":returnTo);
  const valid=isMarketplaceChainId(chainId)&&/^0x[a-fA-F0-9]{40}$/.test(contract)&&/^\d+$/.test(tokenId);
  const marketChainId:MarketplaceChainId=isMarketplaceChainId(chainId)?chainId:109;
  const chain=getMarketplaceChain(marketChainId);
  const marketplaceLive=chain.marketplaceStatus==="live";
  const[nft,setNft]=useState<Nft|null>(null);
  const[indexer,setIndexer]=useState<Indexer|null>(null);
  const[collectionTokens,setCollectionTokens]=useState<Array<{tokenId:string;name:string;imageUrl:string}>>([]);
  const marketplaceAddress=(indexer?.marketplaceAddress??chain.marketplaceAddress) as Address;
  const[error,setError]=useState("");
  const[status,setStatus]=useState("");
  const[copied,setCopied]=useState(false);
  const[shareOpen,setShareOpen]=useState(false);
  const[refreshing,setRefreshing]=useState(false);
  const[artFailed,setArtFailed]=useState(false);
  const[activeTab,setActiveTab]=useState<"details"|"orders"|"activity">("details");
  const[showListModal,setShowListModal]=useState(false);
  const[listPrice,setListPrice]=useState("");
  const[editingPrice,setEditingPrice]=useState(false);
  const[historyRefreshKey,setHistoryRefreshKey]=useState(0);
  const transaction=useMarketplaceTransaction(marketChainId);
  const listPending=transaction.pending;
  const favorite=useFavorite(favoriteId(chainId,contract,tokenId));
  const{address}=useAccount();
  const publicClient=usePublicClient({chainId:marketChainId});
  const nftAddress=contract as Address;
  const parsedTokenId=valid?BigInt(tokenId):0n;
  const displayTokenId=tokenId.length>20?`#${tokenId.slice(0,8)}…${tokenId.slice(-6)}`:`#${tokenId}`;
  const{data:isEdition}=useReadContract({address:nftAddress,abi:erc1155Abi,functionName:"supportsInterface",args:["0xd9b67a26"],chainId:marketChainId,query:{enabled:valid}});
  const{data:editionSupply}=useReadContract({address:nftAddress,abi:erc1155SupplyAbi,functionName:"totalSupply",args:[parsedTokenId],chainId:marketChainId,query:{enabled:valid&&isEdition===true}});
  const{data:owner,refetch:refetchOwner}=useReadContract({address:nftAddress,abi:erc721Abi,functionName:"ownerOf",args:[parsedTokenId],chainId:marketChainId,query:{enabled:valid&&!isEdition,refetchInterval:30_000}});
  const{data:directListing,refetch:refetchListing,isLoading:listingLoading}=useReadContract({address:marketplaceAddress,abi:marketplaceAbi,functionName:"getListing",args:[nftAddress,parsedTokenId],chainId:marketChainId,query:{enabled:valid&&marketplaceLive&&!isEdition,refetchInterval:15_000}});
  const{data:marketVersion}=useReadContract({address:marketplaceAddress,abi:marketplaceAbi,functionName:"marketplaceVersion",chainId:marketChainId,query:{enabled:valid&&marketplaceLive}});

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      if(returnTo==="/profile"){setReturnHref("/profile");return;}
      try{
        const stored=JSON.parse(window.sessionStorage.getItem("hoj-nft-origin")??"null") as {href?:string;at?:number}|null;
        const href=stored?.href;
        if(href&&href.startsWith("/")&&!href.startsWith("//")&&!href.startsWith("/nft/")&&typeof stored?.at==="number"&&Date.now()-stored.at<30*60_000){setReturnHref(href);return;}
      }catch{/* Use the Discover page when no safe source is recorded. */}
      setReturnHref("/");
    });
    return()=>{active=false;};
  },[returnTo]);

  const loadMetadata=useCallback(async(refresh=false)=>{
    const query=new URLSearchParams({chainId:String(chainId),contract,tokenId});
    if(refresh){query.set("refresh","1");query.set("t",String(Date.now()));}
    const response=await fetch(`/api/nft?${query}`,{cache:"no-store"});
    const body=await response.json() as Nft;
    if(!response.ok)throw new Error(body.error??"NFT metadata is unavailable.");
    setNft(body);
    setArtFailed(false);
    setError("");
    return body;
  },[chainId,contract,tokenId]);

  useEffect(()=>{let active=true;void(async()=>{
    if(!valid){setError("This NFT link is not valid.");return;}
    const[metadataResult,indexerResult]=await Promise.allSettled([
      loadMetadata(),
      fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"}).then(async response=>{const body=await response.json() as Indexer;if(!response.ok&&!body.configured)throw new Error("Marketplace activity is unavailable.");console.log(`Indexer data loaded: ${body.listings.length} listings, ${body.activity.length} activity events`);return body;}),
    ]);
    if(!active)return;
    if(metadataResult.status==="rejected")setError(metadataResult.reason instanceof Error?metadataResult.reason.message:"NFT metadata is unavailable.");
    if(indexerResult.status==="fulfilled"){
      setIndexer(indexerResult.value);
      console.log(`Indexer set with ${indexerResult.value.listings.length} listings`);
    }
  })();return()=>{active=false;};},[chainId,loadMetadata,valid]);

  useEffect(()=>{
    if(!valid)return;
    const timer=window.setInterval(async()=>{
      if(document.visibilityState!=="visible")return;
      try{
        const response=await fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"});
        if(response.ok)setIndexer(await response.json() as Indexer);
      }catch{/* Keep the last verified floor while the indexer is temporarily unavailable. */}
    },30_000);
    return()=>window.clearInterval(timer);
  },[chainId,valid]);

  useEffect(()=>{
    if(!valid)return;
    let active=true;
    void fetch(`/api/collection-nfts?${new URLSearchParams({chainId:String(chainId),contract})}`)
      .then(response=>response.ok?response.json() as Promise<{items:Array<{tokenId:string;name:string;imageUrl:string}>}>:{items:[]})
      .then(body=>{if(active)setCollectionTokens(body.items);})
      .catch(()=>{});
    return()=>{active=false;};
  },[chainId,contract,valid]);

  async function refreshMetadata(){
    if(refreshing||!valid)return;
    setRefreshing(true);
    setStatus("Refreshing NFT metadata…");
    try{
      const refreshed=await loadMetadata(true);
      setStatus(refreshed.imageUrl?"Metadata rechecked. Artwork will reload if the collection source is available.":"Metadata refreshed. The collection has not supplied an image yet.");
    }catch(reason){
      setStatus(reason instanceof Error?reason.message:"NFT metadata could not be refreshed.");
    }finally{setRefreshing(false);}
  }

  const listing=useMemo<Listing|null>(()=>{
    if(isEdition)return null;
    const indexed=indexer?.listings.find(item=>item.nftAddress.toLowerCase()===contract.toLowerCase()&&item.tokenId===tokenId);
    if(directListing){
      if(directListing.price===0n)return null;
      return {...indexed,id:indexed?.id??`${marketChainId}:${contract.toLowerCase()}:${tokenId}`,chainId:marketChainId,nftAddress:contract as Address,tokenId,seller:directListing.seller,price:String(directListing.price),transactionHash:indexed?.transactionHash??"0x",updatedBlock:indexed?.updatedBlock??0};
    }
    return indexed??null;
  },[indexer,contract,tokenId,directListing,isEdition,marketChainId]);
  const activity=useMemo(()=>indexer?.activity.filter(item=>item.nftAddress?.toLowerCase()===contract.toLowerCase()&&item.tokenId===tokenId)??[],[indexer,contract,tokenId]);
  const collectionListings=useMemo(()=>indexer?.listings.filter(item=>item.nftAddress.toLowerCase()===contract.toLowerCase()&&item.tokenId!==tokenId)??[],[indexer,contract,tokenId]);
  const relatedItems=useMemo(()=>{
    const byId=new Map<string,{tokenId:string;name:string;imageUrl:string;listing:Listing|null}>();
    for(const item of collectionTokens){if(item.tokenId!==tokenId)byId.set(item.tokenId,{...item,listing:null});}
    for(const listing of collectionListings){const existing=byId.get(listing.tokenId);byId.set(listing.tokenId,{tokenId:listing.tokenId,name:existing?.name??`Token #${listing.tokenId}`,imageUrl:existing?.imageUrl??`/api/nft-image?${new URLSearchParams({chainId:String(chainId),contract,tokenId:listing.tokenId})}`,listing});}
    return [...byId.values()].slice(0,24);
  },[chainId,collectionListings,collectionTokens,contract,tokenId]);
  const galleryItems=relatedItems.slice(0,6);
  const lastSale=activity.find(item=>(["sold","offer_accepted"].includes(item.eventType))&&item.price);
  const isSeller=!!address&&!!listing&&address.toLowerCase()===listing.seller.toLowerCase();
  const isOwner=!!address&&!!owner&&address.toLowerCase()===owner.toLowerCase();
  const validListPrice=/^\d+(?:\.\d{1,18})?$/.test(listPrice.trim())&&Number(listPrice)>0;
  const listAmount=validListPrice?parseEther(listPrice.trim()):0n;
  const estimatedProceeds=listAmount-(listAmount*200n/10_000n);

  // Calculate collection floor price from active listings
  const collectionFloorWei=useMemo(()=>{
    const summary=indexer?.collections?.find(item=>item.nftAddress.toLowerCase()===contract.toLowerCase());
    const indexedFloor=summary?BigInt(summary.floorPrice):null;
    const visible=indexer?.listings.filter(item=>item.nftAddress.toLowerCase()===contract.toLowerCase())??[];
    const visibleFloor=visible.length?visible.reduce((minimum,item)=>BigInt(item.price)<minimum?BigInt(item.price):minimum,BigInt(visible[0].price)):null;
    if(indexedFloor===null)return visibleFloor;
    return visibleFloor!==null&&visibleFloor<indexedFloor?visibleFloor:indexedFloor;
  },[indexer,contract]);
  const collectionFloor=collectionFloorWei!==null?formatEther(collectionFloorWei):null;
  const completeFloor=!!indexer?.sync?.caughtUp&&!indexer.syncError;
  const floorDifference=collectionFloorWei!==null&&collectionFloorWei>0n&&validListPrice
    ? Number((listAmount-collectionFloorWei)*10_000n/collectionFloorWei)/100
    : null;

  const refreshTrading=useCallback(()=>{
    setHistoryRefreshKey(key=>key+1);
    void refetchOwner();
    void refetchListing();
    void fetch(`/api/indexer?chainId=${marketChainId}`,{cache:"no-store"}).then(async response=>{if(response.ok)setIndexer(await response.json() as Indexer);}).catch(()=>{});
  },[marketChainId,refetchOwner,refetchListing]);
  async function buy(){
    if(!address||!listing||!owner||owner.toLowerCase()!==listing.seller.toLowerCase())return;
    const ok=await transaction.run("Purchase",async send=>{await send({address:marketplaceAddress,abi:marketplaceAbi,functionName:"buyItem",args:[listing.nftAddress,BigInt(listing.tokenId)],value:BigInt(listing.price)});});
    if(ok){setIndexer(current=>current?{...current,listings:current.listings.filter(item=>item.id!==listing.id)}:current);refreshTrading();}
  }
  async function cancelListing(){
    if(!listing)return;
    const ok=await transaction.run("Listing cancellation",async send=>{await send({address:marketplaceAddress,abi:marketplaceAbi,functionName:"cancelListing",args:[nftAddress,parsedTokenId]});});
    if(ok){setIndexer(current=>current?{...current,listings:current.listings.filter(item=>item.id!==listing.id)}:current);refreshTrading();}
  }
  async function listForSale(){
    if(!address||!publicClient||!validListPrice||listPending||(listing&&!editingPrice))return;
    const ok=await transaction.run("Listing",async send=>{
      const amount=parseNativeAmount(listPrice);
      if(editingPrice&&listing){
        if(marketVersion&&marketVersion>=4n){
          await send({address:marketplaceAddress,abi:marketplaceAbi,functionName:"updateListing",args:[nftAddress,parsedTokenId,amount]},"Price update");
          refreshTrading();return;
        }
        await send({address:marketplaceAddress,abi:marketplaceAbi,functionName:"cancelListing",args:[nftAddress,parsedTokenId]},"Cancel previous price");
        void refetchListing();
      }
      const state=await inspectListing(publicClient,marketplaceAddress,nftAddress,parsedTokenId,address);
      if(state.needsApproval)await send({address:nftAddress,abi:erc721Abi,functionName:"approve",args:[marketplaceAddress,parsedTokenId]},"NFT approval");
      const receipt=await send({address:marketplaceAddress,abi:marketplaceAbi,functionName:"listItem",args:[nftAddress,parsedTokenId,amount]});
      const confirmedListing:Listing={id:`${marketChainId}:${nftAddress.toLowerCase()}:${tokenId}`,chainId:marketChainId,nftAddress,tokenId,seller:address,price:amount.toString(),transactionHash:receipt.transactionHash,updatedBlock:Number(receipt.blockNumber)};
      setIndexer(current=>({configured:true,marketplaceAddress,...current,listings:[confirmedListing,...(current?.listings??[]).filter(item=>item.nftAddress.toLowerCase()!==nftAddress.toLowerCase()||item.tokenId!==tokenId)],activity:current?.activity??[]}));
    });if(ok){setShowListModal(false);setEditingPrice(false);refreshTrading();}
  }

  async function copyContract(){await navigator.clipboard.writeText(contract);setCopied(true);window.setTimeout(()=>setCopied(false),1400);}
  async function share(){
    const data={title:nft?.name??`Token #${tokenId}`,text:`View ${nft?.name??`Token #${tokenId}`} on The House of Joshi NFT Marketplace`,url:window.location.href};
    if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(window.location.href);setStatus("NFT link copied.");}
  }
  function socialShare(service:"x"|"facebook"|"telegram"){
    const text=encodeURIComponent(`${nft?.name??`Token #${tokenId}`} · The House of Joshi NFT Marketplace`);
    const url=encodeURIComponent(window.location.href);
    const targets={x:`https://twitter.com/intent/tweet?text=${text}&url=${url}`,facebook:`https://www.facebook.com/sharer/sharer.php?u=${url}`,telegram:`https://t.me/share/url?url=${url}&text=${text}`};
    window.open(targets[service],"_blank","noopener,noreferrer");
    setShareOpen(false);
  }
  function addToCart(){
    if(!listing)return;
    const key=`hoj-market-cart:${marketChainId}`;
    try{
      const saved=JSON.parse(window.localStorage.getItem(key)??"[]") as unknown;
      const ids=Array.isArray(saved)?saved.filter((id):id is string=>typeof id==="string"):[];
      window.localStorage.setItem(key,JSON.stringify([...new Set([...ids,listing.id])]));
      window.location.assign(`/market?chainId=${marketChainId}&cart=1`);
    }catch{setStatus("Your browser could not save the cart. Please try Buy now instead.");}
  }

  return <main className="royal-nft-page">
    <div className="royal-nft-stage">
    <nav className="royal-nft-nav">
      <div className="royal-nft-gallery-nav">
        <Link href={returnHref} className="royal-nft-gallery-back" aria-label="Back to previous page"><ArrowLeft size={18}/></Link>
        <div className="royal-nft-thumbnails" aria-label="More NFTs from this collection">
          {nft?.imageUrl&&!artFailed?<span className="royal-nft-thumb active"><Image src={nft.imageUrl} alt="Current NFT" fill unoptimized sizes="52px"/></span>:<span className="royal-nft-thumb active"><ImageIcon size={20}/></span>}
          {galleryItems.map(item=><Link key={item.tokenId} className="royal-nft-thumb" href={`/nft/${chainId}/${contract}/${item.tokenId}${returnTo==="/profile"?"?from=profile":""}`} title={item.name}><Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="52px"/></Link>)}
        </div>
        {galleryItems.length>0&&<Link href={`/nft/${chainId}/${contract}/${galleryItems[0].tokenId}${returnTo==="/profile"?"?from=profile":""}`} className="royal-nft-gallery-next" aria-label="View another NFT in this collection"><ArrowRight size={18}/></Link>}
      </div>
      <div className="royal-nft-nav-actions">
        <div className="nft-share-wrap">
          <button onClick={()=>setShareOpen(open=>!open)} aria-label="Share NFT" aria-expanded={shareOpen}>
            <Share2 size={16}/>
            <span>Share</span>
          </button>
          {shareOpen&&<div className="nft-share-menu" role="menu">
            <button onClick={()=>{void share();setShareOpen(false);}} role="menuitem"><Share2 size={14}/> Device share</button>
            <button onClick={()=>socialShare("x")} role="menuitem"><b>𝕏</b> Share on X</button>
            <button onClick={()=>socialShare("facebook")} role="menuitem"><b>f</b> Facebook</button>
            <button onClick={()=>socialShare("telegram")} role="menuitem"><b>↗</b> Telegram</button>
            <button onClick={async()=>{await navigator.clipboard.writeText(window.location.href);setStatus("NFT link copied.");setShareOpen(false);}} role="menuitem"><Copy size={14}/> Copy link</button>
          </div>}
        </div>
        <button className={favorite.favorite?"active":""} onClick={favorite.toggle}>
          <Heart size={16} fill={favorite.favorite?"currentColor":"none"}/>
          <span>{favorite.favorite?"Saved":"Favorite"}</span>
        </button>
        <Link href={returnHref} className="royal-nft-gallery-close" aria-label="Close NFT view"><X size={19}/></Link>
      </div>
    </nav>

    <div className="royal-nft-split">
      <div className="royal-nft-media">
        <div className={`royal-nft-art ${nft?.imageUrl&&!artFailed?"":"empty"}`}>
          {nft?.imageUrl&&!artFailed?<Image src={nft.imageUrl} alt={nft.name??`NFT ${displayTokenId}`} fill unoptimized sizes="(max-width: 1100px) 100vw, 56vw" style={{objectFit:"contain"}} onError={()=>setArtFailed(true)}/>:<><ImageIcon size={48}/><span>{error||(nft?"Artwork unavailable from the NFT metadata source.":"Loading verified NFT…")}</span><strong>{displayTokenId}</strong></>}
        </div>
        {artFailed&&chainId===109&&contract.toLowerCase()==="0x007bbf85988caf18cf4222c9214e4fa019b3e002"&&<p className="royal-nft-artwork-warning">The Shib Magazine Covers metadata host is denying public access. Your NFT remains on Shibarium, but its publisher must restore the image source for the original cover to appear.</p>}
        <div className="royal-nft-media-info">
          <ShieldCheck size={16}/>
          <span>Metadata and ownership are read from the {chain.name} network.</span>
          <button onClick={refreshMetadata} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing?"spinning":undefined}/>
            {refreshing?"Refreshing…":"Refresh metadata"}
          </button>
        </div>
      </div>

      <div className="royal-nft-info-scroll" aria-label="NFT information">
      <div className="royal-nft-details">
        <div className="royal-nft-header">
          <h1>{nft?.name??`Token ${displayTokenId}`}</h1>
          <Link href={`/collection/${chainId}/${contract}`} className="royal-collection-link">
            {nft?.collection??short(contract)}
            <ArrowUpRight size={14}/>
          </Link>
        </div>

        <div className="royal-nft-badges">
          <span className="royal-badge">{isEdition?"ERC-1155":"ERC-721"}</span>
          <span className="royal-badge">{chain.name}</span>
        </div>

        <div className="royal-nft-owner">
          <span>{isEdition?"Edition ownership":"Owned by"}</span>
          {isEdition?<span>Multiple holders</span>:owner?<a href={`${chain.explorerUrl}/address/${owner}`} target="_blank" rel="noreferrer">{short(owner)} <ExternalLink size={12}/></a>:<span>—</span>}
        </div>

        {isEdition&&<div className="royal-nft-edition-supply"><span>EDITIONS MINTED</span><strong>{editionSupply===undefined?"Unavailable":editionSupply.toLocaleString()}</strong></div>}

        {nft?.description&&<p className="royal-nft-intro">{nft.description}</p>}

        <div className="royal-nft-market-info">
          <div className="royal-market-stat">
            <span>Last Sale</span>
            <strong>{lastSale?.price?`${formatEther(BigInt(lastSale.price))} ${chain.currency}`:"—"}</strong>
          </div>
          <div className="royal-market-stat">
            <span>{completeFloor?"Marketplace Floor":"Observed Listing Low"}</span>
            <strong>{collectionFloor?`${collectionFloor} ${chain.currency}`:"—"}</strong>
          </div>
          <div className="royal-market-stat">
            <span>Traits</span>
            <strong>{nft?.traits?.length??"—"}</strong>
          </div>
        </div>

        {!marketplaceLive?<div className="royal-nft-action-section"><div className="royal-not-listed"><span>MARKETPLACE STATUS</span><strong>Coming soon on {chain.name}</strong></div><p>You can view this NFT, but HOJ listing, buying, and offers are not yet available on this network.</p></div>:isEdition?<EditionTrading chainId={marketChainId} market={marketplaceAddress} nft={nftAddress} tokenId={parsedTokenId} listings={indexer?.listings.filter(item=>item.nftAddress.toLowerCase()===contract.toLowerCase()&&item.tokenId===tokenId)??[]} offers={indexer?.offers?.filter(item=>item.nftAddress.toLowerCase()===contract.toLowerCase()&&item.tokenId===tokenId)??[]} onChanged={refreshTrading}/>:<div className="royal-nft-action-section">
          {listing?<>
            <div className="royal-current-price">
              <span>CURRENT PRICE</span>
              <strong>{formatEther(BigInt(listing.price))} <small>{chain.currency}</small></strong>
            </div>
            <p>Settlement takes place directly through the House of Joshi marketplace contract on {chain.name}.</p>
            <div className="royal-nft-actions">
              {isSeller?<><button disabled={transaction.pending||!isOwner} onClick={()=>{setEditingPrice(true);setListPrice(formatEther(BigInt(listing.price)));setShowListModal(true);}}>Change price</button><button disabled={transaction.pending} onClick={cancelListing}>Cancel listing</button></>:address?<button disabled={transaction.pending||!owner||owner.toLowerCase()!==listing.seller.toLowerCase()} onClick={buy}>Buy now <ShoppingCart size={16}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect wallet to buy <Wallet size={16}/></button>}</ConnectButton.Custom>}
              {!isSeller&&<button className="royal-secondary-action" onClick={addToCart}>Add to cart <ShoppingCart size={15}/></button>}
              <button className="royal-secondary-action" onClick={()=>{setActiveTab("orders");document.querySelector(".royal-nft-tabs")?.scrollIntoView({behavior:"smooth",block:"start"});}}>Make offer <ArrowUpRight size={15}/></button>
            </div>
          </>:<>
            <div className="royal-not-listed">
              <span>SALE STATUS</span>
              <strong className="not-listed">{listingLoading?"Checking listing…":"Not listed"}</strong>
            </div>
            <p>{isOwner?`You own this NFT. Set a price to list it on ${chain.name}.`:address?"Connect the wallet that owns this NFT to list it.":"Connect the owning wallet to list this NFT."}</p>
            <div className="royal-nft-actions">
              {address&&isOwner?<button disabled={listingLoading||transaction.pending} onClick={()=>{
                if(!owner){setStatus("Checking NFT ownership on chain. Please try again shortly.");return;}
                if(!isOwner){setStatus(`Only the owning wallet (${short(owner)}) can list this NFT.`);return;}
                setEditingPrice(false);setShowListModal(true);
              }}>List for sale <Tag size={16}/></button>:!address?<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect wallet <Wallet size={16}/></button>}</ConnectButton.Custom>:null}
              <Link href="/market">Explore listed NFTs <ArrowUpRight size={15}/></Link>
            </div>
          </>}
        </div>}
      </div>

    <section className="royal-nft-tabs">
      <button className={activeTab==="details"?"active":""} onClick={()=>setActiveTab("details")}>
        <Info size={16}/> Details
      </button>
      <button className={activeTab==="orders"?"active":""} onClick={()=>setActiveTab("orders")}>
        <Tag size={16}/> Orders
      </button>
      <button className={activeTab==="activity"?"active":""} onClick={()=>setActiveTab("activity")}>
        <Activity size={16}/> Activity
      </button>
    </section>

    <section className="royal-nft-content">
      {activeTab==="details"&&<>
        <details className="royal-nft-accordion" open>
          <summary><Layers size={17}/><span>Traits</span><small>{nft?.traits?.length??0}</small><ChevronDown size={17}/></summary>
          <div className="royal-nft-accordion-body">{nft?.traits?.length?<div className="royal-traits-grid">{nft.traits.map(trait=><div key={`${trait.type}:${trait.value}`} className="royal-trait-card"><small>{trait.type}</small><strong>{trait.value}</strong></div>)}</div>:<p>No traits were supplied in this NFT&apos;s metadata.</p>}</div>
        </details>
        <details className="royal-nft-accordion">
          <summary><History size={17}/><span>Price history</span><ChevronDown size={17}/></summary>
          <div className="royal-nft-accordion-body"><NftPriceHistory chainId={marketChainId} contract={contract} tokenId={tokenId} currency={chain.currency} refreshKey={historyRefreshKey}/></div>
        </details>
        <details className="royal-nft-accordion">
          <summary><Info size={17}/><span>About</span><ChevronDown size={17}/></summary>
          <div className="royal-nft-accordion-body"><p>This NFT is part of the {nft?.collection??short(contract)} collection on {chain.name}.</p><p>{nft?.description??"No description available."}</p></div>
        </details>
        <details className="royal-nft-accordion">
          <summary><ShieldCheck size={17}/><span>Blockchain details</span><ChevronDown size={17}/></summary>
          <div className="royal-nft-accordion-body">
          <dl className="royal-blockchain-details">
            <div><dt>Contract</dt><dd><button onClick={copyContract}>{short(contract)} {copied?<Check size={13}/>:<Copy size={13}/>}</button></dd></div>
            <div><dt>Token ID</dt><dd><button type="button" title={tokenId} aria-label="Copy full token ID" onClick={async()=>{await navigator.clipboard.writeText(tokenId);setStatus("Token ID copied.");}}>{tokenId.length>24?`${tokenId.slice(0,12)}…${tokenId.slice(-8)}`:tokenId} <Copy size={13}/></button></dd></div>
            <div><dt>Token standard</dt><dd>{isEdition?"ERC-1155":"ERC-721"}</dd></div>
            <div><dt>Network</dt><dd>{chain.name}</dd></div>
          </dl>
          <div className="royal-detail-links">
            <a href={tokenUrl(marketChainId,contract,tokenId)} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={13}/></a>
            {nft?.externalUrl&&<a href={nft.externalUrl} target="_blank" rel="noreferrer">Collection website <ExternalLink size={13}/></a>}
          </div>
          </div>
        </details>
      </>}

      {activeTab==="orders"&&<>
        <div className="royal-nft-panel">
          <header><Tag size={16}/><span>Orders & activity</span><small>{activity.length}</small></header>
          {activity.length?<div className="royal-activity-list">
            {activity.map(item=><a key={item.id} href={transactionUrl(item.chainId,item.transactionHash)} target="_blank" rel="noreferrer">
              <span className="royal-activity-type">{item.eventType}</span>
              <span className="royal-activity-price">{item.price?`${formatEther(BigInt(item.price))} ${chain.currency}`:"—"}</span>
              <small>Block {item.blockNumber}</small>
              <ExternalLink size={12}/>
            </a>)}
          </div>:<p>No marketplace activity has been confirmed for this NFT.</p>}
        </div>
        {!isEdition&&<OffersPanel nftAddress={contract} tokenId={tokenId} chainId={marketChainId} isOwner={isOwner} ownerAddress={owner} onChanged={refreshTrading} />}
      </>}

      {activeTab==="activity"&&<>
        <div className="royal-nft-panel">
          <header><Activity size={16}/><span>Activity</span><small>{activity.length}</small></header>
          {activity.length?<div className="royal-activity-timeline">
            {activity.map(item=><div key={item.id} className="royal-activity-item">
              <div className="royal-activity-icon">
                {(["sold","offer_accepted"].includes(item.eventType))&&<TrendingUp size={16}/>}
                {item.eventType==="listed"&&<Tag size={16}/>}
                {item.eventType==="canceled"&&<RefreshCw size={16}/>}
              </div>
              <div className="royal-activity-content">
                <span className="royal-activity-type">{item.eventType.toUpperCase()}</span>
                <p>{item.price?`${formatEther(BigInt(item.price))} ${chain.currency}`:"—"}</p>
              </div>
              <div className="royal-activity-time">
                <small>Block {item.blockNumber}</small>
              </div>
            </div>)}
          </div>:<p>No activity recorded for this NFT.</p>}
        </div>
      </>}

    </section>

    {activeTab==="details"&&<details className="royal-nft-more-from-collection royal-nft-accordion">
      <summary><ImageIcon size={17}/><span>More from this collection</span><small>{Math.min(relatedItems.length,6)}</small><ChevronDown size={17}/></summary>
      <div className="royal-collection-grid">
        {relatedItems.slice(0,6).map(item=>(
          <Link key={item.tokenId} href={`/nft/${chainId}/${contract}/${item.tokenId}${returnTo==="/profile"?"?from=profile":""}`} className="royal-collection-item">
            <div className="royal-collection-item-art">
              <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="140px"/>
            </div>
            <div className="royal-collection-item-info">
              <small>{item.name}</small>
              <strong>{item.listing?`${formatEther(BigInt(item.listing.price))} ${chain.currency}`:"Not listed"}</strong>
            </div>
          </Link>
        ))}
        {relatedItems.length===0&&<p>No other NFTs from this collection could be loaded right now.</p>}
      </div>
    </details>}
    </div>
    </div>
    </div>

    {/* List for Sale Modal */}
    {showListModal&&<div className="royal-modal-overlay" onClick={()=>{if(!listPending)setShowListModal(false);}}>
      <div className="royal-modal royal-listing-modal" onClick={e=>e.stopPropagation()}>
        <header>
          <h2>{editingPrice?"Change listing price":"Create listing"}</h2>
          <button onClick={()=>setShowListModal(false)} disabled={listPending} aria-label="Close listing dialog"><Plus size={20} className="rotate-45"/></button>
        </header>
        <div className="royal-modal-content">
          {/* NFT Information */}
          <div className="royal-listing-nft-info">
            <div className="royal-listing-nft-art">
              {nft?.imageUrl?<div className="royal-listing-nft-image" style={{backgroundImage:`url(${nft.imageUrl})`}}/>:<div className="royal-listing-nft-placeholder"><ImageIcon size={48}/></div>}
            </div>
            <div className="royal-listing-nft-details">
              <h3>{nft?.name??`Token #${tokenId}`}</h3>
              <p>Token #{tokenId} · {chain.name}</p>
            </div>
          </div>

          {/* Pricing Options */}
          <div className="royal-listing-section">
            <h4>Pricing</h4>
            <div className="royal-fee-info" role="status">
              <div className="royal-fee-row"><span>{completeFloor?"Current marketplace floor":"Observed listing low"}</span><strong>{collectionFloor?`${collectionFloor} ${chain.currency}`:completeFloor?"No active listings":"Unavailable"}</strong></div>
              {floorDifference!==null&&<div className="royal-fee-row"><span>Your price vs. floor</span><strong>{floorDifference===0?"At floor":`${Math.abs(floorDifference).toFixed(1)}% ${floorDifference>0?"above":"below"}`}</strong></div>}
            </div>
            {!completeFloor&&<p className="royal-listing-note">The indexer has not verified the full listing history on {chain.name}; this is the lowest listing currently observed.</p>}
            <div className="royal-pricing-options">
              <div className="royal-pricing-option">
                <label>Price ({chain.currency})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={listPrice}
                  onChange={e=>setListPrice(e.target.value)}
                  className="royal-price-input"
                  aria-label={`Listing price in ${chain.currency}`}
                />
              </div>
            </div>
          </div>

          <div className="royal-listing-section">
            <h4>Fees</h4>
            <div className="royal-fee-info">
              <div className="royal-fee-row">
                <span>Listing price</span>
                <strong>{validListPrice?`${listPrice} ${chain.currency}`:"—"}</strong>
              </div>
              <div className="royal-fee-row">
                <span>Marketplace fee on sale</span>
                <strong>2%</strong>
              </div>
              <div className="royal-fee-row royal-fee-total">
                <span>Estimated proceeds before creator royalties</span>
                <strong>{validListPrice?formatEther(estimatedProceeds):"—"} {chain.currency}</strong>
              </div>
            </div>
          </div>
          <p className="royal-listing-note">Listing remains active until it sells or you cancel it. Creator royalties, if supported by the NFT contract, are deducted when it sells.</p>
          {editingPrice&&(!marketVersion||marketVersion<4n)&&<p className="royal-listing-note">This marketplace changes prices in two transactions: cancel the current listing, then list at the new price. If the second step is rejected, the NFT remains unlisted.</p>}

          <div className="royal-modal-actions">
            <button onClick={()=>setShowListModal(false)} disabled={listPending}>Cancel</button>
            <button className="royal-primary" onClick={listForSale} disabled={!validListPrice||listPending}>{listPending?"Confirming…":"Approve & list"}</button>
          </div>
        </div>
      </div>
    </div>}

    <TransactionStatus transaction={transaction}/>
    {status&&<div className="royal-toast" role="status"><ShieldCheck size={18}/><span>{status}</span><button onClick={()=>setStatus("")} aria-label="Dismiss">×</button></div>}
  </main>;
}
