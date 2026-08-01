import { NftPage } from "../../../../nft-page";

export default async function Page({params}:{params:Promise<{chainId:string;contract:string;tokenId:string}>}){
  const value=await params;
  return <NftPage chainId={Number(value.chainId)} contract={value.contract} tokenId={value.tokenId}/>;
}
