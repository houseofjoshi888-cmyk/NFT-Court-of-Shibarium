"use client";

import { Check, ExternalLink, LoaderCircle, ShieldCheck, Wallet, X } from "lucide-react";
import { useCallback, useState } from "react";
import { XRPL_MARKETPLACE_FEE_PERCENT } from "./config";

type SellOffer={nft_offer_index:string;amount:string;owner:string};
type NativeNft={tokenId:string;issuer:string|null;taxon:number|null;serial:number|null;transferFee:number|null;transferable:boolean;name:string;description:string|null;imageUrl:string|null;traits:Array<{type:string;value:string}>;sellOffer:SellOffer|null;explorerUrl:string};
type XrplResponse={nfts:NativeNft[];account?:string;error?:string};

const dropsToXrp=(drops:string)=>`${(Number(drops)/1_000_000).toLocaleString(undefined,{maximumFractionDigits:6})} XRP`;
function xrpToDrops(value:string){
  if(!/^\d+(\.\d{0,6})?$/.test(value)||Number(value)<=0)throw new Error("Enter a valid XRP price with up to 6 decimals.");
  const[whole,fraction=""]=value.split(".");
  return (BigInt(whole)*1_000_000n+BigInt(fraction.padEnd(6,"0"))).toString();
}

export function NativeXrplMarketplace(){
  const[address,setAddress]=useState("");
  const[owned,setOwned]=useState<NativeNft[]>([]);
  const[loading,setLoading]=useState(false);
  const[busy,setBusy]=useState("");
  const[status,setStatus]=useState("");

  const loadOwned=useCallback(async(account:string)=>{setLoading(true);try{const response=await fetch(`/api/xrpl?account=${encodeURIComponent(account)}`,{cache:"no-store"});const body=await response.json() as XrplResponse;if(!response.ok)throw new Error(body.error??"Could not read XRPL NFTs.");setOwned(body.nfts);}finally{setLoading(false)}},[]);

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
  return <main className="native-xrpl-page">
    <section className="native-xrpl-hero"><div><span>NATIVE XRP LEDGER · XLS-20</span><h1>List NFTs from your wallet.</h1><p>Connect your XRPL wallet, choose an NFT you own, and create an on-ledger sell offer settled directly in XRP.</p></div><div className="native-xrpl-wallet">{address?<><small>CONNECTED WITH CROSSMARK</small><strong>{address.slice(0,8)}…{address.slice(-6)}</strong><button onClick={()=>{setAddress("");setOwned([])}}>Disconnect</button></>:<><small>NATIVE XRPL WALLET</small><button onClick={connect} disabled={busy==="connect"}>{busy==="connect"?<LoaderCircle className="spinning" size={16}/>:<Wallet size={16}/>} Connect Crossmark</button><a href="https://crossmark.io/" target="_blank" rel="noreferrer">Get Crossmark <ExternalLink size={12}/></a></>}</div></section>

    <section className="native-owned-section"><header><div><span>YOUR WALLET</span><h2>Your XRPL NFTs</h2><p>All native XLS-20 NFTs are read directly from the connected wallet. The marketplace does not pre-add collections.</p></div>{address&&<button onClick={()=>void loadOwned(address)}>Refresh wallet</button>}</header>{!address?<div className="native-xrpl-empty">Connect Crossmark to view and list NFTs from your XRPL wallet.</div>:loading?<div className="native-xrpl-empty">Reading your validated XRPL records…</div>:owned.length?<div className="native-nft-grid">{owned.map(nft=><OwnedNativeNft key={nft.tokenId} nft={nft} busy={busy} onList={list}/>)}</div>:<div className="native-xrpl-empty">No native XLS-20 NFTs were found in this wallet.</div>}</section>
    <section className="native-safety"><Check size={16}/><p>House of Joshi never receives your seed or private key. Crossmark signs the native XRPL transaction, and the offer is recorded on the public ledger.</p></section>
    <section className="native-safety"><ShieldCheck size={16}/><p>XRPL marketplace fee: <strong>{XRPL_MARKETPLACE_FEE_PERCENT}%</strong>. The fee is collected only when the House of Joshi broker matches and settles a buy and sell offer.</p></section>
    {status&&<div className="toast" role="status"><ShieldCheck size={18}/><span>{status}</span><button onClick={()=>setStatus("")}><X size={16}/></button></div>}
  </main>;
}

function OwnedNativeNft({nft,busy,onList}:{nft:NativeNft;busy:string;onList:(nft:NativeNft,price:string)=>void}){
  const[price,setPrice]=useState("");
  return <article className="native-nft-card"><a href={`https://xrpl.to/nft/${nft.tokenId}`} target="_blank" rel="noreferrer" className="native-nft-art" style={nft.imageUrl?{backgroundImage:`url(${nft.imageUrl})`}:undefined}>{!nft.imageUrl&&<strong>XLS-20</strong>}<span>OWNED</span></a><div><small>XRPL · #{nft.serial??nft.tokenId.slice(-6)}</small><h3>{nft.name}</h3><p><span>ISSUER</span><strong title={nft.issuer??"Unknown"}>{nft.issuer?`${nft.issuer.slice(0,7)}…${nft.issuer.slice(-5)}`:"Unknown"}</strong></p>{nft.sellOffer?<p><span>ACTIVE SELL OFFER</span><strong>{dropsToXrp(nft.sellOffer.amount)}</strong></p>:<label className="native-price"><span>PRICE IN XRP</span><input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="0.00"/><button onClick={()=>void onList(nft,price)} disabled={!price||busy===nft.tokenId}>{busy===nft.tokenId?<LoaderCircle className="spinning" size={14}/>:"List NFT"}</button></label>}</div></article>;
}
