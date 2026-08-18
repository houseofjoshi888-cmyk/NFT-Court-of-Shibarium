import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Ripple's public full-history cluster includes Clio's NFT lookup methods.
const XRPL_RPC = "https://s2.ripple.com:51234/";
const FUZZYBEARS_ISSUER = "rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs";
const FUZZYBEARS_TAXON = 1;
const FEATURED_FUZZYBEARS = [
  "00080BB86C429EE66CE731CAA492445DFF564F9CB8A46A306F25CBAF05A83F13",
  "00080BB86C429EE66CE731CAA492445DFF564F9CB8A46A305B4218E205A84748",
  "00080BB86C429EE66CE731CAA492445DFF564F9CB8A46A30652FD0B805A8491E",
  "00080BB86C429EE66CE731CAA492445DFF564F9CB8A46A30B8CE1A9D05A84001",
] as const;

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
type NftInfo = { nft_id:string; uri?:string; issuer:string; nft_taxon:number; transfer_fee?:number; flags:number; nft_serial?:number };

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
    issuer:nft.Issuer??FUZZYBEARS_ISSUER,
    taxon:nft.NFTokenTaxon??FUZZYBEARS_TAXON,
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

async function featured(){
  const results=await Promise.allSettled(FEATURED_FUZZYBEARS.map(tokenId=>rpc<NftInfo>("nft_info",{nft_id:tokenId}).then(result=>enrich({NFTokenID:result.nft_id,URI:result.uri,Issuer:result.issuer,NFTokenTaxon:result.nft_taxon,TransferFee:result.transfer_fee,Flags:result.flags,nft_serial:result.nft_serial}))));
  return results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
}

export async function GET(request:NextRequest){
  const account=request.nextUrl.searchParams.get("account");
  try{
    if(!account)return NextResponse.json({network:"XRPL Mainnet",collection:{name:"Fuzzybears",issuer:FUZZYBEARS_ISSUER,taxon:FUZZYBEARS_TAXON,verifiedUrl:"https://xrpl.to/nfts/fuzzybears"},nfts:await featured()},{headers:{"cache-control":"no-store"}});
    if(!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account))return NextResponse.json({error:"Enter a valid XRPL classic address."},{status:400});
    const result=await rpc<{account_nfts?:XrplNft[]}>("account_nfts",{account,limit:100});
    const owned=(result.account_nfts??[]).filter(nft=>nft.Issuer===FUZZYBEARS_ISSUER&&nft.NFTokenTaxon===FUZZYBEARS_TAXON);
    return NextResponse.json({network:"XRPL Mainnet",account,collection:{name:"Fuzzybears",issuer:FUZZYBEARS_ISSUER,taxon:FUZZYBEARS_TAXON},nfts:await Promise.all(owned.slice(0,32).map(enrich))},{headers:{"cache-control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"XRPL is temporarily unavailable."},{status:502});}
}
