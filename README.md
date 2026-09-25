# House of Joshi — Multichain NFT Marketplace

A non-custodial ERC-721 and ERC-1155 marketplace. HOJ trading is live on Base, Cronos EVM, and Shibarium. Ethereum, Polygon, Robinhood Chain, ApeChain, Zora, and Arc mainnet are available in the network UI but marked Coming soon for HOJ trading until V5 contracts are deployed and verified. Arc uses USDC as its native gas and settlement currency.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app is connected by default to the Shibarium `HOJNFTMarketplace` V5 deployment at `0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875` (block `19143354`). The older Shibarium deployment remains separate; its deposits and proceeds do not migrate automatically.

## Multichain configuration

Nine chains are configured in the wallet and network UI. Base's verified HOJNFTMarketplace V5 deployment is `0xCb54f70B0eb580a8ec22a0e67C05293206C358F2` from block `51733550`. Cronos EVM's V5 deployment is `0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875` from block `95919348`, and Shibarium's V5 deployment is the same hexadecimal address on chain 109 from block `19143354`. Other chains retain their historical marketplace addresses for reference, but new HOJ trading is disabled until their V5 deployments are verified and `marketplaceStatus` is changed to `live`. Setting an address in the environment alone does not activate trading. Server environment values override the checked-in defaults:

```env
ETHEREUM_MARKETPLACE_ADDRESS=0x...
ETHEREUM_MARKETPLACE_DEPLOY_BLOCK=...
ETHEREUM_RPC_URL=https://cloudflare-eth.com

CRONOS_MARKETPLACE_ADDRESS=0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875
CRONOS_MARKETPLACE_DEPLOY_BLOCK=95919348
CRONOS_RPC_URL=https://evm.cronos.org

SHIBARIUM_MARKETPLACE_ADDRESS=0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875
SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK=19143354
SHIBARIUM_RPC_URL=https://...

POLYGON_MARKETPLACE_ADDRESS=0x...
POLYGON_MARKETPLACE_DEPLOY_BLOCK=...
POLYGON_RPC_URL=https://...

BASE_MARKETPLACE_ADDRESS=0x...
BASE_MARKETPLACE_DEPLOY_BLOCK=...
BASE_RPC_URL=https://...

ROBINHOOD_MARKETPLACE_ADDRESS=0x...
ROBINHOOD_MARKETPLACE_DEPLOY_BLOCK=...
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com

ZORA_MARKETPLACE_ADDRESS=0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875
ZORA_MARKETPLACE_DEPLOY_BLOCK=51793532
APECHAIN_MARKETPLACE_ADDRESS=0x...
APECHAIN_MARKETPLACE_DEPLOY_BLOCK=...

# Optional Blockscout-compatible NFT API overrides
ETHEREUM_EXPLORER_API_URL=https://eth.blockscout.com/api/v2
SHIBARIUM_EXPLORER_API_URL=https://.../api/v2
POLYGON_EXPLORER_API_URL=https://.../api/v2
BASE_EXPLORER_API_URL=https://.../api/v2
ROBINHOOD_EXPLORER_API_URL=https://robinhoodchain.blockscout.com/api/v2
```

The older `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK` variables remain supported as Shibarium-only aliases. Cronos NFT wallet discovery uses the RPC ownership fallback and metadata fetching; complete ERC-721/1155 enumeration needs a compatible NFT indexer API, such as a configured `CRONOS_EXPLORER_API_URL` or Blockscout multichain API key.

Listings, activity, and indexer cursors are stored with chain-specific IDs in the `multichain_listings` and `multichain_marketplace_activity` tables. The API contract is:

```text
GET /api/indexer?chainId=137
GET /api/wallet-nfts?owner=0x...&chainId=137
GET /api/nft?contract=0x...&tokenId=1&chainId=137
```

### Deploying a marketplace

The deployer wallet must hold enough native gas currency on the target network. Never put a private key in a committed file.

```bash
COMPILE_ONLY=1 DEPLOY_CHAIN_ID=8453 npm run deploy:marketplace
# For an actual deployment, supply DEPLOY_CHAIN_ID, DEPLOYER_PRIVATE_KEY,
# and FEE_TREASURY_ADDRESS through a secure local environment.
```

The command prints the address, block, deployer, and transaction hash. `FEE_TREASURY_ADDRESS` is the constructor argument: check it before signing because it cannot be changed on that deployment. For manual deployment, follow [the Remix guide](docs/DEPLOY-V5-REMIX.md).

RainbowKit powers wallet connection and account management. Installed browser wallets work without extra configuration. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud project ID to add QR-based mobile wallet connections.

## Contract

[`contracts/NFTMarketplaceV5.sol`](contracts/NFTMarketplaceV5.sol) defines the deployable `HOJNFTMarketplace`, built on the base and V4 contracts. It supports ERC-721 and ERC-1155 listings, purchases, and funded offers using the network's native currency. It deducts a 2% protocol fee, honors optional ERC-2981 royalties, and credits sellers, creators, and the constructor-supplied treasury to pull-payment balances withdrawn with `withdrawProceeds()`.

Base V5 reports treasury `0x6736d2eA9807297F0e56967361B9410854B86a5f`. Confirm this is the intended fee wallet. Each new deployment takes its own treasury address as a constructor parameter. Verify every new deployment on its network explorer, then configure the app with its address and deployment block. An old contract's offers, approvals, and withdrawable proceeds do not migrate; see [operations](docs/MARKETPLACE-OPERATIONS.md).

## Data layer

The marketplace intentionally ships without sample listings, activity, or metrics. Its D1-backed indexer reads confirmed `ItemListed`, `ItemCanceled`, `ItemBought`, and `ProceedsWithdrawn` events independently from each configured network, persists chain-specific block checkpoints, and exposes active listings and recent activity through `/api/indexer?chainId=...`.

On Vercel, `npm run build` creates the standard `.next` output. A persistent database is required for complete historical indexing; an ephemeral server filesystem cannot retain the index across restarts. The Cloudflare Sites build is available through `npm run build:sites` and uses the persistent D1 checkpoint.

## Production checklist

- Confirm the immutable fee treasury wallet on each deployed contract.
- Obtain an independent security review before handling significant value.
- Exercise ERC-721 and ERC-1155 list, buy, offer, cancel, royalty, and withdrawal flows with small values on each target chain.
- Set matching address and deployment-block overrides in production, keep legacy-contract withdrawal access, and wait for the indexer to catch up.
- Rebuild, deploy, and check the live app's `/api/indexer?chainId=8453` response.
