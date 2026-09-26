# Direct settlement in HOJ NFT Marketplace V7

All currently configured live marketplace contracts are now **V7** with automatic direct settlement enabled. For native-currency ERC-721 and ERC-1155 purchases and accepted offers, V7 calculates the 2% House fee and optional ERC-2981 royalty, then attempts to send the seller's net amount, the House fee, and the royalty directly to their respective wallets in the same transaction. The NFT goes to the buyer. If a recipient wallet rejects its payment, that amount is credited to that recipient's `getProceeds` balance, where only that recipient can withdraw it. An unsuccessful payment to one recipient does not divert the others' shares.

## Current V7 Deployments

All live chains now use V7 contracts with automatic payments:

- **Shibarium (109)**: Block 19169320
- **Base (8453)**: Block 51813478
- **Polygon (137)**: Block 94475428
- **Arc (5042)**: Block 22840359
- **Zora (7777777)**: Block 51861519
- **Cronos (25)**: Block 96267649
- **ApeChain (33139)**: Block 50360444

## Payment Behavior

**Automatic Direct Payments:**
- Sellers receive sale proceeds automatically in the same transaction
- Treasury receives 2% fee automatically
- Royalty recipients receive royalties automatically
- If direct payment fails (e.g., contract wallet), funds are credited to withdrawable balance
- Recipients can withdraw deferred payments via `withdrawProceeds()`

**Fallback to Manual Withdrawal:**
- Contract wallets that reject direct payments
- Gas limit exceeded scenarios
- Recipients can check their balance via `getProceeds(address)`

## ERC-20 Payments

The V6 ERC-20 purchase path already sends ERC-20 payouts directly and is inherited unchanged by V7; its ERC-20 transfers are atomic and do not use the native-currency withdrawal fallback.

## User Migration

Users who had listings on the old V5 contracts should:
1. Cancel existing listings on V5
2. Revoke approvals on V5
3. Approve the new V7 contract
4. Relist their NFTs on V7

**Important:** Existing listings, offers, and credited proceeds from V5 do not migrate. Old proceeds remain withdrawable from the V5 contract and can still be claimed via `withdrawProceeds()` on the old contract address.

## Verification

To verify a contract is V7:
1. Check `marketplaceVersion()` returns 7
2. Check `MARKETPLACE_FEE_BPS()` returns 200 (2%)
3. Verify `HOUSE_TREASURY()` is the correct treasury address

V7 does not provide an admin sweep or rescue of arbitrary contract funds. The withdrawal page is a fallback for credited balances only.
