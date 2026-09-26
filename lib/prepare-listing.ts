import { erc721Abi, type Address, type PublicClient } from "viem";
import { marketplaceAbi } from "./marketplace-abi";

export async function inspectListing(client:PublicClient,market:Address,nft:Address,token:bigint,account:Address){
  const [owner,listing,approved,all]=await Promise.all([
    client.readContract({address:nft,abi:erc721Abi,functionName:"ownerOf",args:[token]}),
    client.readContract({address:market,abi:marketplaceAbi,functionName:"getListing",args:[nft,token]}),
    client.readContract({address:nft,abi:erc721Abi,functionName:"getApproved",args:[token]}),
    client.readContract({address:nft,abi:erc721Abi,functionName:"isApprovedForAll",args:[account,market]}),
  ]);
  if(owner.toLowerCase()!==account.toLowerCase())throw new Error("Only the current owner can list this NFT.");
  if(listing.price>0n){
    if(listing.seller.toLowerCase()===account.toLowerCase())throw new Error("This NFT already has a listing. Cancel it before changing the price.");
    const version=await client.readContract({address:market,abi:marketplaceAbi,functionName:"marketplaceVersion"}).catch(()=>0n);
    if(version<3n)throw new Error("This older marketplace has a stale listing from the previous owner. The previous seller must cancel it, or this network must move to the updated marketplace.");
  }
  return {needsApproval:!all&&approved.toLowerCase()!==market.toLowerCase()};
}
