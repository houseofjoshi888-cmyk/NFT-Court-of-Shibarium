"use client";

import { ArrowUpRight, Check, ExternalLink, LoaderCircle, ShieldCheck, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type SellOffer={nft_offer_index:string;amount:string;owner:string};
type NativeNft={tokenId:string;issuer:string;taxon:number;serial:number|null;transferFee:number|null;transferable:boolean;name:string;description:string|null;imageUrl:string|null;traits:Array<{type:string;value:string}>;sellOffer:SellOffer|null;explorerUrl:string};
type XrplResponse={collection:{name:string;issuer:string;taxon:number;verifiedUrl?:string};nfts:NativeNft[];account?:string;error?:string};

const dropsToXrp=(drops:string)=>`${(Number(drops)/1_000_000).toLocaleString(undefined,{maximumFractionDigits:6})} XRP`;
function xrpToDrops(value:string){
  if(!/^\d+(\.\d{0,6})?$/.test(value)||Number(value)<=0)throw new Error("Enter a valid XRP price with up to 6 decimals.");
  const[whole,fraction=""]=value.split(".");
  return (BigInt(whole)*1_000_000n+BigInt(fraction.padEnd(6,"0"))).toString();
}

export function NativeXrplMarketplace(){
  const[featured,setFeatured]=useState<XrplResponse|null>(null);
  const[address,setAddress]=useState("");
  const[owned,setOwned]=useState<NativeNft[]>([]);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState("");
  const[status,setStatus]=useState("");

  const loadOwned=useCallback(async(account:string)=>{const response=await fetch(`/api/xrpl?account=${encodeURIComponent(account)}`,{cache:"no-store"});const body=await response.json() as XrplResponse;if(!response.ok)throw new Error(body.error??"Could not read XRPL NFTs.");setOwned(body.nfts);},[]);
  useEffect(()=>{let active=true;void fetch("/api/xrpl",{cache:"no-store"}).then(response=>response.json()).then(body=>{if(active)setFeatured(body as XrplResponse)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[]);

  async function connect(){
    setBusy("connect");setStatus("");
    try{
      const{default:sdk}=await import("@crossmarkio/sdk");
      if(!sdk.sync.isInstalled())throw new Error("Install the Crossmark browser wallet to connect to XRPL.");
      const result=await sdk.methods.signInAndWait();
      const account=result.response.data.address;
      setAddress(account);await loadOwned(account);setStatus("XRPL wallet connected.");
    }catch(error){setStatus(error instanceof Error?error.message:"Could not connect the XRPL wallet.");}finally{setBusy("");}
  }

  async function submit(transaction:Record<string,unknown>,key:string,message:string){
    if(!address)return;
    setBusy(key);setStatus("Confirm the XRPL transaction in Crossmark.");
    try{
      const{default:sdk}=await import("@crossmarkio/sdk");
      const result=await sdk.methods.signAndSubmitAndWait(transaction as never);
      const payload=result.response.data.resp as unknown as {result?:{hash?:string};hash?:string};
      const hash=payload.result?.hash??payload.hash;
      setStatus(hash?`${message} · ${hash.slice(0,8)}…${hash.slice(-6)}`:message);
      window.setTimeout(()=>void loadOwned(address),4_000);
    }catch(error){setStatus(error instanceof Error?error.message:"XRPL transaction was not completed.");}finally{setBusy("");}
  }

  async function list(nft:NativeNft,price:string){
    await submit({TransactionType:"NFTokenCreateOffer",Account:address,NFTokenID:nft.tokenId,Amount:xrpToDrops(price),Flags:1},nft.tokenId,"Sell offer submitted");
  }
  async function buy(nft:NativeNft){
    if(!nft.sellOffer)return;
    await submit({TransactionType:"NFTokenAcceptOffer",Account:address,NFTokenSellOffer:nft.sellOffer.nft_offer_index},nft.tokenId,"Purchase submitted");
  }

  return <main className="native-xrpl-page">
    <section className="native-xrpl-hero"><div><span>NATIVE XRP LEDGER · XLS-20</span><h1>Collect established XRPL works.</h1><p>Discover native collections and create on-ledger sell offers settled directly in XRP.</p></div><div className="native-xrpl-wallet">{address?<><small>CONNECTED WITH CROSSMARK</small><strong>{address.slice(0,8)}…{address.slice(-6)}</strong><button onClick={()=>{setAddress("");setOwned([])}}>Disconnect</button></>:<><small>NATIVE XRPL WALLET</small><button onClick={connect} disabled={busy==="connect"}>{busy==="connect"?<LoaderCircle className="spinning" size={16}/>:<Wallet size={16}/>} Connect Crossmark</button><a href="https://crossmark.io/" target="_blank" rel="noreferrer">Get Crossmark <ExternalLink size={12}/></a></>}</div></section>

    <section className="native-collection-heading"><div><span><ShieldCheck size={14}/> VERIFIED NATIVE COLLECTION</span><h2>Fuzzybears</h2><p>Original Fuzzybears on the XRP Ledger · Issuer {featured?.collection.issuer??"rw1R8cf…GYAs"} · Taxon 1</p></div><a href="https://xrpl.to/nfts/fuzzybears" target="_blank" rel="noreferrer">View complete live collection <ArrowUpRight size={14}/></a></section>
    <section className="native-nft-grid">{loading?<div className="native-xrpl-empty">Reading validated XRPL records…</div>:featured?.nfts.length?featured.nfts.map(nft=><NativeNftCard key={nft.tokenId} nft={nft} address={address} busy={busy} onBuy={buy}/>):<div className="native-xrpl-empty">The XRP Ledger data service is temporarily unavailable.</div>}</section>

    <section className="native-owned-section"><header><div><span>YOUR WALLET</span><h2>Your Fuzzybears</h2><p>Owned NFTs are read directly from the connected XRPL account.</p></div>{address&&<button onClick={()=>void loadOwned(address)}>Refresh wallet</button>}</header>{!address?<div className="native-xrpl-empty">Connect Crossmark to view and list your native XRPL NFTs.</div>:owned.length?<div className="native-nft-grid">{owned.map(nft=><OwnedNativeNft key={nft.tokenId} nft={nft} busy={busy} onList={list}/>)}</div>:<div className="native-xrpl-empty">No verified Fuzzybears were found in this wallet.</div>}</section>
    <section className="native-safety"><Check size={16}/><p>House of Joshi never receives your seed or private key. Crossmark signs the native XRPL transaction, and the offer is recorded on the public ledger.</p></section>
    {status&&<div className="toast" role="status"><ShieldCheck size={18}/><span>{status}</span><button onClick={()=>setStatus("")}><X size={16}/></button></div>}
  </main>;
}

function NativeNftCard({nft,address,busy,onBuy}:{nft:NativeNft;address:string;busy:string;onBuy:(nft:NativeNft)=>void}){
  return <article className="native-nft-card"><a href={`https://xrpl.to/nft/${nft.tokenId}`} target="_blank" rel="noreferrer" className="native-nft-art" style={nft.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}>{!nft.imageUrl&&<strong>XLS-20</strong>}<span>XRPL</span></a><div><small>FUZZYBEARS · #{nft.serial??nft.tokenId.slice(-6)}</small><h3>{nft.name}</h3>{nft.sellOffer?<><p><span>LOWEST SELL OFFER</span><strong>{dropsToXrp(nft.sellOffer.amount)}</strong></p><button onClick={()=>onBuy(nft)} disabled={!address||busy===nft.tokenId}>{busy===nft.tokenId?<LoaderCircle className="spinning" size={14}/>:address?"Buy on XRPL":"Connect to buy"}</button></>:<p><span>STATUS</span><strong>Not listed</strong></p>}</div></article>;
}

function OwnedNativeNft({nft,busy,onList}:{nft:NativeNft;busy:string;onList:(nft:NativeNft,price:string)=>void}){
  const[price,setPrice]=useState("");
  return <article className="native-nft-card"><a href={`https://xrpl.to/nft/${nft.tokenId}`} target="_blank" rel="noreferrer" className="native-nft-art" style={nft.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}>{!nft.imageUrl&&<strong>XLS-20</strong>}<span>OWNED</span></a><div><small>FUZZYBEARS · #{nft.serial??nft.tokenId.slice(-6)}</small><h3>{nft.name}</h3>{nft.sellOffer?<p><span>ACTIVE SELL OFFER</span><strong>{dropsToXrp(nft.sellOffer.amount)}</strong></p>:<label className="native-price"><span>PRICE IN XRP</span><input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="0.00"/><button onClick={()=>void onList(nft,price)} disabled={!price||busy===nft.tokenId}>{busy===nft.tokenId?<LoaderCircle className="spinning" size={14}/>:"List NFT"}</button></label>}</div></article>;
}
