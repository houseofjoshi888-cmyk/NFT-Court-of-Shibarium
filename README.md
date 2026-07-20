# House of Joshi — Shibarium NFT Marketplace

A polished, non-custodial ERC-721 marketplace for Shibarium. The web app connects an injected EVM wallet, adds/switches to Shibarium (chain `109`), approves NFTs for sale, creates listings, and purchases listings with native BONE.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_MARKETPLACE_ADDRESS` to the deployed `NFTMarketplace` address. Until it is set, the marketplace remains a safe interactive preview and does not submit contract writes.

## Contract

[`contracts/NFTMarketplace.sol`](contracts/NFTMarketplace.sol) is a non-custodial fixed-price marketplace using OpenZeppelin's `ReentrancyGuard`. It verifies ownership and approval both when listing and at purchase time, requires exact payment, and credits sellers to a pull-payment balance they withdraw with `withdrawProceeds()`.

Deploy and verify the contract on Puppynet first, then configure the app with its address. The production UI currently targets Shibarium mainnet (chain `109`).

## Data layer

The included catalogue is presentation data. Replace `lots` and the recent-activity rows in `app/marketplace.tsx` with an Envio or subgraph API before production launch. Index `ItemListed`, `ItemCanceled`, `ItemBought`, `ProceedsWithdrawn`, and ERC-721 `Transfer` events.

## Production checklist

- Audit the marketplace contract and add contract tests.
- Deploy to Puppynet and exercise list, cancel, buy, and withdraw flows.
- Configure `NEXT_PUBLIC_MARKETPLACE_ADDRESS`.
- Connect an indexer and metadata cache.
- Add collection verification and content moderation.
- Rebuild and deploy the web app.
