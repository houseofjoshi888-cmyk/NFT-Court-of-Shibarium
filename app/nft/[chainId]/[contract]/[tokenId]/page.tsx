import { NftPage } from "../../../../nft-page";

export default async function Page({params,searchParams}:{params:Promise<{chainId:string;contract:string;tokenId:string}>;searchParams:Promise<{from?:string}>}){
  const value=await params;
  const query=await searchParams;
  return <NftPage chainId={Number(value.chainId)} contract={value.contract} tokenId={value.tokenId} returnTo={query.from==="profile"?"/profile":"/market"}/>;
}
