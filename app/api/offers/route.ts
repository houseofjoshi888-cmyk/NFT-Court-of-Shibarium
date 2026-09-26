import { env } from "@runtime-env";
import { erc721Abi, isAddress, type Address } from "viem";
import { isMarketplaceChainId } from "@/lib/marketplace-chains";
import { marketplaceAbi, type IndexedOffer } from "@/lib/marketplace-abi";
import { chainConfig, type RuntimeEnv } from "@/lib/server-marketplace-config";
import { indexClient, loadMarketplaceIndex, mapLimit, offerId } from "@/lib/marketplace-index";

export const dynamic="force-dynamic";
// Read-only discovery. Every mutation must be signed and confirmed on chain.
export async function GET(request:Request){
  const query=new URL(request.url).searchParams;
  const chainId=Number(query.get("chainId")),nft=query.get("nftAddress"),token=query.get("tokenId"),wallet=query.get("wallet");
  if(!isMarketplaceChainId(chainId)||(!wallet&&!nft)|| (wallet&&!isAddress(wallet,{strict:false})) || (nft&&(!isAddress(nft,{strict:false})||token===null||!/^\d+$/.test(token)||BigInt(token)>2n**256n-1n)) || (!nft&&token!==null))return Response.json({error:"Provide a supported chain and a valid wallet or NFT."},{status:400});
  const runtime=env as unknown as RuntimeEnv,config=chainConfig(runtime,chainId);
  if(config.chain.marketplaceStatus!=="live")return Response.json({error:`HOJ NFT Marketplace is coming soon on ${config.chain.name}.`,status:"coming-soon"},{status:503});
  if(!isAddress(config.address,{strict:false}))return Response.json({error:"Marketplace is not configured."},{status:503});
  const client=indexClient(config),address=config.address as Address;
  try{
    const code=await client.getBytecode({address});
    if(!code||code==="0x")return Response.json({error:"Marketplace is not deployed on this network."},{status:503});
    const [version,proceeds,block]=await Promise.all([
      client.readContract({address,abi:marketplaceAbi,functionName:"marketplaceVersion"}).catch(()=>0n),
      wallet?client.readContract({address,abi:marketplaceAbi,functionName:"getProceeds",args:[wallet as Address]}):Promise.resolve(0n),
      client.getBlock(),
    ]);
    const base={marketplaceAddress:address,version:Number(version),proceeds:proceeds.toString(),chainId,currency:config.chain.currency,now:Number(block.timestamp)};
    if(version<2n)return Response.json({...base,offers:[],warning:"Offers are not supported by this marketplace contract."},{headers:{"cache-control":"no-store"}});
    let warning:string|null=null,candidates:IndexedOffer[]=[];
    try{const index=await loadMarketplaceIndex(config,runtime.DB);candidates=index.offers;warning=index.syncError;}catch{warning="Offer discovery is temporarily unavailable. You can still recover your own offer by opening its NFT page.";}
    if(nft)candidates=candidates.filter(o=>o.nftAddress.toLowerCase()===nft.toLowerCase()&&o.tokenId===String(BigInt(token!)));
    // Directly recover the connected wallet's offer even when historical indexing is incomplete.
    if(nft&&wallet&&!candidates.some(o=>o.buyer.toLowerCase()===wallet.toLowerCase()))candidates.push({id:offerId(chainId,nft,token!,wallet),chainId,nftAddress:nft as Address,tokenId:token!,buyer:wallet as Address,amount:"0",expiresAt:0,status:"active",transactionHash:`0x${"0".repeat(64)}`,blockNumber:0});
    const checked=await mapLimit(candidates,6,async offer=>{
      const args=[offer.nftAddress,BigInt(offer.tokenId),offer.buyer] as const;
      const [current,owner]=await Promise.all([
        client.readContract({address,abi:marketplaceAbi,functionName:"getOffer",args}),
        client.readContract({address:offer.nftAddress,abi:erc721Abi,functionName:"ownerOf",args:[args[1]]}).catch(()=>undefined),
      ]);
      if(current.amount===0n)return null;
      if(!nft&&wallet&&offer.buyer.toLowerCase()!==wallet.toLowerCase()&&owner?.toLowerCase()!==wallet.toLowerCase())return null;
      return {...offer,amount:current.amount.toString(),expiresAt:Number(current.expiresAt),owner};
    });
    return Response.json({...base,offers:checked.filter(o=>o!==null),warning},{headers:{"cache-control":"no-store"}});
  }catch{return Response.json({error:"Could not verify offers on chain. Please retry."},{status:503,headers:{"cache-control":"no-store"}});}
}
const readOnly=()=>Response.json({error:"Offers must be signed and confirmed through the marketplace contract."},{status:405,headers:{Allow:"GET"}});
export const POST=readOnly;
export const PUT=readOnly;
