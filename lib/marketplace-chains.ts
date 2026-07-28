export const marketplaceChains = {
  109: {
    id: 109,
    slug: "shibarium",
    name: "Shibarium",
    currency: "BONE",
    explorerUrl: "https://shibariumscan.io",
    explorerApiUrl: "https://shibariumscan.io/api/v2",
    rpcUrl: "https://rpc.shibarium.shib.io",
    confirmations: 12,
  },
  137: {
    id: 137,
    slug: "polygon",
    name: "Polygon",
    currency: "POL",
    explorerUrl: "https://polygonscan.com",
    explorerApiUrl: "https://polygon.blockscout.com/api/v2",
    rpcUrl: "https://polygon-rpc.com",
    confirmations: 128,
  },
  8453: {
    id: 8453,
    slug: "base",
    name: "Base",
    currency: "ETH",
    explorerUrl: "https://basescan.org",
    explorerApiUrl: "https://base.blockscout.com/api/v2",
    rpcUrl: "https://mainnet.base.org",
    confirmations: 12,
  },
  4663: {
    id: 4663,
    slug: "robinhood",
    name: "Robinhood",
    currency: "ETH",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    explorerApiUrl: "https://robinhoodchain.blockscout.com/api/v2",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    confirmations: 12,
  },
} as const;

export type MarketplaceChainId = keyof typeof marketplaceChains;
export type MarketplaceChain = (typeof marketplaceChains)[MarketplaceChainId];

export function isMarketplaceChainId(value: number): value is MarketplaceChainId {
  return value in marketplaceChains;
}

export function getMarketplaceChain(value: number | string | null | undefined): MarketplaceChain {
  const parsed = Number(value);
  return isMarketplaceChainId(parsed) ? marketplaceChains[parsed] : marketplaceChains[109];
}

export function transactionUrl(chainId: MarketplaceChainId, hash: string) {
  return `${marketplaceChains[chainId].explorerUrl}/tx/${hash}`;
}

export function tokenUrl(chainId: MarketplaceChainId, address: string, tokenId: string) {
  const chain = marketplaceChains[chainId];
  if (chainId === 109 || chainId === 4663) return `${chain.explorerUrl}/token/${address}/instance/${tokenId}`;
  return `${chain.explorerUrl}/token/${address}?a=${tokenId}`;
}
