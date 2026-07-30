"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowUpRight, ChevronDown, ExternalLink, Grid2X2, List, Search, ShieldCheck, SlidersHorizontal, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, getAddress, parseEther, zeroAddress } from "viem";
import { useAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { getMarketplaceChain, isMarketplaceChainId, tokenUrl, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";

type View = "market" | "sell" | "activity" | "account" | "protocol";
type Listing = { id:string; chainId:MarketplaceChainId; nftAddress:`0x${string}`; tokenId:string; seller:`0x${string}`; price:string; transactionHash:`0x${string}`; updatedBlock:number };
type Activity = { id:string; chainId:MarketplaceChainId; eventType:string; nftAddress:`0x${string}`|null; tokenId:string|null; seller:`0x${string}`|null; buyer:`0x${string}`|null; price:string|null; marketplaceFee?:string|null; royaltyAmount?:string|null; transactionHash:`0x${string}`; blockNumber:number };
type IndexerData = { chainId:MarketplaceChainId; chain:string; currency:string; explorerUrl:string; configured:boolean; marketplaceAddress?:`0x${string}`; listings:Listing[]; activity:Activity[]; syncError?:string|null };
type WalletNft = { contractAddress:string; tokenId:string; name:string|null; collection:string|null; imageUrl:string|null; description:string|null; externalUrl:string|null; traits:Array<{type:string;value:string}> };

const abi = [
  { type:"function", name:"listItem", stateMutability:"nonpayable", inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"},{name:"price",type:"uint256"}], outputs:[] },
  { type:"function", name:"buyItem", stateMutability:"payable", inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"}], outputs:[] },
  { type:"function", name:"cancelListing", stateMutability:"nonpayable", inputs:[{name:"nftAddress",type:"address"},{name:"tokenId",type:"uint256"}], outputs:[] },
  { type:"function", name:"withdrawProceeds", stateMutability:"nonpayable", inputs:[], outputs:[] },
  { type:"function", name:"getProceeds", stateMutability:"view", inputs:[{name:"recipient",type:"address"}], outputs:[{name:"",type:"uint256"}] },
] as const;
const erc721Abi = [{ type:"function", name:"approve", stateMutability:"nonpayable", inputs:[{name:"to",type:"address"},{name:"tokenId",type:"uint256"}], outputs:[] }] as const;

function short(value:string) { return `${value.slice(0,6)}…${value.slice(-4)}`; }

function useIndexer(chainId:MarketplaceChainId) {
  const chain=getMarketplaceChain(chainId);
  const [data,setData] = useState<IndexerData>({ chainId,chain:chain.name,currency:chain.currency,explorerUrl:chain.explorerUrl,configured:false,listings:[],activity:[] });
  const [loading,setLoading] = useState(true);
  const refresh=useCallback(async function refresh() {
    try { const response=await fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"}); if(!response.ok) throw new Error("Indexer unavailable"); setData(await response.json() as IndexerData); }
    finally { setLoading(false); }
  },[chainId]);
  useEffect(()=>{ void refresh();const timer=window.setInterval(refresh,30_000);return()=>window.clearInterval(timer); },[refresh]);
  const current=data.chainId===chainId?data:{chainId,chain:chain.name,currency:chain.currency,explorerUrl:chain.explorerUrl,configured:false,listings:[],activity:[]};
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
  useEffect(()=>{let active=true;void(async()=>{if(!listing){setNft(null);setError("");return;}setLoading(true);setError("");try{const response=await fetch(`/api/nft?contract=${listing.nftAddress}&tokenId=${listing.tokenId}&chainId=${listing.chainId}`);const body=await response.json() as WalletNft&{error?:string};if(!response.ok)throw new Error(body.error??"Could not load NFT metadata.");if(active)setNft(body);}catch(e){if(active)setError(e instanceof Error?e.message:"Could not load NFT metadata.");}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[listing]);
  return {nft,loading,error};
}

export function Portal({ view }: { view:View }) {
  const walletChainId=useChainId();
  const selectedChainId:MarketplaceChainId=isMarketplaceChainId(walletChainId)?walletChainId:109;
  const selectedChain=getMarketplaceChain(selectedChainId);
  const { data,loading,refresh }=useIndexer(selectedChainId);
  const { address }=useAccount();
  const walletNfts=useWalletNfts(address,selectedChainId);
  const { switchChainAsync }=useSwitchChain();
  const { writeContractAsync }=useWriteContract();
  const [status,setStatus]=useState("");
  const addressForRead=data.marketplaceAddress ?? zeroAddress;
  const { data:proceeds, refetch:refetchProceeds }=useReadContract({ address:addressForRead, abi, functionName:"getProceeds", args:[address ?? zeroAddress], chainId:selectedChainId, query:{enabled:!!address && !!data.marketplaceAddress} });

  async function ensureChain(target:MarketplaceChainId=selectedChainId){ if(walletChainId!==target) await switchChainAsync({chainId:target}); }
  async function buy(item:Listing){ if(!address||!data.marketplaceAddress)return; try{await ensureChain(item.chainId);setStatus("Confirm the purchase in your wallet.");const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"buyItem",args:[item.nftAddress,BigInt(item.tokenId)],value:BigInt(item.price),chainId:item.chainId});setStatus(`Purchase submitted · ${short(hash)}`);window.setTimeout(refresh,5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Purchase failed");} }
  async function list(nft:string,token:string,price:string){ if(!address||!data.marketplaceAddress)return; try{await ensureChain();const nftAddress=getAddress(nft);setStatus("Step 1 of 2 · Approve the marketplace.");await writeContractAsync({address:nftAddress,abi:erc721Abi,functionName:"approve",args:[data.marketplaceAddress,BigInt(token)],chainId:selectedChainId});setStatus("Step 2 of 2 · Confirm the listing.");const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"listItem",args:[nftAddress,BigInt(token),parseEther(price)],chainId:selectedChainId});setStatus(`Listing submitted · ${short(hash)}`);window.setTimeout(refresh,5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Listing failed");} }
  async function cancel(item:Listing){ if(!address||!data.marketplaceAddress)return;try{await ensureChain(item.chainId);const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"cancelListing",args:[item.nftAddress,BigInt(item.tokenId)],chainId:item.chainId});setStatus(`Cancellation submitted · ${short(hash)}`);window.setTimeout(refresh,5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Cancellation failed");} }
  async function withdraw(){ if(!address||!data.marketplaceAddress)return;try{await ensureChain();const hash=await writeContractAsync({address:data.marketplaceAddress,abi,functionName:"withdrawProceeds",chainId:selectedChainId});setStatus(`Withdrawal submitted · ${short(hash)}`);window.setTimeout(()=>refetchProceeds(),5_000);}catch(e){setStatus(e instanceof Error?e.message.split("\n")[0]:"Withdrawal failed");} }

  const mine=useMemo(()=>data.listings.filter(x=>address&&x.seller.toLowerCase()===address.toLowerCase()),[data.listings,address]);
  const labels:Record<View,[string,string,string]>= { market:["01 / MARKET","Browse NFTs",`NFTs currently listed for sale on ${selectedChain.name}.`], sell:["02 / SELL","List an NFT",`Choose an NFT, set a price in ${selectedChain.currency}, and confirm the listing in your wallet.`], activity:["03 / ACTIVITY","Recent activity",`Listings, sales, cancellations, and withdrawals on ${selectedChain.name}.`], account:["04 / PROFILE","Your NFT profile",`View the NFTs held by your connected wallet, manage listings, and withdraw ${selectedChain.currency} earnings.`], protocol:["05 / HOW IT WORKS","How it works","Understand ownership, fees, royalties, and settlement before you trade."] };
  const [section,title,description]=labels[view];

  return <main className={`portal-page portal-${view}`}>
    <section className="portal-hero"><Link href="/" className="back-link"><ArrowLeft size={14}/> House of Joshi</Link><span className="section-no">{section}</span><h1>{title}</h1><p>{description}</p></section>
    <section className="portal-content">
      {view==="market"&&<MarketView data={data} loading={loading} account={address} onBuy={buy} onCancel={cancel}/>}
      {view==="sell" && (
        <SellView configured={!!data.marketplaceAddress} connected={!!address} walletNfts={walletNfts} onList={list} chainId={selectedChainId}/>
      )}
      {view==="activity"&&<ActivityView items={data.activity} loading={loading}/>} 
      {view==="account"&&<AccountView connected={!!address} configured={!!data.marketplaceAddress} listings={mine} proceeds={proceeds ?? 0n} onCancel={cancel} onWithdraw={withdraw} currency={selectedChain.currency} walletNfts={walletNfts} chainId={selectedChainId}/>}
      {view==="protocol"&&<ProtocolView/>}
    </section>
    {status&&<div className="toast" role="status"><ShieldCheck size={18}/><span>{status}</span><button onClick={()=>setStatus("")}><X size={16}/></button></div>}
  </main>;
}

function MarketView({data,loading,account,onBuy,onCancel}:{data:IndexerData;loading:boolean;account?:`0x${string}`;onBuy:(x:Listing)=>void;onCancel:(x:Listing)=>void}){
  const[collection,setCollection]=useState("all");
  const[search,setSearch]=useState("");
  const[sort,setSort]=useState<"newest"|"low"|"high">("newest");
  const[active,setActive]=useState<Listing|null>(null);
  const[filtersOpen,setFiltersOpen]=useState(true);
  const details=useNftMetadata(active);
  if(!data.listings.length)return <Empty eyebrow={loading?`SYNCING ${data.chain.toUpperCase()}`:data.configured?"NO ACTIVE LISTINGS":"DEPLOYMENT NEEDED"} title={loading?"Reading the onchain record.":data.configured?"No works are listed.":`${data.chain} is ready for its marketplace contract.`} detail={data.syncError||(data.configured?"Only verified active listings appear here.":"Add the contract address and deployment block to activate this network.")}/>;
  const collections=[...new Set(data.listings.map(item=>item.nftAddress))];
  const query=search.trim().toLowerCase();
  const filtered=data.listings.filter(item=>(collection==="all"||item.nftAddress===collection)&&(!query||item.tokenId.includes(query)||item.nftAddress.toLowerCase().includes(query)));
  const shown=[...filtered].sort((a,b)=>sort==="low"?Number(BigInt(a.price)-BigInt(b.price)):sort==="high"?Number(BigInt(b.price)-BigInt(a.price)):b.updatedBlock-a.updatedBlock);
  return <>
    <nav className="market-tabs" aria-label="Marketplace categories">
      <button className="active">All</button>
      <span>Art</span>
      <span>Collectibles</span>
      <span>Gaming</span>
      <span>Photography</span>
      <span>Music</span>
    </nav>
    <section className="market-toolbar">
      <button className={`filter-toggle ${filtersOpen?"active":""}`} onClick={()=>setFiltersOpen(value=>!value)} aria-expanded={filtersOpen}>
        <SlidersHorizontal size={17}/> Filters
      </button>
      <label><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search items and collections" aria-label="Search NFTs"/></label>
      <span><strong>{shown.length}</strong> items</span>
      <label className="sort-control"><span>Sort by</span><select value={sort} onChange={event=>setSort(event.target.value as "newest"|"low"|"high")} aria-label="Sort NFTs"><option value="newest">Recently listed</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select><ChevronDown size={14}/></label>
    </section>
    <div className={`market-browser ${filtersOpen?"":"filters-closed"}`}>
      {filtersOpen&&<aside className="market-filter-panel">
        <div><span>STATUS</span><small>{data.chain}</small></div>
        <button className="active"><span>Buy now</span><em>{data.listings.length}</em></button>
        <p>COLLECTION</p>
        <button className={collection==="all"?"active":""} onClick={()=>setCollection("all")}><span>All collections</span><em>{data.listings.length}</em></button>
        {collections.map(address=><button className={collection===address?"active":""} key={address} onClick={()=>setCollection(address)}><span>{short(address)}</span><em>{data.listings.filter(item=>item.nftAddress===address).length}</em></button>)}
        <p>CHAIN</p>
        <button className="active"><span>{data.chain}</span><em>✓</em></button>
        <p>PRICE</p>
        <div className="price-filter-note">Prices shown in {data.currency}</div>
      </aside>}
      <section className="market-results">
        {shown.length?<div className="market-listings-grid">{shown.map(item=><MarketListingCard key={item.id} item={item} currency={data.currency} chain={data.chain} onOpen={()=>setActive(item)}/>)}</div>:<div className="market-no-results"><Search size={24}/><h2>No NFTs found</h2><p>Try another token ID, contract address, or collection.</p><button onClick={()=>{setSearch("");setCollection("all")}}>Clear filters</button></div>}
      </section>
    </div>
    {active&&<MarketNftDetail listing={active} details={details} account={account} onClose={()=>setActive(null)} onBuy={()=>onBuy(active)} onDelist={()=>{onCancel(active);setActive(null);}}/>}
  </>
}

function MarketListingCard({item,currency,chain,onOpen}:{item:Listing;currency:string;chain:string;onOpen:()=>void}){
  const details=useNftMetadata(item);
  const nft=details.nft;
  return <article className="market-listing">
    <button className={`market-listing-art ${nft?.imageUrl?"has-image":""}`} style={nft?.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined} onClick={onOpen}>
      {!nft?.imageUrl&&<><span>{chain} · ERC-721</span><strong>#{item.tokenId}</strong><i>{short(item.nftAddress)}</i></>}
    </button>
    <div>
      <small>{nft?.collection??short(item.nftAddress)}</small>
      <h2>{nft?.name??`Token #${item.tokenId}`}</h2>
      <div className="market-card-price"><span>PRICE</span><strong>{formatEther(BigInt(item.price))} {currency}</strong></div>
      <button onClick={onOpen}>Buy now <ArrowUpRight size={13}/></button>
    </div>
  </article>
}

function MarketNftDetail({listing,details,account,onClose,onBuy,onDelist}:{listing:Listing;details:{nft:WalletNft|null;loading:boolean;error:string};account?:`0x${string}`;onClose:()=>void;onBuy:()=>void;onDelist:()=>void}){const nft=details.nft;const chain=getMarketplaceChain(listing.chainId);const isSeller=!!account&&account.toLowerCase()===listing.seller.toLowerCase();return <div className="nft-detail-backdrop" role="dialog" aria-modal="true" aria-label="Listed NFT details" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><article className="nft-detail"><button className="nft-detail-close" onClick={onClose} aria-label="Close NFT details"><X size={18}/></button>{nft?.imageUrl?<div className="nft-detail-image" style={{backgroundImage:`url(${nft.imageUrl})`}}/>:<div className="nft-detail-image empty"/>}<div className="nft-detail-copy"><small>{nft?.collection??short(listing.nftAddress)} · {chain.name} · ERC-721</small><h2>{nft?.name??`Token #${listing.tokenId}`}</h2><p className="nft-token-id">#{listing.tokenId} · {short(listing.nftAddress)}</p>{details.loading&&<p className="nft-description">Loading verified metadata…</p>}{details.error&&<p className="nft-description">{details.error}</p>}{nft?.description&&<p className="nft-description">{nft.description}</p>}{nft&&nft.traits.length>0&&<section className="nft-traits"><span>TRAITS</span><div>{nft.traits.map(trait=><article key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></article>)}</div></section>}<div className="listing-price-panel"><span>LISTING PRICE</span><strong>{formatEther(BigInt(listing.price))} {chain.currency}</strong><small>Seller · {short(listing.seller)}</small></div><div className="nft-detail-actions">{isSeller?<button className="delist-button" onClick={onDelist}>Delist NFT <X size={15}/></button>:account?<button onClick={onBuy}>Buy now <ArrowUpRight size={15}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect to buy <Wallet size={15}/></button>}</ConnectButton.Custom>}{nft?.externalUrl&&<a href={nft.externalUrl} target="_blank" rel="noreferrer">Collection link <ExternalLink size={14}/></a>}<a href={tokenUrl(listing.chainId,listing.nftAddress,listing.tokenId)} target="_blank" rel="noreferrer">View on {chain.name} explorer <ExternalLink size={14}/></a></div></div></article></div>}
function ListingTile({item,action}:{item:Listing;action:React.ReactNode}){const chain=getMarketplaceChain(item.chainId);return <article className="portal-card"><div className="portal-token"><span>{chain.name} · ERC-721</span><strong>#{item.tokenId}</strong><i>{short(item.nftAddress)}</i></div><div className="portal-card-copy"><small>{short(item.nftAddress)}</small><h2>Token #{item.tokenId}</h2><p>Seller · {short(item.seller)}</p><div><span>Total price</span><strong>{formatEther(BigInt(item.price))} {chain.currency}</strong></div>{action}</div></article>}

function SellView({configured,connected,walletNfts,onList,chainId}:{configured:boolean;connected:boolean;walletNfts:{nfts:WalletNft[];loading:boolean;error:string};onList:(n:string,t:string,p:string)=>void;chainId:MarketplaceChainId}){
  const[nft,setNft]=useState("");const[token,setToken]=useState("");const[price,setPrice]=useState("");const[layout,setLayout]=useState<"grid"|"list">("grid");const[active,setActive]=useState<WalletNft|null>(null);
  const valid=/^0x[a-fA-F0-9]{40}$/.test(nft)&&/^\d+$/.test(token)&&Number(price)>0;const chain=getMarketplaceChain(chainId);
  function choose(item:WalletNft){setNft(item.contractAddress);setToken(item.tokenId);setActive(null);window.requestAnimationFrame(()=>document.getElementById("listing-price")?.focus());}
  return <><div className="sell-layout"><form onSubmit={e=>{e.preventDefault();if(valid)onList(nft,token,price)}}>{connected&&<section className="wallet-nfts"><div className="wallet-nfts-head"><div><span>YOUR {chain.name.toUpperCase()} NFTs</span><small>{walletNfts.loading?"Loading your wallet…":`${walletNfts.nfts.length} ERC-721 found`}</small></div><div className="layout-toggle" aria-label="NFT view"><button className={layout==="grid"?"active":""} type="button" onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={14}/></button><button className={layout==="list"?"active":""} type="button" onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div></div>{walletNfts.error?<p className="wallet-nfts-message">{walletNfts.error}</p>:walletNfts.loading?<p className="wallet-nfts-message">Reading your onchain holdings…</p>:walletNfts.nfts.length?<div className={`wallet-nft-grid ${layout}`}>{walletNfts.nfts.map(item=><button className="wallet-nft" type="button" key={`${item.contractAddress}:${item.tokenId}`} onClick={()=>setActive(item)}>{item.imageUrl?<span className="wallet-nft-image" style={{backgroundImage:`url(${item.imageUrl})`}}/>:<span className="wallet-nft-image empty"/>}<span>{item.collection??short(item.contractAddress)}</span><strong>{item.name??`Token #${item.tokenId}`}</strong><small>#{item.tokenId}</small></button>)}</div>:<p className="wallet-nfts-message">No ERC-721 NFTs found in this {chain.name} wallet.</p>}</section>}<div className="listing-fields"><label><span>NFT contract</span><input value={nft} onChange={e=>setNft(e.target.value)} placeholder="0x…"/></label><div className="field-row"><label><span>Token ID</span><input value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter token ID"/></label><label><span>Total price in {chain.currency}</span><input id="listing-price" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Enter amount"/></label></div></div>{connected?<button disabled={!configured||!valid}>{configured?"Approve & list":`Deploy on ${chain.name} first`} <ArrowUpRight/></button>:<ConnectButton.Custom>{({openConnectModal})=><button type="button" onClick={openConnectModal}>Connect wallet <Wallet/></button>}</ConnectButton.Custom>}</form><aside><span>SETTLEMENT TERMS · {chain.name.toUpperCase()}</span><h2>Your asset stays with you.</h2><p>Open a work to inspect its metadata, then set a {chain.currency} price and list it.</p><dl><div><dt>Marketplace fee</dt><dd>2%</dd></div><div><dt>Creator royalty</dt><dd>ERC-2981, if supported</dd></div><div><dt>Seller proceeds</dt><dd>Withdrawable in {chain.currency}</dd></div></dl></aside></div>{active&&<NftDetail item={active} chainId={chainId} onClose={()=>setActive(null)} onList={()=>choose(active)}/>}</>}

function NftDetail({item,chainId,onClose,onList}:{item:WalletNft;chainId:MarketplaceChainId;onClose:()=>void;onList:()=>void}){const chain=getMarketplaceChain(chainId);return <div className="nft-detail-backdrop" role="dialog" aria-modal="true" aria-label="NFT details" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><article className="nft-detail"><button className="nft-detail-close" onClick={onClose} aria-label="Close NFT details"><X size={18}/></button>{item.imageUrl?<div className="nft-detail-image" style={{backgroundImage:`url(${item.imageUrl})`}}/>:<div className="nft-detail-image empty"/>}<div className="nft-detail-copy"><small>{item.collection??short(item.contractAddress)} · {chain.name} · ERC-721</small><h2>{item.name??`Token #${item.tokenId}`}</h2><p className="nft-token-id">#{item.tokenId} · {short(item.contractAddress)}</p>{item.description&&<p className="nft-description">{item.description}</p>}{item.traits.length>0&&<section className="nft-traits"><span>TRAITS</span><div>{item.traits.map(trait=><article key={`${trait.type}:${trait.value}`}><small>{trait.type}</small><strong>{trait.value}</strong></article>)}</div></section>}<div className="nft-detail-actions"><button onClick={onList}>List this NFT <ArrowUpRight size={15}/></button>{item.externalUrl&&<a href={item.externalUrl} target="_blank" rel="noreferrer">Collection link <ExternalLink size={14}/></a>}<a href={tokenUrl(chainId,item.contractAddress,item.tokenId)} target="_blank" rel="noreferrer">View on {chain.name} explorer <ExternalLink size={14}/></a></div></div></article></div>}

function ActivityView({items,loading}:{items:Activity[];loading:boolean}){if(!items.length)return <Empty eyebrow={loading?"SYNCING":"NO EVENTS"} title={loading?"Reading confirmed blocks.":"No activity recorded."} detail="Contract events will appear here after confirmation."/>;return <div className="portal-activity">{items.map(x=>{const chain=getMarketplaceChain(x.chainId);return <a key={x.id} href={transactionUrl(x.chainId,x.transactionHash)} target="_blank" rel="noreferrer"><b>{x.eventType.toUpperCase()}</b><span>{x.nftAddress&&x.tokenId?`${short(x.nftAddress)} · #${x.tokenId}`:x.seller?short(x.seller):"Marketplace"}</span><span>{x.price?`${formatEther(BigInt(x.price))} ${chain.currency}`:"—"}</span><span>{chain.name} · Block {x.blockNumber}</span><ExternalLink size={14}/></a>})}</div>}

function AccountView({connected,configured,listings,proceeds,onCancel,onWithdraw,currency,walletNfts,chainId}:{connected:boolean;configured:boolean;listings:Listing[];proceeds:bigint;onCancel:(x:Listing)=>void;onWithdraw:()=>void;currency:string;walletNfts:{nfts:WalletNft[];loading:boolean;error:string};chainId:MarketplaceChainId}){
  const[layout,setLayout]=useState<"grid"|"list">("grid");
  const[active,setActive]=useState<WalletNft|null>(null);
  const chain=getMarketplaceChain(chainId);
  if(!connected)return <ConnectButton.Custom>{({openConnectModal})=><Empty eyebrow="WALLET REQUIRED" title="Connect to view your NFTs." detail="NFTs held by your wallet, active listings, and withdrawable proceeds will appear here for the selected network." action={<button onClick={openConnectModal}>Connect wallet <Wallet size={15}/></button>}/>}</ConnectButton.Custom>;
  return <>
    <section className="profile-wallet-section">
      <div className="wallet-nfts-head">
        <div><span>YOUR {chain.name.toUpperCase()} NFTs</span><small>{walletNfts.loading?"Loading your wallet…":`${walletNfts.nfts.length} ERC-721 found`}</small></div>
        <div className="layout-toggle" aria-label="NFT view"><button className={layout==="grid"?"active":""} type="button" onClick={()=>setLayout("grid")} aria-label="Grid view"><Grid2X2 size={14}/></button><button className={layout==="list"?"active":""} type="button" onClick={()=>setLayout("list")} aria-label="List view"><List size={16}/></button></div>
      </div>
      {walletNfts.error?<p className="wallet-nfts-message">{walletNfts.error}</p>:walletNfts.loading?<p className="wallet-nfts-message">Reading verified NFT holdings from the {chain.name} network…</p>:walletNfts.nfts.length?<div className={`wallet-nft-grid profile-nft-grid ${layout}`}>{walletNfts.nfts.map(item=><button className="wallet-nft" type="button" key={`${item.contractAddress}:${item.tokenId}`} onClick={()=>setActive(item)}>{item.imageUrl?<span className="wallet-nft-image" style={{backgroundImage:`url(${item.imageUrl})`}}/>:<span className="wallet-nft-image empty"/>}<span>{item.collection??short(item.contractAddress)}</span><strong>{item.name??`Token #${item.tokenId}`}</strong><small>#{item.tokenId}</small></button>)}</div>:<p className="account-empty">No ERC-721 NFTs were found in this wallet on {chain.name}. Switch networks beside Connect Wallet to check another chain.</p>}
    </section>
    <div className="account-balance"><span>WITHDRAWABLE PROCEEDS</span><strong>{formatEther(proceeds)} {currency}</strong><button disabled={!configured||proceeds===0n} onClick={onWithdraw}>Withdraw proceeds <ArrowUpRight/></button></div>
    <div className="account-section"><span className="section-no">ACTIVE LISTINGS</span>{listings.length?<div className="portal-grid account-grid">{listings.map(x=><ListingTile key={x.id} item={x} action={<button onClick={()=>onCancel(x)}>Cancel listing</button>}/>)}</div>:<p className="account-empty">You have no active listings on this network.</p>}</div>
    {active&&<NftDetail item={active} chainId={chainId} onClose={()=>setActive(null)} onList={()=>{window.location.href="/sell";}}/>}
  </>;
}

function ProtocolView(){return <div className="protocol-grid"><article><span>01</span><h2>Non-custodial</h2><p>Listed NFTs stay in the owner’s wallet. The marketplace transfers only after exact payment and valid approval.</p></article><article><span>02</span><h2>Fixed 2% fee</h2><p>The buyer pays the displayed listing price. Two percent is permanently credited to the House of Joshi treasury; the remainder goes to the seller after royalties.</p></article><article><span>03</span><h2>Creator royalties</h2><p>Collections implementing ERC-2981 receive royalties in the selected chain’s native settlement currency.</p></article><article><span>04</span><h2>Chain isolation</h2><p>Listings, proceeds, activity, and settlement remain isolated by network; assets and currencies are never silently mixed.</p></article></div>}

function Empty({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail:string;action?:React.ReactNode}){return <div className="portal-empty"><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p>{action}</div>}
