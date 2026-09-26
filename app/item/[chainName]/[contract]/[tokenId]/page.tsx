import { redirect } from 'next/navigation';
import { marketplaceChains } from '@/lib/marketplace-chains';

// Map chain names to chain IDs
const chainNameToId: Record<string, number> = {
  'ethereum': 1,
  'eth': 1,
  'shibarium': 109,
  'shib': 109,
  'cronos': 25,
  'cro': 25,
  'polygon': 137,
  'matic': 137,
  'base': 8453,
  'arc': 5042,
  'robinhood': 4663,
  'robin': 4663,
  'zora': 7777777,
  'apechain': 33139,
  'ape': 33139,
};

export default async function OpenSeaStyleItemPage({
  params,
}: {
  params: Promise<{ chainName: string; contract: string; tokenId: string }>;
}) {
  const value = await params;
  
  // Convert chain name to chain ID
  const chainId = chainNameToId[value.chainName.toLowerCase()];
  
  if (!chainId) {
    return redirect('/404');
  }
  
  // Redirect to our internal NFT page structure
  return redirect(`/nft/${chainId}/${value.contract}/${value.tokenId}`);
}
