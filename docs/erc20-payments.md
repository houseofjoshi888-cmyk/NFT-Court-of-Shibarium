# WETH and USDC settlement (V6)

The deployed HOJ marketplace contracts settle only in each chain's native coin. `contracts/NFTMarketplaceV6.sol` adds an independent ERC-721 fixed-price listing path for treasury-approved ERC-20 payment tokens, while retaining V5 native-coin functionality. It does **not** upgrade existing deployments in place.

Before this feature can be exposed to buyers and sellers on a chain:

1. Identify that chain's exact WETH and USDC contract addresses from issuer/chain documentation. Do not assume the address is the same on another chain; distinguish native USDC from bridged USDC.
2. Review and audit V6, then deploy it on that chain with the HOJ fee treasury address. The deployment script now compiles V6. Record its contract address and deployment block.
3. From the treasury wallet, call `setAllowedPaymentToken(wethAddress, true)` and `setAllowedPaymentToken(usdcAddress, true)` on V6. Each address must be an ERC-20 contract on that same chain.
4. Update marketplace configuration and indexing for the new deployment, including `TokenItemListed`, `TokenItemCanceled`, and `TokenItemBought` events. Existing V5 listings are **not** migrated; sellers must cancel/relist or both deployments must be indexed during transition.
5. Add chain-specific WETH/USDC token addresses and decimals to the UI. Buyers must approve the exact payment amount for V6 before `buyTokenItem`; price displays, floors, sales, cart totals, and filters must remain separated by payment currency.
6. Verify end-to-end listing, cancellation, purchase, 2% treasury fee, royalty, allowance failure, stale ownership, and indexer recovery on each chain before enabling the option publicly.

V6's native settlement path remains unchanged. ERC-20 proceeds are sent in the purchase transaction, not held for `withdrawProceeds()`. WETH/USDC listings should **not** be shown as live in the app until the deployment, allowlist, indexer, and UI steps above are complete.
