"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowUpRight, ChevronDown, ExternalLink, Grid2X2, Heart, List, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Trash2, Wallet, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, getAddress, erc721Abi, zeroAddress } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract } from "wagmi";
import { getMarketplaceChain, marketplaceChains, isMarketplaceChainId, tokenUrl, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { marketplaceAbi as abi, parseNativeAmount } from "@/lib/marketplace-abi";
import { inspectListing } from "@/lib/prepare-listing";
import { TransactionStatus, useMarketplaceTransaction } from "./components/use-marketplace-transaction";
import { favoriteId, useFavorite } from "./favorites";

type View = "market" | "sell" | "activity" | "account" | "protocol";
type Listing = { id:string; chainId:MarketplaceChainId; nftAddress:`0x${string}`; tokenId:string; seller:`0x${string}`; price:string; transactionHash:`0x${string}`; updatedBlock:number; tokenType?:"ERC-721"|"ERC-1155"; quantity?:string };
type Activity = { id:string; chainId:MarketplaceChainId; eventType:string; nftAddress:`0x${string}`|null; tokenId:string|null; seller:`0x${string}`|null; buyer:`0x${string}`|null; price:string|null; marketplaceFee?:string|null; royaltyAmount?:string|null; transactionHash:`0x${string}`; blockNumber:number };
type CollectionSummary = { chainId:MarketplaceChainId; nftAddress:string; floorPrice:string; listingCount:number; latestBlock:number; sampleTokenId:string };
type IndexerData = { chainId:MarketplaceChainId; chain:string; currency:string; explorerUrl:string; configured:boolean; marketplaceAddress?:`0x${string}`; listings:Listing[]; collections?:CollectionSummary[]; activity:Activity[]; sync?:{caughtUp:boolean}|null; syncError?:string|null };
type WalletNft = { contractAddress:string; tokenId:string; tokenType?:string; quantity?:string; name:string|null; collection:string|null; imageUrl:string|null; description:string|null; externalUrl:string|null; traits:Array<{type:string;value:string}> };


function short(value:string) { return `${value.slice(0,6)}…${value.slice(-4)}`; }

function removePurchasedFromCart(chainId:MarketplaceChainId, purchasedIds:string[]) {
  try {
    const key=`hoj-market-cart:${chainId}`;
    const stored=JSON.parse(window.localStorage.getItem(key)??"[]") as unknown;
    if(!Array.isArray(stored))return;
    window.localStorage.setItem(key,JSON.stringify(stored.filter(id=>typeof id==="string"&&!purchasedIds.includes(id))));
    window.dispatchEvent(new Event("hoj-cart-updated"));
  }catch{/* A completed purchase must not fail because browser storage is unavailable. */}
}

function useIndexer(chainId:MarketplaceChainId) {
  const chain=getMarketplaceChain(chainId);
  const fallback=useMemo<IndexerData>(()=>({chainId,chain:chain.name,currency:chain.currency,explorerUrl:chain.explorerUrl,configured:false,listings:[],activity:[]}),[chainId,chain]);
  const [data,setData] = useState<IndexerData>(fallback);
  const [loading,setLoading] = useState(true);
  const refresh=useCallback(async function refresh() {
    try { const response=await fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"}); const body=await response.json() as IndexerData;if(!response.ok)throw new Error("Indexer unavailable");setData(body); }
    catch(error){setData({...fallback,syncError:error instanceof Error?error.message:"Indexer temporarily unavailable"});}
    finally { setLoading(false); }
  },[chainId,fallback]);
  useEffect(()=>{const initial=window.setTimeout(refresh,0);const timer=window.setInterval(refresh,30_000);return()=>{window.clearTimeout(initial);window.clearInterval(timer);};},[refresh]);
  const current=data.chainId===chainId?data:fallback;
  return { data:current, loading:loading||data.chainId!==chainId, refresh };
}

function useWalletNfts(address:string|undefined,chainId:MarketplaceChainId) {
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
      try{const response=await fetch(`/api/wallet-nfts?owner=${encodeURIComponent(address)}&chainId=${chainId}`,{cache:"no-store"});const body=await response.json() as {nfts?:WalletNft[];error?:string};if(!response.ok)throw new Error(body.error??"Could not load wallet NFTs.");if(active)setNfts(body.nfts??[]);}
      catch(e){if(active)setError(e instanceof Error?e.message:"Could not load wallet NFTs.");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[address,chainId]);
  return {nfts,loading,error};
}

function useNftMetadata(listing: Listing | null) {
  const [nft,setNft]=useState<WalletNft|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;void(async()=>{await Promise.resolve();if(!active)return;if(!listing){setNft(null);setError("");return;}setLoading(true);setError("");try{const response=await fetch(`/api/nft?contract=${listing.nftAddress}&tokenId=${listing.tokenId}&chainId=${listing.chainId}`);const body=await response.json() as WalletNft&{error?:string};if(!response.ok)throw new Error(body.error??"Could not load NFT metadata.");if(active)setNft(body);}catch(e){if(active)setError(e instanceof Error?e.message:"Could not load NFT metadata.");}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[listing]);
  return {nft,loading,error};
}

export function Portal({ view }: { view:View }) {
  const walletChainId=useChainId();
  const [selectedChainId,setSelectedChainId]=useState<MarketplaceChainId>(isMarketplaceChainId(walletChainId)?walletChainId:109);
  useEffect(()=>{const requested=Number(new URLSearchParams(window.location.search).get("chainId"));if(isMarketplaceChainId(requested))queueMicrotask(()=>setSelectedChainId(requested));},[]);
  const selectedChain=getMarketplaceChain(selectedChainId);
  const { data,loading,refresh }=useIndexer(selectedChainId);
  const { address }=useAccount();
  const walletNfts=useWalletNfts(address,selectedChainId);
  const transaction=useMarketplaceTransaction(selectedChainId);
  const publicClient=usePublicClient({chainId:selectedChainId});
  const addressForRead=data.marketplaceAddress ?? zeroAddress;
  const { data:proceeds, refetch:refetchProceeds }=useReadContract({ address:addressForRead, abi, functionName:"getProceeds", args:[address ?? zeroAddress], chainId:selectedChainId, query:{enabled:!!address && !!data.marketplaceAddress} });
  const { data:marketplaceVersion }=useReadContract({address:addressForRead,abi,functionName:"marketplaceVersion",chainId:selectedChainId,query:{enabled:!!data.marketplaceAddress}});
  const advancedMarketplace=marketplaceVersion!==undefined&&marketplaceVersion>=2n;

  async function buy(item:Listing){
    if(!data.marketplaceAddress)return;
    const ok=await transaction.run("Purchase",async send=>{
      if(item.chainId!==selectedChainId)throw new Error("Select the NFT's network before buying.");
      if(item.tokenType==="ERC-1155")throw new Error("Open this NFT to choose an edition quantity.");
      await send({address:data.marketplaceAddress!,abi,functionName:"buyItem",args:[item.nftAddress,BigInt(item.tokenId)],value:BigInt(item.price)});
    });if(ok){removePurchasedFromCart(selectedChainId,[item.id]);void refresh();}
  }
  async function batchBuy(items:Listing[]){
    if(!data.marketplaceAddress||!advancedMarketplace||!items.length)return;
    const ok=await transaction.run("Batch purchase",async send=>{
      if(items.some(item=>item.chainId!==selectedChainId||item.tokenType==="ERC-1155"))throw new Error("A checkout must contain NFTs from one network.");
      await send({address:data.marketplaceAddress!,abi,functionName:"batchBuy",args:[items.map(item=>item.nftAddress),items.map(item=>BigInt(item.tokenId))],value:items.reduce((sum,item)=>sum+BigInt(item.price),0n)});
    });if(ok){removePurchasedFromCart(selectedChainId,items.map(item=>item.id));void refresh();}
  }
  async function makeOffer(item:Listing,amount:string){
    if(!data.marketplaceAddress||!advancedMarketplace||!publicClient)return;
    await transaction.run("Offer",async send=>{
      if(item.chainId!==selectedChainId)throw new Error("Select the NFT's network before making an offer.");
      if(item.tokenType==="ERC-1155")throw new Error("Edition offers are not supported by this marketplace.");
      const block=await publicClient.getBlock();
      await send({address:data.marketplaceAddress!,abi,functionName:"makeOffer",args:[item.nftAddress,BigInt(item.tokenId),block.timestamp+604800n],value:parseNativeAmount(amount)});
    });
  }
  async function list(nft:string,token:string,price:string){
    if(!address||!data.marketplaceAddress||!publicClient)return;
    const ok=await transaction.run("Listing",async send=>{
      const nftAddress=getAddress(nft),tokenId=BigInt(token),amount=parseNativeAmount(price);
      const state=await inspectListing(publicClient,data.marketplaceAddress!,nftAddress,tokenId,address);
      if(state.needsApproval)await send({address:nftAddress,abi:erc721Abi,functionName:"approve",args:[data.marketplaceAddress!,tokenId]},"NFT approval");
      await send({address:data.marketplaceAddress!,abi,functionName:"listItem",args:[nftAddress,tokenId,amount]});
    });if(ok)void refresh();
  }
  async function cancel(item:Listing){
    if(!data.marketplaceAddress)return;
    const ok=await transaction.run("Listing cancellation",async send=>{
      if(item.chainId!==selectedChainId)throw new Error("Select the NFT's network before canceling.");
      await send({address:data.marketplaceAddress!,abi,functionName:item.tokenType==="ERC-1155"?"cancelEdition":"cancelListing",args:[item.nftAddress,BigInt(item.tokenId)]});
    });if(ok)void refresh();
  }
  async function withdraw(){
    if(!data.marketplaceAddress)return;
    const ok=await transaction.run("Withdrawal",async send=>{await send({address:data.marketplaceAddress!,abi,functionName:"withdrawProceeds"});});
    if(ok)void refetchProceeds();
  }

  const mine=useMemo(()=>data.listings.filter(x=>address&&x.seller.toLowerCase()===address.toLowerCase()),[data.listings,address]);
  const labels:Record<View,[string,string,string]>= { market:["01 / MARKET","Browse NFTs",`NFTs currently listed for sale on ${selectedChain.name}.`], sell:["02 / PRESENT A WORK","Present a work",`Choose an NFT from your ${selectedChain.name} wallet, set a price in ${selectedChain.currency}, and confirm the listing.`], activity:["03 / ACTIVITY","Recent activity",`Listings, sales, cancellations, and withdrawals on ${selectedChain.name}.`], account:["04 / PROFILE","Your NFT profile",`View the NFTs held by your connected wallet, manage listings, and withdraw ${selectedChain.currency} earnings.`], protocol:["05 / HOW IT WORKS","How it works","Understand ownership, fees, royalties, and settlement before you trade."] };
  const [section,title,description]=labels[view];

  return <main className={`royal-portal-page royal-portal-${view}`}>
    <section className="royal-portal-hero"><label>Browse network <select value={selectedChainId} disabled={transaction.pending} onChange={event=>setSelectedChainId(Number(event.target.value) as MarketplaceChainId)}>{Object.values(marketplaceChains).map(network=><option key={network.id} value={network.id}>{network.name} · {network.currency}</option>)}</select></label><Link href="/" className="royal-back-link"><ArrowLeft size={14}/> House of Joshi</Link><span className="royal-section-no">{section}</span><h1>{title}</h1><p>{description}</p></section>
    <fieldset className="royal-transaction-fields royal-portal-content" disabled={transaction.pending}>
      {view==="market"&&<MarketView key={selectedChainId} data={data} loading={loading} account={address} advancedMarketplace={advancedMarketplace} onBuy={buy} onBatchBuy={batchBuy} onOffer={makeOffer} onCancel={cancel}/>}
      {view==="sell" && (
        <SellView configured={!!data.marketplaceAddress} connected={!!address} walletNfts={walletNfts} onList={list} chainId={selectedChainId} collections={data.collections??[]} floorComplete={!!data.sync?.caughtUp&&!data.syncError}/>
      )}
      {view==="activity"&&<ActivityView items={data.activity} loading={loading}/>}
      {view==="account"&&<AccountView connected={!!address} configured={!!data.marketplaceAddress} listings={mine} activity={data.activity} account={address} proceeds={proceeds ?? 0n} onCancel={cancel} onWithdraw={withdraw} currency={selectedChain.currency} walletNfts={walletNfts} chainId={selectedChainId}/>}
      {view==="protocol"&&<ProtocolView/>}
    </fieldset>
    <TransactionStatus transaction={transaction}/>
  </main>;
}

function MarketView({data,loading,account,advancedMarketplace,onBuy,onBatchBuy,onOffer,onCancel}:{data:IndexerData;loading:boolean;account?:`0x${string}`;advancedMarketplace:boolean;onBuy:(x:Listing)=>void;onBatchBuy:(items:Listing[])=>void;onOffer:(item:Listing,amount:string)=>void;onCancel:(x:Listing)=>void}){
  const[collection,setCollection]=useState("all");
  const[search,setSearch]=useState("");
  const[sort,setSort]=useState<"newest"|"low"|"high">("newest");
  const[filtersOpen,setFiltersOpen]=useState(true);
  const[cartIds,setCartIds]=useState<string[]>([]);
  const[cartOpen,setCartOpen]=useState(false);
  useEffect(()=>{
    try{
      const stored=JSON.parse(window.localStorage.getItem(`hoj-market-cart:${data.chainId}`)??"[]") as unknown;
      queueMicrotask(()=>{setCartIds(Array.isArray(stored)?stored.filter((id):id is string=>typeof id==="string"):[]);setCartOpen(new URLSearchParams(window.location.search).get("cart")==="1");});
    }catch{queueMicrotask(()=>setCartIds([]));}
  },[data.chainId]);
  useEffect(()=>{
    const update=()=>{
      try { const stored=JSON.parse(window.localStorage.getItem(`hoj-market-cart:${data.chainId}`)??"[]") as unknown;setCartIds(Array.isArray(stored)?stored.filter((id):id is string=>typeof id==="string"):[]); }
      catch { setCartIds([]); }
    };
    window.addEventListener("hoj-cart-updated",update);
    return()=>window.removeEventListener("hoj-cart-updated",update);
  },[data.chainId]);
  const collections=[...new Set(data.listings.map(item=>item.nftAddress))];
  const query=search.trim().toLowerCase();
  const filtered=data.listings.filter(item=>(collection==="all"||item.nftAddress===collection)&&(!query||item.tokenId.includes(query)||item.nftAddress.toLowerCase().includes(query)));
  const shown=[...filtered].sort((a,b)=>sort==="low"?Number(BigInt(a.price)-BigInt(b.price)):sort==="high"?Number(BigInt(b.price)-BigInt(a.price)):b.updatedBlock-a.updatedBlock);
  const cart=data.listings.filter(item=>item.tokenType!=="ERC-1155"&&cartIds.includes(item.id));
  const cartTotal=cart.reduce((total,item)=>total+BigInt(item.price),0n);
  function toggleCart(item:Listing){setCartIds(current=>{const next=current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id];try{window.localStorage.setItem(`hoj-market-cart:${data.chainId}`,JSON.stringify(next));window.dispatchEvent(new Event("hoj-cart-updated"));}catch{/* Cart remains available for this visit. */}return next;});}
  return <>
    <section className="market-toolbar">
      <button className={`filter-toggle ${filtersOpen?"active":""}`} onClick={()=>setFiltersOpen(value=>!value)} aria-expanded={filtersOpen}>
        <SlidersHorizontal size={17}/> Filters
      </button>
      <label><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search NFTs" aria-label="Search NFTs"/></label>
      <span><strong>{shown.length}</strong> items</span>
      <label className="sort-control"><span>Sort by</span><select value={sort} onChange={event=>setSort(event.target.value as "newest"|"low"|"high")} aria-label="Sort NFTs"><option value="newest">Recently listed</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select><ChevronDown size={14}/></label>
      <button className={`market-cart-button ${cart.length?"has-items":""}`} onClick={()=>setCartOpen(true)} aria-label={`Open cart with ${cart.length} items`}><ShoppingCart size={17}/><span>Cart</span><b>{cart.length}</b></button>
    </section>
    <div className={`market-browser ${filtersOpen?"":"filters-closed"}`}>
      {filtersOpen&&<aside className="market-filter-panel">
        <div><span>STATUS</span><small>{data.chain}</small></div>
        <div className="active"><span>Buy now</span><em>{data.listings.length}</em></div>
        <p>COLLECTION</p>
        <button className={collection==="all"?"active":""} onClick={()=>setCollection("all")}><span>All collections</span><em>{data.listings.length}</em></button>
        {collections.map(address=><button className={collection===address?"active":""} key={address} onClick={()=>setCollection(address)}><span>{short(address)}</span><em>{data.listings.filter(item=>item.nftAddress===address).length}</em></button>)}
        <p>CHAIN</p>
        <div className="active"><span>{data.chain}</span><em>✓</em></div>
        <p>PRICE</p>
        <div className="price-filter-note">Prices shown in {data.currency}</div>
      </aside>}
      <section className="market-results">
        {shown.length?<div className="market-listings-grid">{shown.map(item=><MarketListingCard key={item.id} item={item} currency={data.currency} chain={data.chain} inCart={cartIds.includes(item.id)} onToggleCart={()=>toggleCart(item)}/>)}</div>:<div className="market-no-results"><Search size={24}/><h2>{loading?"Loading listings…":data.configured?data.listings.length?"No matching NFTs":"No active listings on this network":`${data.chain} marketplace coming soon`}</h2><p>{loading?"Reading the latest marketplace listings.":data.syncError??(data.listings.length?"Try a different search or collection filter.":data.configured?"Choose another network or check back when an owner lists an NFT.":"Trading will open after the marketplace contract is deployed.")}</p>{data.listings.length>0&&<button onClick={()=>{setSearch("");setCollection("all")}}>Clear filters</button>}</div>}
      </section>
    </div>
    {cartOpen&&<CartDrawer items={cart} currency={data.currency} account={account} total={cartTotal} batchSupported={advancedMarketplace} onClose={()=>setCartOpen(false)} onRemove={item=>toggleCart(item)} onBuy={onBuy} onBatchBuy={()=>onBatchBuy(cart)}/>}
  </>
}

function MarketListingCard({item,currency,chain,inCart,onToggleCart}:{item:Listing;currency:string;chain:string;inCart:boolean;onToggleCart:()=>void}){
  const details=useNftMetadata(item);
  const nft=details.nft;
  const [artFailed,setArtFailed]=useState(false);
  const showArt=!!nft?.imageUrl&&!artFailed;
  const saved=useFavorite(favoriteId(item.chainId,item.nftAddress,item.tokenId));
  return <article className="market-listing">
    <Link href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}`} className={`market-listing-art ${showArt?"has-image":""}`}>
      {showArt?<Image src={nft.imageUrl!} alt={nft.name??`NFT #${item.tokenId}`} fill unoptimized sizes="(max-width: 700px) 50vw, 220px" style={{objectFit:"cover"}} onError={()=>setArtFailed(true)}/>:<><span>{chain} · {item.tokenType??"ERC-721"}</span><strong>#{item.tokenId}</strong><i>Artwork unavailable</i></>}
    </Link>
    <button className={`market-favorite ${saved.favorite?"active":""}`} onClick={saved.toggle} aria-label={saved.favorite?"Remove from favorites":"Add to favorites"}><Heart size={15} fill={saved.favorite?"currentColor":"none"}/></button>
    <div>
      <small>{nft?.collection??short(item.nftAddress)}</small>
      <h2><Link href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}`}>{nft?.name??`Token #${item.tokenId}`}</Link></h2>
      <div className="market-card-price"><span>{item.tokenType==="ERC-1155"?"PER EDITION":"PRICE"}</span><strong>{formatEther(BigInt(item.price))} {currency}</strong></div>
      <div className="market-card-actions"><Link href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}`}>View NFT <ArrowUpRight size={13}/></Link>{item.tokenType!=="ERC-1155"&&<button className={inCart?"active":""} onClick={onToggleCart} aria-label={inCart?"Remove from cart":"Add to cart"}><ShoppingCart size={14}/>{inCart?"Added":"Add"}</button>}</div>
    </div>
  </article>
}

function CartDrawer({items,currency,account,total,batchSupported,onClose,onRemove,onBuy,onBatchBuy}:{items:Listing[];currency:string;account?:`0x${string}`;total:bigint;batchSupported:boolean;onClose:()=>void;onRemove:(item:Listing)=>void;onBuy:(item:Listing)=>void;onBatchBuy:()=>void}){
  return <div className="cart-backdrop" role="dialog" aria-modal="true" aria-label="Shopping cart" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><aside className="cart-drawer"><header><div><span>MARKETPLACE CART</span><h2>Your selections</h2></div><button onClick={onClose} aria-label="Close cart"><X size={18}/></button></header>{items.length?<><div className="cart-items">{items.map(item=><article key={item.id}><div><span>ERC-721 · #{item.tokenId}</span><strong>{short(item.nftAddress)}</strong><small>{formatEther(BigInt(item.price))} {currency}</small></div><button onClick={()=>onRemove(item)} aria-label={`Remove token ${item.tokenId} from cart`}><Trash2 size={15}/></button>{account?<button className="cart-buy" onClick={()=>onBuy(item)}>Buy now <ArrowUpRight size={14}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button className="cart-buy" onClick={openConnectModal}>Connect to buy <Wallet size={14}/></button>}</ConnectButton.Custom>}</article>)}</div><footer><span>TOTAL · {items.length} {items.length===1?"ITEM":"ITEMS"}</span><strong>{formatEther(total)} {currency}</strong>{batchSupported&&account&&items.length>1?<button className="batch-checkout" onClick={onBatchBuy}>Buy all in one transaction <ShoppingCart size={15}/></button>:<p>{batchSupported?"Connect your wallet to use batch checkout.":"Each NFT is settled separately until the upgraded marketplace contract is deployed on this network."}</p>}</footer></>:<div className="cart-empty"><ShoppingCart size={28}/><h3>Your cart is empty.</h3><p>Add listed NFTs to keep them together while you browse.</p><button onClick={onClose}>Continue browsing</button></div>}</aside></div>;
}

function MarketNftDetail({listing,details,account,advancedMarketplace,onClose,onBuy,onOffer,onDelist}:{listing:Listing;details:{nft:WalletNft|null;loading:boolean;error:string};account?:`0x${string}`;advancedMarketplace:boolean;onClose:()=>void;onBuy:()=>void;onOffer:(amount:string)=>void;onDelist:()=>void}){
  const[offer,setOffer]=useState("");
  const nft=details.nft;const chain=getMarketplaceChain(listing.chainId);const isSeller=!!account&&account.toLowerCase()===listing.seller.toLowerCase();
  return <div className="nft-detail-backdrop" role="dialog" aria-modal="true" aria-label="Listed NFT details" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><article className="nft-detail"><button className="nft-detail-close" onClick={onClose} aria-label="Close NFT details"><X size={18}/></button>{nft?.imageUrl?<div className="nft-detail-image"><img src={nft.imageUrl} alt={nft.name??`NFT #${listing.tokenId}`}/></div>:<div className="nft-detail-image empty"/>}<div className="nft-detail-copy"><small>{nft?.collection??short(listing.nftAddress)} · {chain.name} · ERC-721</small><h2>{nft?.name??`Token #${listing.tokenId}`}</h2><p className="nft-token-id">#{listing.tokenId} · {short(listing.nftAddress)}</p>{details.loading&&<p className="nft-description">Loading verified metadata…</p>}{details.error&&<p className="nft-description">{details.error}</p>}{nft?.description&&<p className="nft-description">{nft.description}</p>}{nft&&nft.traits.length>0&&<section className="nft-traits"><span>TRAITS</span><div>{nft.traits.map(trait=><article key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></article>)}</div></section>}<div className="listing-price-panel"><span>LISTING PRICE</span><strong>{formatEther(BigInt(listing.price))} {chain.currency}</strong><small>Seller · {short(listing.seller)}</small></div>{advancedMarketplace&&account&&!isSeller&&<form className="offer-form" onSubmit={event=>{event.preventDefault();if(Number(offer)>0)onOffer(offer);}}><label><span>MAKE A 7-DAY OFFER</span><input value={offer} onChange={event=>setOffer(event.target.value)} inputMode="decimal" placeholder={`Amount in ${chain.currency}`}/></label><button disabled={Number(offer)<=0}>Place offer</button></form>}{!advancedMarketplace&&account&&!isSeller&&<p className="marketplace-upgrade-note">Offers will activate on {chain.name} after the version 2 marketplace contract is deployed.</p>}<div className="nft-detail-actions">{isSeller?<button className="delist-button" onClick={onDelist}>Delist NFT <X size={15}/></button>:account?<button onClick={onBuy}>Buy now <ArrowUpRight size={15}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect to buy <Wallet size={15}/></button>}</ConnectButton.Custom>}<Link href={`/nft/${listing.chainId}/${listing.nftAddress}/${listing.tokenId}`}>Open NFT page <ArrowUpRight size={14}/></Link>{nft?.externalUrl&&<a href={nft.externalUrl} target="_blank" rel="noreferrer">Collection link <ExternalLink size={14}/></a>}<a href={tokenUrl(listing.chainId,listing.nftAddress,listing.tokenId)} target="_blank" rel="noreferrer">View on {chain.name} explorer <ExternalLink size={14}/></a></div></div></article></div>;
}
function ListingTile({item,action}:{item:Listing;action:React.ReactNode}){const chain=getMarketplaceChain(item.chainId);return <article className="portal-card"><div className="portal-token"><span>{chain.name} · ERC-721</span><strong>#{item.tokenId}</strong><i>{short(item.nftAddress)}</i></div><div className="portal-card-copy"><small>{short(item.nftAddress)}</small><h2>Token #{item.tokenId}</h2><p>Seller · {short(item.seller)}</p><div><span>Total price</span><strong>{formatEther(BigInt(item.price))} {chain.currency}</strong></div>{action}</div></article>}

function SellView({configured,connected,walletNfts,onList,chainId,collections,floorComplete}:{configured:boolean;connected:boolean;walletNfts:{nfts:WalletNft[];loading:boolean;error:string};onList:(n:string,t:string,p:string)=>void;chainId:MarketplaceChainId;collections:CollectionSummary[];floorComplete:boolean}){
  const[nft,setNft]=useState("");const[token,setToken]=useState("");const[price,setPrice]=useState("");const[layout,setLayout]=useState<"grid"|"list">("grid");const[active,setActive]=useState<WalletNft|null>(null);
  const listableNfts=walletNfts.nfts.filter(item=>["ERC-721","ERC-1155"].includes(item.tokenType??"ERC-721"));
  const validPrice=/^\d+(?:\.\d{1,18})?$/.test(price.trim())&&Number(price)>0;
  const valid=/^0x[a-fA-F0-9]{40}$/.test(nft)&&/^\d+$/.test(token)&&validPrice;const chain=getMarketplaceChain(chainId);
  const collection=collections.find(item=>item.nftAddress.toLowerCase()===nft.toLowerCase());
  const floor=collection?BigInt(collection.floorPrice):null;
  const priceDelta=floor!==null&&floor>0n&&validPrice?Number((parseNativeAmount(price.trim())-floor)*10_000n/floor)/100:null;
  function choose(item:WalletNft){setNft(item.contractAddress);setToken(item.tokenId);setActive(null);window.requestAnimationFrame(()=>document.getElementById("listing-price")?.focus());}
  return <><div className="sell-layout"><form onSubmit={e=>{e.preventDefault();if(valid)onList(nft,token,price)}}>{connected&&<section className="wallet-nfts"><div className="wallet-nfts-head"><div><span>YOUR {chain.name.toUpperCase()} NFTs</span><small>{walletNfts.loading?"Loading your wallet…":`${listableNfts.length} NFTs found`}</small></div><div className="layout-toggle" aria-label="NFT view"><button className={layout==="grid"?"active":""} type="button" onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={14}/></button><button className={layout==="list"?"active":""} type="button" onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div></div>{walletNfts.error?<p className="wallet-nfts-message">{walletNfts.error}</p>:walletNfts.loading?<p className="wallet-nfts-message">Reading your onchain holdings…</p>:listableNfts.length?<div className={`wallet-nft-grid ${layout}`}>{listableNfts.map(item=>item.tokenType==="ERC-1155"?<Link className="wallet-nft" key={`${item.contractAddress}:${item.tokenId}`} href={`/nft/${chainId}/${item.contractAddress}/${item.tokenId}`}>{item.imageUrl?<span className="wallet-nft-image"><img src={item.imageUrl} alt={item.name??`Token #${item.tokenId}`}/></span>:<span className="wallet-nft-image empty"/>}<span>{item.collection??short(item.contractAddress)}</span><strong>{item.name??`Token #${item.tokenId}`}</strong><small>ERC-1155 · {item.quantity??"1"} owned · List editions</small></Link>:<button className="wallet-nft" type="button" key={`${item.contractAddress}:${item.tokenId}`} onClick={()=>setActive(item)}>{item.imageUrl?<span className="wallet-nft-image"><img src={item.imageUrl} alt={item.name??`Token #${item.tokenId}`}/></span>:<span className="wallet-nft-image empty"/>}<span>{item.collection??short(item.contractAddress)}</span><strong>{item.name??`Token #${item.tokenId}`}</strong><small>ERC-721 · #{item.tokenId}</small></button>)}</div>:<p className="wallet-nfts-message">No NFTs found in this {chain.name} wallet.</p>}</section>}<div className="listing-fields"><label><span>ERC-721 NFT contract</span><input value={nft} onChange={e=>setNft(e.target.value)} placeholder="0x…"/></label><div className="field-row"><label><span>Token ID</span><input value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter token ID"/></label><label><span>Total price in {chain.currency}</span><input id="listing-price" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Enter amount"/></label></div><p className="wallet-nfts-message">For ERC-1155 editions, open the NFT page to set the quantity and price per edition.</p><div className="listing-floor-context" role="status"><span>{floorComplete?"Current marketplace floor":"Observed listing low"}</span><strong>{floor!==null?`${formatEther(floor)} ${chain.currency}`:floorComplete?"No active listings":"Unavailable"}</strong>{priceDelta!==null&&<small>{priceDelta===0?"Your price is at floor":`Your price is ${Math.abs(priceDelta).toFixed(1)}% ${priceDelta>0?"above":"below"} floor`}</small>}{!floorComplete&&<small>Full listing history is not yet verified on {chain.name}.</small>}</div></div>{connected?<button disabled={!configured||!valid}>{configured?"Approve & list":`Deploy on ${chain.name} first`} <ArrowUpRight/></button>:<ConnectButton.Custom>{({openConnectModal})=><button type="button" onClick={openConnectModal}>Connect wallet <Wallet/></button>}</ConnectButton.Custom>}</form><aside><span>SETTLEMENT TERMS · {chain.name.toUpperCase()}</span><h2>Your asset stays with you.</h2><p>Open a work to inspect its metadata, then set a {chain.currency} price and list it.</p><dl><div><dt>Marketplace fee</dt><dd>2%</dd></div><div><dt>Creator royalty</dt><dd>ERC-2981, if supported</dd></div><div><dt>Seller proceeds</dt><dd>Withdrawable in {chain.currency}</dd></div></dl></aside></div>{active&&<NftDetail item={active} chainId={chainId} onClose={()=>setActive(null)} onList={()=>choose(active)}/>}</>}

function NftDetail({item,chainId,onClose,onList}:{item:WalletNft;chainId:MarketplaceChainId;onClose:()=>void;onList:()=>void}){const chain=getMarketplaceChain(chainId);const tokenType=item.tokenType??"ERC-721";return <div className="nft-detail-backdrop" role="dialog" aria-modal="true" aria-label="NFT details" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><article className="nft-detail"><button className="nft-detail-close" onClick={onClose} aria-label="Close NFT details"><X size={18}/></button>{item.imageUrl?<div className="nft-detail-image"><img src={item.imageUrl} alt={item.name??`Token #${item.tokenId}`}/></div>:<div className="nft-detail-image empty"/>}<div className="nft-detail-copy"><small>{item.collection??short(item.contractAddress)} · {chain.name} · {tokenType}</small><h2>{item.name??`Token #${item.tokenId}`}</h2><p className="nft-token-id">#{item.tokenId} · {short(item.contractAddress)}{item.quantity&&item.quantity!=="1"?` · Quantity ${item.quantity}`:""}</p>{item.description&&<p className="nft-description">{item.description}</p>}{item.traits.length>0&&<section className="nft-traits"><span>TRAITS</span><div>{item.traits.map(trait=><article key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></article>)}</div></section>}<div className="nft-detail-actions">{tokenType==="ERC-721"&&<button onClick={onList}>List this NFT <ArrowUpRight size={15}/></button>}{item.externalUrl&&<a href={item.externalUrl} target="_blank" rel="noreferrer">Collection link <ExternalLink size={14}/></a>}<a href={tokenUrl(chainId,item.contractAddress,item.tokenId)} target="_blank" rel="noreferrer">View on {chain.name} explorer <ExternalLink size={14}/></a></div></div></article></div>}

function ActivityView({items,loading}:{items:Activity[];loading:boolean}){if(!items.length)return <Empty eyebrow={loading?"SYNCING":"NO EVENTS"} title={loading?"Reading confirmed blocks.":"No activity recorded."} detail="Contract events will appear here after confirmation."/>;return <div className="portal-activity">{items.map(x=>{const chain=getMarketplaceChain(x.chainId);return <a key={x.id} href={transactionUrl(x.chainId,x.transactionHash)} target="_blank" rel="noreferrer"><b>{x.eventType.toUpperCase()}</b><span>{x.nftAddress&&x.tokenId?`${short(x.nftAddress)} · #${x.tokenId}`:x.seller?short(x.seller):"Marketplace"}</span><span>{x.price?`${formatEther(BigInt(x.price))} ${chain.currency}`:"—"}</span><span>{chain.name} · Block {x.blockNumber}</span><ExternalLink size={14}/></a>})}</div>}

function AccountView({connected,configured,listings,activity,account,proceeds,onCancel,onWithdraw,currency,walletNfts,chainId}:{connected:boolean;configured:boolean;listings:Listing[];activity:Activity[];account?:`0x${string}`;proceeds:bigint;onCancel:(x:Listing)=>void;onWithdraw:()=>void;currency:string;walletNfts:{nfts:WalletNft[];loading:boolean;error:string};chainId:MarketplaceChainId}){
  const[layout,setLayout]=useState<"grid"|"list">("grid");
  const[active,setActive]=useState<WalletNft|null>(null);
  const[section,setSection]=useState<"owned"|"listed"|"history">("owned");
  const[query,setQuery]=useState("");
  const chain=getMarketplaceChain(chainId);
  if(!connected)return <ConnectButton.Custom>{({openConnectModal})=><Empty eyebrow="WALLET REQUIRED" title="Connect to view your NFTs." detail="NFTs held by your wallet, active listings, and withdrawable proceeds will appear here for the selected network." action={<button onClick={openConnectModal}>Connect wallet <Wallet size={15}/></button>}/>}</ConnectButton.Custom>;
  const normalized=query.trim().toLowerCase();
  const owned=walletNfts.nfts.filter(item=>!normalized||(item.name??"").toLowerCase().includes(normalized)||(item.collection??"").toLowerCase().includes(normalized)||item.tokenId.includes(normalized)||item.contractAddress.toLowerCase().includes(normalized));
  const history=activity.filter(item=>account&&(["sold","offer_accepted"].includes(item.eventType))&&(item.seller?.toLowerCase()===account.toLowerCase()||item.buyer?.toLowerCase()===account.toLowerCase()));
  return <><nav className="profile-management"><button className={section==="owned"?"active":""} onClick={()=>setSection("owned")}>Owned <b>{walletNfts.nfts.length}</b></button><button className={section==="listed"?"active":""} onClick={()=>setSection("listed")}>Listed <b>{listings.length}</b></button><button className={section==="history"?"active":""} onClick={()=>setSection("history")}>Sales & purchases <b>{history.length}</b></button><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search your NFTs"/></label></nav>
    {section==="owned"&&<section className="profile-wallet-section">
      <div className="wallet-nfts-head">
        <div><span>YOUR {chain.name.toUpperCase()} NFTs</span><small>{walletNfts.loading?"Loading your wallet…":`${walletNfts.nfts.length} NFTs found`}</small></div>
        <div className="layout-toggle" aria-label="NFT view"><button className={layout==="grid"?"active":""} type="button" onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={14}/></button><button className={layout==="list"?"active":""} type="button" onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div>
      </div>
      {walletNfts.error?<p className="wallet-nfts-message">{walletNfts.error}</p>:walletNfts.loading?<p className="wallet-nfts-message">Reading verified NFT holdings from the {chain.name} network…</p>:owned.length?<div className={`wallet-nft-grid profile-nft-grid ${layout}`}>{owned.map(item=><button className="wallet-nft" type="button" key={`${item.contractAddress}:${item.tokenId}`} onClick={()=>setActive(item)}>{item.imageUrl?<span className="wallet-nft-image"><img src={item.imageUrl} alt={item.name??`Token #${item.tokenId}`}/></span>:<span className="wallet-nft-image empty"/>}<span>{item.collection??short(item.contractAddress)}</span><strong>{item.name??`Token #${item.tokenId}`}</strong><small>#{item.tokenId} · {item.tokenType??"ERC-721"}</small></button>)}</div>:<p className="account-empty">No matching NFTs were found in this wallet on {chain.name}.</p>}
    </section>}
    <div className="account-balance"><span>WITHDRAWABLE PROCEEDS</span><strong>{formatEther(proceeds)} {currency}</strong><button disabled={!configured||proceeds===0n} onClick={onWithdraw}>Withdraw proceeds <ArrowUpRight/></button></div>
    {section==="listed"&&<div className="account-section"><span className="section-no">ACTIVE LISTINGS</span>{listings.length?<div className="portal-grid account-grid">{listings.map(x=><ListingTile key={x.id} item={x} action={<button onClick={()=>onCancel(x)}>Cancel listing</button>}/>)}</div>:<p className="account-empty">You have no active listings on this network.</p>}</div>}
    {section==="history"&&<div className="account-section"><span className="section-no">CONFIRMED SALES & PURCHASES</span>{history.length?<div className="profile-history">{history.map(item=><a key={item.id} href={transactionUrl(item.chainId,item.transactionHash)} target="_blank" rel="noreferrer"><span>{item.seller?.toLowerCase()===account?.toLowerCase()?"SOLD":"PURCHASED"}</span><strong>Token #{item.tokenId}</strong><small>{item.price?`${formatEther(BigInt(item.price))} ${currency}`:"—"}</small><ExternalLink size={14}/></a>)}</div>:<p className="account-empty">No confirmed sales or purchases were found on this network.</p>}</div>}
    {active&&<NftDetail item={active} chainId={chainId} onClose={()=>setActive(null)} onList={()=>{window.location.href="/sell";}}/>}
  </>;
}

function ProtocolView(){return <div className="protocol-grid"><article><span>01</span><h2>Non-custodial</h2><p>Listed NFTs stay in the owner’s wallet. The marketplace transfers only after exact payment and valid approval.</p></article><article><span>02</span><h2>Fixed 2% fee</h2><p>The buyer pays the displayed listing price. Two percent is permanently credited to the House of Joshi treasury; the remainder goes to the seller after royalties.</p></article><article><span>03</span><h2>Creator royalties</h2><p>Collections implementing ERC-2981 receive royalties in the selected chain’s native settlement currency.</p></article><article><span>04</span><h2>Chain isolation</h2><p>Listings, proceeds, activity, and settlement remain isolated by network; assets and currencies are never silently mixed.</p></article></div>}

function Empty({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail:string;action?:React.ReactNode}){return <div className="portal-empty"><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p>{action}</div>}
