# House of Joshi — Shibarium NFT Marketplace

A polished, non-custodial ERC-721 marketplace for Shibarium. The web app connects an injected EVM wallet, adds/switches to Shibarium (chain `109`), approves NFTs for sale, creates listings, and purchases listings with native BONE.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app is connected by default to the verified Shibarium mainnet `NFTMarketplace` deployment at `0x2C5F372746330465C3f4084CE6C6aBce22a48B4d` (block `18216976`). Set `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK` only to override this configuration for a future deployment.

RainbowKit powers wallet connection and account management. Installed browser wallets work without extra configuration. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud project ID to add QR-based mobile wallet connections.

## Contract

[`contracts/NFTMarketplace.sol`](contracts/NFTMarketplace.sol) is a non-custodial fixed-price marketplace using OpenZeppelin's `ReentrancyGuard`. It verifies ownership and approval both when listing and at purchase time, requires exact payment, deducts a fixed 2% protocol fee, honors optional ERC-2981 royalties, and credits sellers, creators, and the House of Joshi treasury to pull-payment balances withdrawn with `withdrawProceeds()`.

The 2% protocol fee is permanently credited to the House of Joshi treasury: `0x6736d2eA9807297F0e56967361B9410854B86a5f`. The contract has no constructor parameters. Verify it on Puppynet first, then configure the app with its address and deployment block. The production UI currently targets Shibarium mainnet (chain `109`).

## Data layer

The marketplace intentionally ships without sample listings, activity, or metrics. Its D1-backed indexer reads confirmed `ItemListed`, `ItemCanceled`, `ItemBought`, and `ProceedsWithdrawn` events directly from Shibarium, persists a block checkpoint, and exposes active listings and recent activity through `/api/indexer`.

On Vercel, `npm run build` creates the standard `.next` output and the indexer uses a stateless recent-block fallback because D1 is not available. The Cloudflare Sites build remains available through `npm run build:sites` and uses the persistent D1 checkpoint.

## Production checklist

- Audit the marketplace contract and add contract tests.
- Deploy to Puppynet and exercise list, cancel, buy, and withdraw flows.
- Configure `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK`.
- Add a metadata cache if collection names and NFT media are required.
- Add collection verification and content moderation.
- Rebuild and deploy the web app.
