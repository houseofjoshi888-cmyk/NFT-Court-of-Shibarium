"use client";

import { useEffect, useRef, useState } from "react";
import { getAccount } from "@wagmi/core";
import { useAccount, useConfig, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { type Abi, type Address, type Hash, type TransactionReceipt, type PublicClient } from "viem";
import { confirmedReceipt } from "@/lib/transaction-receipt";
import { transactionError } from "@/lib/transaction-errors";
import { getMarketplaceChain, isMarketplaceLive, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";

type Request={address:Address;abi:Abi;functionName:string;args?:readonly unknown[];value?:bigint};
type Send=(request:Request,label?:string)=>Promise<TransactionReceipt>;
const active=new Set<string>();
type Outstanding={hash:Hash;key:string;chainId:MarketplaceChainId;client:Pick<PublicClient,"waitForTransactionReceipt">};
const outstandingTransactions=new Map<string,Outstanding>();
const notify=()=>window.dispatchEvent(new Event("marketplace-transaction-change"));
function persist(key:string,hash?:Hash){try{if(hash)sessionStorage.setItem(`hoj:pending:${key}`,hash);else sessionStorage.removeItem(`hoj:pending:${key}`);}catch{}}
export function useMarketplaceTransaction(chainId:MarketplaceChainId){
  const {address}=useAccount(),config=useConfig();
  const client=usePublicClient({chainId});
  const {switchChainAsync}=useSwitchChain(),{writeContractAsync}=useWriteContract();
  const [pending,setPending]=useState(false),[message,setMessage]=useState(""),[hash,setHash]=useState<Hash>();
  const [uncertain,setUncertain]=useState(false);
  const busy=useRef(false),unresolved=useRef<Outstanding|null>(null);
  const [transactionChain,setTransactionChain]=useState(chainId);
  useEffect(()=>{
    const sync=()=>{
      const key=`${chainId}:${address?.toLowerCase()}`;
      if(address&&client&&!outstandingTransactions.has(key)&&!active.has(key)){
        try{const stored=sessionStorage.getItem(`hoj:pending:${key}`);if(stored&&/^0x[0-9a-f]{64}$/i.test(stored)){outstandingTransactions.set(key,{hash:stored as Hash,key,chainId,client});active.add(key);}}catch{}
      }
      const saved=outstandingTransactions.get(key);
      if(saved){unresolved.current=saved;busy.current=true;setHash(saved.hash);setTransactionChain(saved.chainId);setUncertain(true);setMessage("A previous transaction still needs confirmation. Check it before continuing.");}
      else if(unresolved.current){unresolved.current=null;busy.current=false;setUncertain(false);}
    };
    sync();window.addEventListener("marketplace-transaction-change",sync);
    return()=>window.removeEventListener("marketplace-transaction-change",sync);
  },[address,chainId,client]);
  async function run(label:string,job:(send:Send)=>Promise<void>){
    if(!isMarketplaceLive(chainId)){setMessage(`HOJ NFT Marketplace is coming soon on ${getMarketplaceChain(chainId).name}.`);return false;}
    if(busy.current)return false;
    if(!address||!client){setMessage("Connect your wallet to continue.");return false;}
    const account=address,key=`${chainId}:${account.toLowerCase()}`;
    if(active.has(key)){setMessage("Finish the pending transaction before starting another action.");return false;}
    active.add(key);setTransactionChain(chainId);busy.current=true;setPending(true);setHash(undefined);setUncertain(false);
    let waiting:Hash|undefined;
    try{
      setMessage(`Preparing ${label.toLowerCase()}…`);
      if(getAccount(config).chainId!==chainId)await switchChainAsync({chainId});
      const send:Send=async(request,step=label)=>{
        const current=getAccount(config);
        if(current.address?.toLowerCase()!==account.toLowerCase()||current.chainId!==chainId)throw new Error("Wallet or network changed. Start again with the intended wallet and network.");
        setMessage(`Checking ${step.toLowerCase()}…`);
        await client.simulateContract({...request,account});
        if(getAccount(config).address?.toLowerCase()!==account.toLowerCase()||getAccount(config).chainId!==chainId)throw new Error("Wallet or network changed. Please try again.");
        setMessage(`Confirm ${step.toLowerCase()} in your wallet.`);
        const submitted=await writeContractAsync({...request,account,chainId});
        waiting=submitted;persist(key,submitted);setHash(submitted);setMessage(`${step} submitted. Waiting for confirmation…`);
        const receipt=await confirmedReceipt(client,submitted,replacement=>{waiting=replacement;persist(key,replacement);setHash(replacement);});
        waiting=undefined;persist(key);setMessage(`${step} confirmed. Updating marketplace…`);
        return receipt;
      };
      await job(send);
      setMessage(`${label} confirmed. Marketplace history may take a little longer to update.`);
      return true;
    }catch(error){
      const text=error instanceof Error?error.message.split("\n")[0]:"Transaction could not be completed.";
      // A receipt timeout/RPC failure is not proof of an onchain failure.
      if(waiting&&!/failed on chain|canceled or replaced/.test(text)){
        unresolved.current={hash:waiting,key,chainId,client};outstandingTransactions.set(key,unresolved.current);setUncertain(true);notify();
        setMessage("Confirmation is not available yet. Check the transaction before trying again.");
      }else {persist(key);setMessage(transactionError(error));}
      return false;
    }finally{
      setPending(false);
      if(!unresolved.current){active.delete(key);busy.current=false;}
    }
  }
  async function check(){
    const outstanding=unresolved.current;if(!outstanding||pending)return;
    setPending(true);
    try{
      await confirmedReceipt(outstanding.client,outstanding.hash,replacement=>{outstanding.hash=replacement;persist(outstanding.key,replacement);setHash(replacement);});
      persist(outstanding.key);
      setMessage("Transaction confirmed. Refresh this page to see its result; any remaining step can now be continued.");
      active.delete(outstanding.key);outstandingTransactions.delete(outstanding.key);notify();unresolved.current=null;busy.current=false;setUncertain(false);
    }catch(error){
      const text=error instanceof Error?error.message:"Confirmation unavailable.";
      setMessage(transactionError(error));
      if(/failed on chain|canceled or replaced/.test(text)){persist(outstanding.key);active.delete(outstanding.key);outstandingTransactions.delete(outstanding.key);notify();unresolved.current=null;busy.current=false;setUncertain(false);}
    }finally{setPending(false);}
  }
  return {run,pending:pending||uncertain,message,hash,uncertain,check,chainId:transactionChain};
}
export function TransactionStatus({transaction}:{transaction:ReturnType<typeof useMarketplaceTransaction>}){
  if(!transaction.message)return null;
  return <div className="royal-transaction-status" role="status" aria-live="polite">
    <span>{transaction.message}</span>
    {transaction.hash&&<a href={transactionUrl(transaction.chainId,transaction.hash)} target="_blank" rel="noreferrer">View transaction ↗</a>}
    {transaction.uncertain&&<button type="button" onClick={()=>void transaction.check()}>Check confirmation</button>}
  </div>;
}
