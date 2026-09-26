# Direct settlement in HOJ NFT Marketplace V7

The currently configured live marketplace contracts report version 5. They credit native-currency proceeds to `getProceeds(address)`; each recipient must call `withdrawProceeds()`. The app cannot change this behavior on an already deployed contract.

`contracts/NFTMarketplaceV7.sol` is a new deployment candidate. For native-currency ERC-721 and ERC-1155 purchases and accepted offers, it calculates the 2% House fee and optional ERC-2981 royalty, then attempts to send the seller's net amount, the House fee, and the royalty directly to their respective wallets in the same transaction. The NFT goes to the buyer. If a recipient wallet rejects its payment, that amount is credited to that recipient's `getProceeds` balance, where only that recipient can withdraw it. An unsuccessful payment to one recipient does not divert the others' shares.

The fee treasury is fixed at deployment. Use `0x6736d2eA9807297F0e56967361B9410854B86a5f` as the constructor argument only after independently verifying wallet control. The deployment script compiles V7 but does not deploy without an explicit invocation and a funded deployer key. The V6 ERC-20 purchase path already sends ERC-20 payouts directly and is inherited unchanged by V7; its ERC-20 transfers are atomic and do not use the native-currency withdrawal fallback.

Before using V7 on a live network:

1. Commission an independent smart-contract audit and test against representative ERC-721, ERC-1155, ERC-2981, multisig, and contract-wallet implementations on that network.
2. Deploy a new V7 instance. Verify its source code, `marketplaceVersion() == 7`, `MARKETPLACE_FEE_BPS() == 200`, and `HOUSE_TREASURY()` on the explorer.
3. Update that chain's marketplace address and deployment block in the app, then validate purchases and withdrawals end to end before enabling trading.
4. Tell sellers to cancel listings and revoke approvals on the old contract, then approve and list on the new one. Existing listings, offers, and credited proceeds do not migrate. Old proceeds remain withdrawable from the old contract and must not be hidden by the address switch.

V7 does not provide an admin sweep or rescue of arbitrary contract funds. The withdrawal page is a fallback for credited balances only.
