# Deploying the House of Joshi marketplace in Remix

Deploy **HOJNFTMarketplace**, the contract in
`contracts/NFTMarketplaceV5.sol`. It supports standard ERC-721 and ERC-1155
NFTs on the eight EVM networks configured in this app. ERC-721 fixed-price
listings, purchases, funded offers, and batch checkout are supported.
ERC-1155 fixed-price quantity listings, purchases, and funded quantity offers
are supported. Settlement uses each network's native currency. It does not
trade ERC-20-priced listings or NFTs on non-EVM networks.

1. Open the official Remix IDE at `https://remix.ethereum.org/`.
2. Create these three files together in Remix's `contracts` folder, copying
   their exact contents from this project:
   `NFTMarketplace.sol`, `NFTMarketplaceV4.sol`, and
   `NFTMarketplaceV5.sol`. The V5 file imports V4, which imports the base file.
   Remix resolves the `@openzeppelin/contracts` imports from npm.
3. In the Solidity Compiler, select version **0.8.36**, enable the optimizer
   with **200 runs**, and set the EVM version to **Shanghai**. Compile
   `NFTMarketplaceV5.sol` and select **HOJNFTMarketplace** as the contract.
4. In Deploy & Run, choose **Injected Provider** and check the connected wallet's
   network. Enter the intended **EVM fee treasury wallet** as the single
   `treasury` constructor argument. Check every character; it receives the
   marketplace's 2% fee and cannot be changed on that deployment.
5. Deploy from your wallet. Save the contract address, chain ID, deployment
   transaction, deployment block, treasury wallet, compiler settings, and
   verified source. Read `marketplaceVersion()` (must return `5`),
   `HOUSE_TREASURY()` (must match the intended wallet), and
   `MARKETPLACE_FEE_BPS()` (must return `200`) on the deployed instance.
6. Repeat for each EVM chain you want to activate. One deployment does not
   cover other networks. Set the matching
   `*_MARKETPLACE_ADDRESS` and `*_MARKETPLACE_DEPLOY_BLOCK` in the app's server
   environment, update `lib/marketplace-chains.ts` for client defaults, and
   redeploy the app. Wait for `/api/indexer?chainId=<id>` to show
   `sync.caughtUp: true` before treating marketplace totals as complete.

The fee is credited to the treasury after a completed sale or accepted offer.
The treasury wallet must call `withdrawProceeds()` to receive it. Seller proceeds,
creator royalties, canceled offer deposits, and replaced offer deposits use the
same withdrawal method for their respective wallets. Listing an NFT does not
trigger a sale or fee.

Test the full flow with small-value NFTs on a test network first, and get an
independent contract review before handling significant mainnet funds. Existing
contract balances, offers, and approvals do not move to the new deployment.
