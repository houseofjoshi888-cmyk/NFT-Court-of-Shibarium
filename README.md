# House of Joshi — Multichain NFT Marketplace

A polished, non-custodial ERC-721 marketplace for Shibarium, Polygon, Base, and Robinhood Chain. The web app switches the connected EVM wallet to the selected network, approves NFTs for sale, creates listings, and purchases listings in the network's native currency.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app is connected by default to the verified Shibarium mainnet `NFTMarketplace` deployment at `0x2C5F372746330465C3f4084CE6C6aBce22a48B4d` (block `18216976`). Set `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK` only to override this configuration for a future deployment.

## Multichain configuration

Shibarium (109), Polygon (137), Base (8453), and Robinhood Chain (4663) are supported by the wallet, UI, indexer, database, metadata APIs, and transaction flows. Shibarium keeps its verified default deployment. The other networks remain read-only and show “deployment needed” until both values for that network are configured:

```env
SHIBARIUM_MARKETPLACE_ADDRESS=0x...
SHIBARIUM_MARKETPLACE_DEPLOY_BLOCK=18216976
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

# Optional Blockscout-compatible NFT API overrides
SHIBARIUM_EXPLORER_API_URL=https://.../api/v2
POLYGON_EXPLORER_API_URL=https://.../api/v2
BASE_EXPLORER_API_URL=https://.../api/v2
ROBINHOOD_EXPLORER_API_URL=https://robinhoodchain.blockscout.com/api/v2
```

The older `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK` variables remain supported as Shibarium-only aliases.

Listings, activity, and indexer cursors are stored with chain-specific IDs in the `multichain_listings` and `multichain_marketplace_activity` tables. The API contract is:

```text
GET /api/indexer?chainId=137
GET /api/wallet-nfts?owner=0x...&chainId=137
GET /api/nft?contract=0x...&tokenId=1&chainId=137
```

### Deploying Polygon or Base

The deployer wallet must hold enough native gas currency on the target network. Never put a private key in a committed file.

```bash
DEPLOY_CHAIN_ID=137 DEPLOYER_PRIVATE_KEY=0x... npm run deploy:marketplace
DEPLOY_CHAIN_ID=8453 DEPLOYER_PRIVATE_KEY=0x... npm run deploy:marketplace
DEPLOY_CHAIN_ID=4663 DEPLOYER_PRIVATE_KEY=0x... npm run deploy:marketplace
```

The command prints the contract address, deployment block, deployer, and transaction hash needed for the environment configuration. To compile without broadcasting:

```bash
DEPLOY_CHAIN_ID=137 COMPILE_ONLY=1 npm run deploy:marketplace
```

The contract treasury is currently fixed at `0x6736d2eA9807297F0e56967361B9410854B86a5f`. Confirm that this is the intended treasury on every network before deployment.

RainbowKit powers wallet connection and account management. Installed browser wallets work without extra configuration. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud project ID to add QR-based mobile wallet connections.

## Contract

[`contracts/NFTMarketplace.sol`](contracts/NFTMarketplace.sol) is a non-custodial fixed-price marketplace using OpenZeppelin's `ReentrancyGuard`. It verifies ownership and approval both when listing and at purchase time, requires exact payment, deducts a fixed 2% protocol fee, honors optional ERC-2981 royalties, and credits sellers, creators, and the House of Joshi treasury to pull-payment balances withdrawn with `withdrawProceeds()`.

The 2% protocol fee is permanently credited to the House of Joshi treasury: `0x6736d2eA9807297F0e56967361B9410854B86a5f`. The contract has no constructor parameters. Verify every new deployment on its network explorer, then configure the app with its address and deployment block.

## Data layer

The marketplace intentionally ships without sample listings, activity, or metrics. Its D1-backed indexer reads confirmed `ItemListed`, `ItemCanceled`, `ItemBought`, and `ProceedsWithdrawn` events independently from each configured network, persists chain-specific block checkpoints, and exposes active listings and recent activity through `/api/indexer?chainId=...`.

On Vercel, `npm run build` creates the standard `.next` output and the indexer uses a stateless recent-block fallback because D1 is not available. The Cloudflare Sites build remains available through `npm run build:sites` and uses the persistent D1 checkpoint.

## Production checklist

- Audit the marketplace contract and add contract tests.
- Deploy to Puppynet and exercise list, cancel, buy, and withdraw flows.
- Configure `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK`.
- Add a metadata cache if collection names and NFT media are required.
- Add collection verification and content moderation.
- Rebuild and deploy the web app.
