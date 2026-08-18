import { NextRequest, NextResponse } from "next/server";
import { XRPL_BROKER_ADDRESS, XRPL_MARKETPLACE_FEE_BPS } from "../../xrpl/config";

export const dynamic = "force-dynamic";

// Ripple's public full-history cluster includes Clio's NFT lookup methods.
const XRPL_RPC = "https://s2.ripple.com:51234/";
type XrplNft = {
  NFTokenID:string;
  URI?:string;
  Issuer?:string;
  NFTokenTaxon?:number;
  TransferFee?:number;
  Flags?:number;
  nft_serial?:number;
};

type SellOffer = { nft_offer_index:string; amount:string; owner:string; destination?:string; expiration?:number };
async function rpc<T>(method:string, params:Record<string,unknown>):Promise<T>{
  const response=await fetch(XRPL_RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({method,params:[{...params,ledger_index:"validated",api_version:2}]}),cache:"no-store"});
  if(!response.ok)throw new Error("XRPL request failed");
  const body=await response.json() as {result:T&{error?:string;error_message?:string}};
  if(body.result.error)throw new Error(body.result.error_message??body.result.error);
  return body.result;
}

function decodeUri(value:string|undefined){
  if(!value)return null;
  try{return Buffer.from(value,"hex").toString("utf8");}catch{return null;}
}

function publicUri(value:string|null){
  if(!value)return null;
  if(value.startsWith("ipfs://"))return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if(value.startsWith("https://"))return value;
  return null;
}

function metadataImage(value:unknown){
  if(typeof value!=="string")return null;
  return publicUri(value);
}

async function enrich(nft:XrplNft){
  const uri=decodeUri(nft.URI);
  let metadata:{name?:string;description?:string;image?:string;image_url?:string;attributes?:Array<{trait_type?:string;value?:unknown}>}|null=null;
  const url=publicUri(uri);
  if(url){
    try{const response=await fetch(url,{headers:{accept:"application/json"},next:{revalidate:300}});if(response.ok)metadata=await response.json();}catch{}
  }
  let offers:SellOffer[]=[];
  try{const result=await rpc<{offers?:SellOffer[]}>("nft_sell_offers",{nft_id:nft.NFTokenID});offers=result.offers??[];}catch{}
  const lowest=offers.filter(offer=>/^\d+$/.test(offer.amount)&&!offer.destination).sort((a,b)=>BigInt(a.amount)<BigInt(b.amount)?-1:1)[0]??null;
  return {
    tokenId:nft.NFTokenID,
    issuer:nft.Issuer??null,
    taxon:nft.NFTokenTaxon??null,
    serial:nft.nft_serial??null,
    transferFee:nft.TransferFee??null,
    transferable:!!((nft.Flags??0)&8),
    uri,
    name:metadata?.name??`XRPL NFT ${nft.NFTokenID.slice(-6)}`,
    description:metadata?.description??null,
    imageUrl:metadataImage(metadata?.image??metadata?.image_url),
    traits:(metadata?.attributes??[]).flatMap(attribute=>attribute.trait_type&&attribute.value!==undefined?[{type:attribute.trait_type,value:String(attribute.value)}]:[]),
    sellOffer:lowest,
    explorerUrl:`https://livenet.xrpl.org/nft/${nft.NFTokenID}`,
  };
}

export async function GET(request:NextRequest){
  const account=request.nextUrl.searchParams.get("account");
  try{
    if(!account)return NextResponse.json({network:"XRPL Mainnet",broker:{address:XRPL_BROKER_ADDRESS,feeBps:XRPL_MARKETPLACE_FEE_BPS},nfts:[]},{headers:{"cache-control":"no-store"}});
    if(!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account))return NextResponse.json({error:"Enter a valid XRPL classic address."},{status:400});
    const result=await rpc<{account_nfts?:XrplNft[]}>("account_nfts",{account,limit:100});
    return NextResponse.json({network:"XRPL Mainnet",account,broker:{address:XRPL_BROKER_ADDRESS,feeBps:XRPL_MARKETPLACE_FEE_BPS},nfts:await Promise.all((result.account_nfts??[]).slice(0,64).map(enrich))},{headers:{"cache-control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"XRPL is temporarily unavailable."},{status:502});}
}
