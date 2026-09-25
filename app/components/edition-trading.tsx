"use client";

import { useState } from "react";
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
    });if(ok)refresh();
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
    <h2>Edition marketplace</h2>
    <p>{address?`You own ${balance.data?.toString()??"…"} editions on ${chain.name}.`:"Connect your wallet to see your edition balance."}</p>
    {checkingVersion?<p>Checking marketplace support…</p>:!supported?<p>Edition trading is not available on this network’s marketplace yet.</p>:<>
      {!!address&&!!balance.data&&<form onSubmit={event=>{event.preventDefault();void list();}}>
        <label>Quantity to list<input inputMode="numeric" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
        <label>Price per edition ({chain.currency})<input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)}/></label>
        <p>Total if all sell: {formatEther(units*amount)} {chain.currency}. Marketplace fee: 2%, plus applicable creator royalties.</p>
        <button disabled={tx.pending||units<=0n||units>(balance.data??0n)||amount<=0n}>{own.data?.quantity?"Update listing":"List editions"}</button>
      </form>}
      {!!own.data?.quantity&&<div><p>Your listing: {String(own.data.quantity)} editions at {formatEther(own.data.unitPrice)} {chain.currency} each.</p><button disabled={tx.pending} onClick={()=>void cancel()}>Cancel your listing</button></div>}
      {available.length>0?<><label>Quantity to buy<input inputMode="numeric" value={buyQuantity} onChange={event=>setBuyQuantity(event.target.value)}/></label>{available.map(item=><div className="edition-offer" key={item.seller}>
        <p>{item.seller.slice(0,6)}…{item.seller.slice(-4)} · {item.quantity} available<br/>{formatEther(BigInt(item.price))} {chain.currency} per edition</p>
        {address?<button disabled={tx.pending||purchaseUnits<=0n||purchaseUnits>BigInt(item.quantity??"0")} onClick={()=>void buy(item)}>Buy {purchaseUnits.toString()} · {formatEther(purchaseUnits*BigInt(item.price))} {chain.currency}</button>:<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect to buy</button>}</ConnectButton.Custom>}
      </div>)}</>:<p>No editions from other sellers are currently listed.</p>}
      {offerSupported&&<div className="edition-offer-controls"><h3>Offers for this edition</h3><p>Offers deposit {chain.currency}. The offer is for a total price and expires in seven days.</p>
        {!!address&&<form onSubmit={event=>{event.preventDefault();void makeOffer();}}><label>Quantity to offer for<input inputMode="numeric" value={offerQuantity} onChange={event=>setOfferQuantity(event.target.value)}/></label><label>Total offer ({chain.currency})<input inputMode="decimal" value={offerAmount} onChange={event=>setOfferAmount(event.target.value)}/></label><button disabled={tx.pending||offeredUnits<=0n||offerValue<=0n}>Deposit and make offer</button></form>}
        {!!ownOffer.data?.amount&&ownOffer.data.amount>0n&&<div className="edition-offer"><p>Your funded offer: {String(ownOffer.data.quantity)} editions for {formatEther(ownOffer.data.amount)} {chain.currency} total.</p><button disabled={tx.pending} onClick={()=>void cancelOffer()}>Cancel offer</button></div>}
        {offers.filter(offer=>offer.tokenType==="ERC-1155"&&offer.buyer.toLowerCase()!==address?.toLowerCase()).map(offer=><div className="edition-offer" key={offer.id}><p>{offer.quantity} editions · {formatEther(BigInt(offer.amount))} {chain.currency} total · from {offer.buyer.slice(0,6)}…{offer.buyer.slice(-4)}</p>{address&&balance.data!==undefined&&balance.data>=BigInt(offer.quantity??"0")&&<button disabled={tx.pending} onClick={()=>void acceptOffer(offer)}>Accept offer</button>}</div>)}
        {!!proceeds.data&&proceeds.data>0n&&<div className="edition-offer"><p>Withdrawable proceeds or refunds: {formatEther(proceeds.data)} {chain.currency}</p><button disabled={tx.pending} onClick={()=>void withdraw()}>Withdraw</button></div>}
      </div>}
    </>}
    {!address&&<ConnectButton.Custom>{({openConnectModal})=><button onClick={openConnectModal}>Connect wallet</button>}</ConnectButton.Custom>}
    <TransactionStatus transaction={tx}/>
  </section>;
}
