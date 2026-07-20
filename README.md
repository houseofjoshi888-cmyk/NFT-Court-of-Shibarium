# House of Joshi — Shibarium NFT Marketplace

A polished, non-custodial ERC-721 marketplace for Shibarium. The web app connects an injected EVM wallet, adds/switches to Shibarium (chain `109`), approves NFTs for sale, creates listings, and purchases listings with native BONE.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK` to the deployed `NFTMarketplace` address and its deployment block. Until they are set, the marketplace remains a safe interactive preview and does not submit contract writes.

RainbowKit powers wallet connection and account management. Installed browser wallets work without extra configuration. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud project ID to add QR-based mobile wallet connections.

## Contract

[`contracts/NFTMarketplace.sol`](contracts/NFTMarketplace.sol) is a non-custodial fixed-price marketplace using OpenZeppelin's `ReentrancyGuard` and two-step ownership. It verifies ownership and approval both when listing and at purchase time, requires exact payment, deducts a fixed 2% protocol fee, honors optional ERC-2981 royalties, and credits sellers, creators, and the treasury to pull-payment balances withdrawn with `withdrawProceeds()`.

Deploy the contract with the treasury wallet as `initialFeeRecipient` and verify it on Puppynet first, then configure the app with its address and deployment block. The production UI currently targets Shibarium mainnet (chain `109`).

## Data layer

The marketplace intentionally ships without sample listings, activity, or metrics. Its D1-backed indexer reads confirmed `ItemListed`, `ItemCanceled`, `ItemBought`, and `ProceedsWithdrawn` events directly from Shibarium, persists a block checkpoint, and exposes active listings and recent activity through `/api/indexer`.

## Production checklist

- Audit the marketplace contract and add contract tests.
- Deploy to Puppynet and exercise list, cancel, buy, and withdraw flows.
- Configure `MARKETPLACE_ADDRESS` and `MARKETPLACE_DEPLOY_BLOCK`.
- Add a metadata cache if collection names and NFT media are required.
- Add collection verification and content moderation.
- Rebuild and deploy the web app.
