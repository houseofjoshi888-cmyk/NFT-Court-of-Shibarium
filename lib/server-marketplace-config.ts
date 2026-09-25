import { getMarketplaceChain, type MarketplaceChainId } from "./marketplace-chains";
import type { D1Database } from "./marketplace-index";
export type RuntimeEnv = {
  ALCHEMY_API_KEY?: string;
  DB?: D1Database;
  MARKETPLACE_ADDRESS?: string;
  MARKETPLACE_DEPLOY_BLOCK?: string;
  ETHEREUM_MARKETPLACE_ADDRESS?: string;
  ETHEREUM_MARKETPLACE_DEPLOY_BLOCK?: string;
  ETHEREUM_RPC_URL?: string;
  CRONOS_MARKETPLACE_ADDRESS?: string;
  CRONOS_MARKETPLACE_DEPLOY_BLOCK?: string;
  CRONOS_RPC_URL?: string;
  SHIBARIUM_MARKETPLACE_ADDRESS?: string;
  SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK?: string;
  SHIBARIUM_RPC_URL?: string;
  POLYGON_MARKETPLACE_ADDRESS?: string;
  POLYGON_MARKETPLACE_DEPLOY_BLOCK?: string;
  POLYGON_RPC_URL?: string;
  BASE_MARKETPLACE_ADDRESS?: string;
  BASE_MARKETPLACE_DEPLOY_BLOCK?: string;
  BASE_RPC_URL?: string;
  ROBINHOOD_MARKETPLACE_ADDRESS?: string;
  ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK?: string;
  ROBINHOOD_RPC_URL?: string;
  ZORA_MARKETPLACE_ADDRESS?: string;
  ZORA_MARKETPLACE_DEPLOY_BLOCK?: string;
  ZORA_RPC_URL?: string;
  APECHAIN_MARKETPLACE_ADDRESS?: string;
  APECHAIN_MARKETPLACE_DEPLOY_BLOCK?: string;
  APECHAIN_RPC_URL?: string;
  ARC_MARKETPLACE_ADDRESS?: string;
  ARC_MARKETPLACE_DEPLOY_BLOCK?: string;
  ARC_RPC_URL?: string;
};

const DEFAULT_MARKETPLACE_ADDRESS = "0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875";
const DEFAULT_MARKETPLACE_DEPLOY_BLOCK = "19143354";
export function chainConfig(runtime: RuntimeEnv, chainId: MarketplaceChainId) {
  const chain = getMarketplaceChain(chainId);
  const alchemyNetwork:Partial<Record<MarketplaceChainId,string>>={1:"eth-mainnet",137:"polygon-mainnet",8453:"base-mainnet"};
  const fallbackRpcUrl=runtime.ALCHEMY_API_KEY&&alchemyNetwork[chainId]?`https://${alchemyNetwork[chainId]}.g.alchemy.com/v2/${runtime.ALCHEMY_API_KEY}`:undefined;
  if (chainId === 1) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ETHEREUM_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ETHEREUM_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ETHEREUM_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 25) return {
    fallbackRpcUrl,
    chain,
    address: runtime.CRONOS_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.CRONOS_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.CRONOS_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 109) return {
    fallbackRpcUrl,
    chain,
    address: runtime.SHIBARIUM_MARKETPLACE_ADDRESS ?? runtime.MARKETPLACE_ADDRESS ?? DEFAULT_MARKETPLACE_ADDRESS,
    deployBlock: runtime.SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK ?? runtime.MARKETPLACE_DEPLOY_BLOCK ?? DEFAULT_MARKETPLACE_DEPLOY_BLOCK,
    rpcUrl: runtime.SHIBARIUM_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 137) return {
    fallbackRpcUrl,
    chain,
    address: runtime.POLYGON_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.POLYGON_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.POLYGON_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 8453) return {
    fallbackRpcUrl,
    chain,
    address: runtime.BASE_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.BASE_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.BASE_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 5042) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ARC_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ARC_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ARC_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 4663) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ROBINHOOD_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ROBINHOOD_RPC_URL ?? chain.rpcUrl,
  };
  if (chainId === 7777777) return {
    fallbackRpcUrl,
    chain,
    address: runtime.ZORA_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.ZORA_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.ZORA_RPC_URL ?? chain.rpcUrl,
  };
  return {
    fallbackRpcUrl,
    chain,
    address: runtime.APECHAIN_MARKETPLACE_ADDRESS ?? chain.marketplaceAddress,
    deployBlock: runtime.APECHAIN_MARKETPLACE_DEPLOY_BLOCK ?? String(chain.marketplaceDeployBlock),
    rpcUrl: runtime.APECHAIN_RPC_URL ?? chain.rpcUrl,
  };
}
