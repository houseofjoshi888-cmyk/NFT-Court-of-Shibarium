export const marketplaceChains = {
  1: {
    id: 1,
    slug: "ethereum",
    name: "Ethereum",
    currency: "ETH",
    explorerUrl: "https://etherscan.io",
    explorerApiUrl: "https://eth.blockscout.com/api/v2",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    confirmations: 12,
    marketplaceAddress: "0x6acaf964bcf4551cc55afaf12d6e6a8ef7138875",
    marketplaceDeployBlock: 25652658,
    marketplaceStatus: "coming-soon",
  },
  25: {
    id: 25,
    slug: "cronos",
    name: "Cronos",
    currency: "CRO",
    explorerUrl: "https://explorer.cronos.com",
    explorerApiUrl: "",
    rpcUrl: "https://evm.cronos.org",
    confirmations: 12,
    marketplaceAddress: "0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab",
    marketplaceDeployBlock: 95919348,
    marketplaceStatus: "live",
  },
  109: {
    id: 109,
    slug: "shibarium",
    name: "Shibarium",
    currency: "BONE",
    explorerUrl: "https://shibariumscan.io",
    explorerApiUrl: "https://shibariumscan.io/api/v2",
    rpcUrl: "https://rpc.shibarium.shib.io",
    confirmations: 12,
    marketplaceAddress: "0x455DaD76334a67660D61bb319d8CfF1010e33049",
    marketplaceDeployBlock: 19143354,
    marketplaceStatus: "live",
  },
  137: {
    id: 137,
    slug: "polygon",
    name: "Polygon",
    currency: "POL",
    explorerUrl: "https://polygonscan.com",
    explorerApiUrl: "https://polygon.blockscout.com/api/v2",
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    confirmations: 128,
    marketplaceAddress: "0x3C626ff68e9a69526117B22D288ab71bdA2B377a",
    marketplaceDeployBlock: 94404469,
    marketplaceStatus: "live",
  },
  5042: {
    id: 5042,
    slug: "arc",
    name: "Arc",
    currency: "USDC",
    explorerUrl: "https://explorer.arc.io",
    explorerApiUrl: "",
    rpcUrl: "https://rpc.mainnet.arc.io",
    confirmations: 12,
    marketplaceAddress: "0xD9883fDdf57Ca58f775Bdab96C0e7c3F1c918af3",
    marketplaceDeployBlock: 0,
    marketplaceStatus: "live",
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
    marketplaceAddress: "0x50489Fdc2352917595359667b34b384b33184b91",
    marketplaceDeployBlock: 51733550,
    marketplaceStatus: "live",
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
    marketplaceAddress: "",
    marketplaceDeployBlock: 24148013,
    marketplaceStatus: "coming-soon",
  },
  33139: {
    id: 33139,
    slug: "apechain",
    name: "ApeChain",
    currency: "APE",
    explorerUrl: "https://apescan.io",
    explorerApiUrl: "https://apechain.calderaexplorer.xyz/api/v2",
    rpcUrl: "https://rpc.apechain.com/http",
    confirmations: 12,
    marketplaceAddress: "0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875",
    marketplaceDeployBlock: 44976904,
    marketplaceStatus: "live",
  },
  7777777: {
    id: 7777777,
    slug: "zora",
    name: "Zora",
    currency: "ETH",
    explorerUrl: "https://explorer.zora.energy",
    explorerApiUrl: "https://explorer.zora.energy/api/v2",
    rpcUrl: "https://rpc.zora.energy",
    confirmations: 12,
    marketplaceAddress: "0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab",
    marketplaceDeployBlock: 51793532,
    marketplaceStatus: "live",
  },
} as const;

export type MarketplaceChainId = keyof typeof marketplaceChains;
export type MarketplaceChain = (typeof marketplaceChains)[MarketplaceChainId];
export function isMarketplaceLive(chainId: MarketplaceChainId) {
  return marketplaceChains[chainId].marketplaceStatus === "live";
}

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
  if (chainId === 109 || chainId === 4663 || chainId === 7777777) return `${chain.explorerUrl}/token/${address}/instance/${tokenId}`;
  return `${chain.explorerUrl}/token/${address}?a=${tokenId}`;
}
