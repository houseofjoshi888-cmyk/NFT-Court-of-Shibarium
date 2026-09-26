"use client";

import { useState } from "react";
import { ShoppingCart, Tag, Wallet, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { erc1155Abi, formatEther, maxUint256, zeroAddress, type Address } from "viem";
import { marketplaceAbi, parseNativeAmount, type IndexedOffer } from "@/lib/marketplace-abi";
import { getMarketplaceChain, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { TransactionStatus, useMarketplaceTransaction } from "./use-marketplace-transaction";

type Edition={seller:Address;price:string;quantity?:string;tokenType?:string};
export function EditionTrading({chainId,market,nft,tokenId,listings,offers=[],onChanged}:{chainId:MarketplaceChainId;market:Address;nft:Address;tokenId:bigint;listings:Edition[];offers?:IndexedOffer[];onChanged:()=>void}){
  const {address}=useAccount(),client=usePublicClient({chainId}),tx=useMarketplaceTransaction(chainId);
  const chain=getMarketplaceChain(chainId);
  const [quantity,setQuantity]=useState("1"),[price,setPrice]=useState(""),[buyQuantity,setBuyQuantity]=useState("1");
  const [showListModal,setShowListModal]=useState(false);
  const [offerQuantity,setOfferQuantity]=useState("1"),[offerAmount,setOfferAmount]=useState("");
  const {data:version,isLoading:checkingVersion}=useReadContract({address:market,abi:marketplaceAbi,functionName:"marketplaceVersion",chainId});
  const supported=version!==undefined&&version>=4n;
  const balance=useReadContract({address:nft,abi:erc1155Abi,functionName:"balanceOf",args:[address??zeroAddress,tokenId],chainId,query:{enabled:!!address,refetchInterval:30_000}});
  const own=useReadContract({address:market,abi:marketplaceAbi,functionName:"getEditionListing",args:[nft,tokenId,address??zeroAddress],chainId,query:{enabled:!!address&&supported,refetchInterval:30_000}});
  const offerSupported=version!==undefined&&version>=5n;
  const ownOffer=useReadContract({address:market,abi:marketplaceAbi,functionName:"getEditionOffer",args:[nft,tokenId,address??zeroAddress],chainId,query:{enabled:!!address&&offerSupported,refetchInterval:30_000}});
  const proceeds=useReadContract({address:market,abi:marketplaceAbi,functionName:"getProceeds",args:[address??zeroAddress],chainId,query:{enabled:!!address,refetchInterval:30_000}});
  const available=listings.filter(item=>item.tokenType==="ERC-1155"&&item.seller.toLowerCase()!==address?.toLowerCase());
  const parseQuantity=(value:string)=>/^[1-9]\d{0,77}$/.test(value)&&BigInt(value)<=maxUint256?BigInt(value):0n;
  const units=parseQuantity(quantity);
  const purchaseUnits=parseQuantity(buyQuantity);
  const offeredUnits=parseQuantity(offerQuantity);
  let amount=0n;try{amount=parseNativeAmount(price);}catch{}
  let offerValue=0n;try{offerValue=parseNativeAmount(offerAmount);}catch{}
  function refresh(){void balance.refetch();void own.refetch();void ownOffer.refetch();void proceeds.refetch();onChanged();}
  async function list(){
    if(!address||!client||!supported||units<=0n||amount<=0n||units*amount>maxUint256)return;
    const ok=await tx.run(own.data?.quantity?"Edition listing update":"Edition listing",async send=>{
      const [held,approved]=await Promise.all([
        client.readContract({address:nft,abi:erc1155Abi,functionName:"balanceOf",args:[address,tokenId]}),
        client.readContract({address:nft,abi:erc1155Abi,functionName:"isApprovedForAll",args:[address,market]}),
      ]);
      if(units>held)throw new Error("You do not own enough editions for this quantity.");
      if(!approved)await send({address:nft,abi:erc1155Abi,functionName:"setApprovalForAll",args:[market,true]},"Collection approval");
      await send({address:market,abi:marketplaceAbi,functionName:"listEdition",args:[nft,tokenId,units,amount]});
    });if(ok){setShowListModal(false);refresh();}
  }
  async function cancel(){
    const ok=await tx.run("Edition cancellation",async send=>{await send({address:market,abi:marketplaceAbi,functionName:"cancelEdition",args:[nft,tokenId]});});if(ok)refresh();
  }
  async function buy(item:Edition){
    if(!supported||purchaseUnits<=0n||purchaseUnits>BigInt(item.quantity??"0")||purchaseUnits*BigInt(item.price)>maxUint256)return;
    const ok=await tx.run("Edition purchase",async send=>{await send({address:market,abi:marketplaceAbi,functionName:"buyEdition",args:[nft,tokenId,item.seller,purchaseUnits,BigInt(item.price)],value:purchaseUnits*BigInt(item.price)});});if(ok)refresh();
  }
  async function makeOffer(){
    if(!address||!client||!offerSupported||offeredUnits<=0n||offerValue<=0n)return;
    const ok=await tx.run("Edition offer",async send=>{
      const block=await client.getBlock();
      await send({address:market,abi:marketplaceAbi,functionName:"makeEditionOffer",args:[nft,tokenId,offeredUnits,block.timestamp+7n*86400n],value:offerValue});
    });if(ok){setOfferAmount("");refresh();}
  }
  async function cancelOffer(){
    const ok=await tx.run("Edition offer cancellation",async send=>{await send({address:market,abi:marketplaceAbi,functionName:"cancelEditionOffer",args:[nft,tokenId]});});if(ok)refresh();
  }
  async function acceptOffer(offer:IndexedOffer){
    if(!address||!client||!offerSupported||!offer.quantity)return;
    const offeredQuantity=BigInt(offer.quantity);
    const ok=await tx.run("Edition offer acceptance",async send=>{
      const [held,current,approved,block]=await Promise.all([
        client.readContract({address:nft,abi:erc1155Abi,functionName:"balanceOf",args:[address,tokenId]}),
        client.readContract({address:market,abi:marketplaceAbi,functionName:"getEditionOffer",args:[nft,tokenId,offer.buyer]}),
        client.readContract({address:nft,abi:erc1155Abi,functionName:"isApprovedForAll",args:[address,market]}),client.getBlock(),
      ]);
      if(current.amount!==BigInt(offer.amount)||current.quantity!==offeredQuantity||current.expiresAt<=block.timestamp)throw new Error("This offer changed or expired. Refresh before accepting.");
      if(held<current.quantity)throw new Error("You do not own enough editions to accept this offer.");
      if(!approved)await send({address:nft,abi:erc1155Abi,functionName:"setApprovalForAll",args:[market,true]},"Collection approval");
      const fresh=await client.readContract({address:market,abi:marketplaceAbi,functionName:"getEditionOffer",args:[nft,tokenId,offer.buyer]});
      if(fresh.amount!==current.amount||fresh.quantity!==current.quantity||fresh.expiresAt!==current.expiresAt)throw new Error("This offer changed. Refresh before accepting.");
      await send({address:market,abi:marketplaceAbi,functionName:"acceptEditionOffer",args:[nft,tokenId,offer.buyer]});
    });if(ok)refresh();
  }
  async function withdraw(){
    const ok=await tx.run("Withdrawal",async send=>{await send({address:market,abi:marketplaceAbi,functionName:"withdrawProceeds"});});if(ok)refresh();
  }
  return <section className="royal-nft-action-section edition-trading">
    {checkingVersion?<p>Checking marketplace support…</p>:!supported?<div className="royal-not-listed"><span>MARKETPLACE STATUS</span><strong>Edition trading is not available on {chain.name} yet.</strong></div>:<>
      {available.length>0?<div className="royal-current-price"><span>PRICE PER EDITION</span><strong>{formatEther(available.reduce((lowest,item)=>BigInt(item.price)<lowest?BigInt(item.price):lowest,BigInt(available[0].price)))} <small>{chain.currency}</small></strong></div>:<div className="royal-not-listed"><span>SALE STATUS</span><strong className="not-listed">Not listed</strong></div>}
      <p>{address?`You own ${balance.data?.toString()??"…"} edition${balance.data===1n?"":"s"} on ${chain.name}.`:"Connect your wallet to see your edition balance and list your work."}</p>
      <div className="royal-nft-actions">
        {address&&balance.data!==undefined&&balance.data>0n?<button disabled={tx.pending} onClick={()=>{if(own.data?.quantity){setQuantity(String(own.data.quantity));setPrice(formatEther(own.data.unitPrice));}setShowListModal(true);}}>{own.data?.quantity?"Change listing":"List for sale"} <Tag size={16}/></button>:!address?<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect wallet <Wallet size={16}/></button>}</ConnectButton.Custom>:null}
        {!!own.data?.quantity&&<button className="royal-secondary-action" disabled={tx.pending} onClick={()=>void cancel()}>Cancel listing</button>}
      </div>
      {!!own.data?.quantity&&<p>Your listing: {String(own.data.quantity)} edition{own.data.quantity===1n?"":"s"} at {formatEther(own.data.unitPrice)} {chain.currency} each.</p>}
      {available.length>0?<div className="edition-available"><label>Quantity to buy<input inputMode="numeric" value={buyQuantity} onChange={event=>setBuyQuantity(event.target.value)}/></label>{available.map(item=><div className="edition-offer" key={item.seller}>
        <p>{item.seller.slice(0,6)}…{item.seller.slice(-4)} · {item.quantity} available<br/>{formatEther(BigInt(item.price))} {chain.currency} per edition</p>
        {address?<button disabled={tx.pending||purchaseUnits<=0n||purchaseUnits>BigInt(item.quantity??"0")} onClick={()=>void buy(item)}>Buy now · {formatEther(purchaseUnits*BigInt(item.price))} {chain.currency} <ShoppingCart size={15}/></button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect to buy</button>}</ConnectButton.Custom>}
      </div>)}</div>:<p>No editions from other sellers are currently listed.</p>}
      {offerSupported&&<div className="edition-offer-controls"><h3>Offers for this edition</h3><p>Offers deposit {chain.currency}. The offer is for a total price and expires in seven days.</p>
        {!!address&&<form onSubmit={event=>{event.preventDefault();void makeOffer();}}><label>Quantity to offer for<input inputMode="numeric" value={offerQuantity} onChange={event=>setOfferQuantity(event.target.value)}/></label><label>Total offer ({chain.currency})<input inputMode="decimal" value={offerAmount} onChange={event=>setOfferAmount(event.target.value)}/></label><button disabled={tx.pending||offeredUnits<=0n||offerValue<=0n}>Deposit and make offer</button></form>}
        {!!ownOffer.data?.amount&&ownOffer.data.amount>0n&&<div className="edition-offer"><p>Your funded offer: {String(ownOffer.data.quantity)} editions for {formatEther(ownOffer.data.amount)} {chain.currency} total.</p><button disabled={tx.pending} onClick={()=>void cancelOffer()}>Cancel offer</button></div>}
        {offers.filter(offer=>offer.tokenType==="ERC-1155"&&offer.buyer.toLowerCase()!==address?.toLowerCase()).map(offer=><div className="edition-offer" key={offer.id}><p>{offer.quantity} editions · {formatEther(BigInt(offer.amount))} {chain.currency} total · from {offer.buyer.slice(0,6)}…{offer.buyer.slice(-4)}</p>{address&&balance.data!==undefined&&balance.data>=BigInt(offer.quantity??"0")&&<button disabled={tx.pending} onClick={()=>void acceptOffer(offer)}>Accept offer</button>}</div>)}
        {!!proceeds.data&&proceeds.data>0n&&<div className="edition-offer"><p>Withdrawable proceeds or refunds: {formatEther(proceeds.data)} {chain.currency}</p><button disabled={tx.pending} onClick={()=>void withdraw()}>Withdraw</button></div>}
      </div>}
    </>}
    {showListModal&&<div className="royal-modal-overlay" onClick={()=>{if(!tx.pending)setShowListModal(false);}}>
      <div className="royal-modal royal-listing-modal" role="dialog" aria-modal="true" aria-labelledby="edition-list-title" onClick={event=>event.stopPropagation()}>
        <header><h2 id="edition-list-title">{own.data?.quantity?"Change edition listing":"Create edition listing"}</h2><button type="button" disabled={tx.pending} onClick={()=>setShowListModal(false)} aria-label="Close listing dialog"><X size={20}/></button></header>
        <form className="royal-modal-content edition-list-form" onSubmit={event=>{event.preventDefault();void list();}}>
          <p>You own {balance.data?.toString()??"…"} editions. Set a quantity and price per edition.</p>
          <label>Quantity to list<input inputMode="numeric" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
          <label>Price per edition ({chain.currency})<input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)}/></label>
          <div className="royal-fee-info"><div className="royal-fee-row"><span>Total if all sell</span><strong>{formatEther(units*amount)} {chain.currency}</strong></div><div className="royal-fee-row"><span>Marketplace fee on sale</span><strong>2% plus applicable creator royalties</strong></div></div>
          <div className="royal-modal-actions"><button type="button" disabled={tx.pending} onClick={()=>setShowListModal(false)}>Cancel</button><button className="royal-primary" disabled={tx.pending||units<=0n||units>(balance.data??0n)||amount<=0n||units*amount>maxUint256}>{tx.pending?"Confirming…":own.data?.quantity?"Update listing":"Approve & list"}</button></div>
        </form>
      </div>
    </div>}
    <TransactionStatus transaction={tx}/>
  </section>;
}
