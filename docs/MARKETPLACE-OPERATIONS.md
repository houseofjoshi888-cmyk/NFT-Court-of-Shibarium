# Marketplace reliability and V5 rollout

## Storage and backfill

Local Next.js and durable Node servers use `.data/marketplace.sqlite` (Node 22.13+).
Set `MARKETPLACE_DB_PATH` to a persistent volume path in production. Back up the
database together with its WAL using SQLite's backup tooling, not a live single-file copy.
Cloudflare deployments use the existing `DB` D1 binding. Ephemeral Vercel/Lambda
filesystems are deliberately not used as durable storage; those deployments still
need a persistent database adapter before historical indexing can be complete.

Each `/api/indexer?chainId=…` call resumes the address-scoped cursor and scans up
to eight 8,000-block ranges. Provider range limits cause ranges to split. A failed
range never advances the cursor. The UI refreshes every 30 seconds. Large backfills
will require multiple calls; inspect `sync.caughtUp` and `syncError` before treating
the floor as complete. Floors are HOJ-only native-currency asking prices, not a
market-wide floor, appraisal, or guaranteed sale price. Activity is the latest 100
events per network, not all-time analytics.

## Wallet discovery and metadata

Configure `ALCHEMY_API_KEY` and per-network RPC/explorer overrides on the server.
The Base default RPC is `https://mainnet.base.org`; the former PublicNode
default rejects archive log requests without a personal token and caused
production `/api/indexer?chainId=8453` to return no listings. If production
sets `BASE_RPC_URL`, update that override to a historical-log-capable endpoint
too. Base's public endpoint limits `eth_getLogs` to 2,000 blocks per request;
the indexer splits larger requested ranges and resumes from its saved cursor.
The existing Alchemy key is also used as an archive RPC fallback for Ethereum,
Polygon and Base. Provider plan restrictions still apply. Range limits narrow the
next committed scan rather than issuing unbounded recursive requests.
Pagination preserves already-fetched NFTs if a subsequent request fails. Provider
requests retry transient HTTP 429 and 5xx failures; the profile batches network
requests to reduce shared-provider throttling and names each incomplete network.
Results
return `complete:false` when incomplete; the profile displays a retry control.
The 100-page safety ceiling and recent ERC-721 RPC scan are not full-history
guarantees. ERC-1155 discovery requires an NFT indexer. Offline or permanently
missing token media cannot be manufactured; metadata refresh bypasses caches and
the image endpoint tries contract URIs, explorer media and configured Alchemy.

## Contracts and activation

Base V5 is deployed at `0xCb54f70B0eb580a8ec22a0e67C05293206C358F2`
from block `51733550`. Networks other than Base, Cronos, and Shibarium retain their existing deployments
until the owner supplies new V5 addresses. If production environment variables
override the checked-in Base defaults, update those values to match.

Cronos EVM V5 is deployed at `0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875`
from block `95919348` (chain ID 25). It reports version 5, a 2% fee, and
treasury `0x6736d2eA9807297F0e56967361B9410854B86a5f`.
The Cronos wallet selector, listing index, NFT metadata and transaction flows
use the Cronos EVM RPC. Full wallet NFT discovery, especially ERC-1155, needs a
supported NFT indexer API; the free Cronos EVM RPC alone cannot enumerate every
NFT in a wallet. Set `CRONOS_EXPLORER_API_URL` to a compatible Blockscout v2
endpoint or provide `BLOCKSCOUT_API_KEY` for Blockscout's multichain API.

Shibarium V5 is deployed at `0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875`
from block `19143354`. It reports version 5, a 2% fee, and the same treasury.
The prior Shibarium marketplace at `0x2C5F372746330465C3f4084CE6C6aBce22a48B4d`
is not upgraded or emptied by changing the app default. Users with old offer
deposits or proceeds must access that contract directly to cancel or withdraw.

`contracts/NFTMarketplaceV5.sol` includes ERC-721 and ERC-1155 listings,
sales, funded offers, royalty accounting, and pull-payment withdrawals. Its
constructor requires the fee treasury address. The 2% fee is credited to that
wallet after settlement and must be withdrawn by that wallet. Native currencies
are used. ERC-721 batch checkout is supported; edition batch checkout is not.

This source code does not upgrade earlier deployments. A Base V5 deployment exists;
this repository change did not deploy it. Review/audit and test on each
target network before deployment. Compile the V5 entry point with Solidity 0.8.36,
optimizer enabled (200 runs); the tests compile the marketplace for Shanghai.
Never paste a private key into chat or commit one.

When a deployment is approved, record its chain, address, deployment block and
verified bytecode; update both server and public chain configuration. The UI checks
`marketplaceVersion() >= 4` before edition trading and >= 5 for edition offers. Existing V1–V3 deployments
keep their current ERC-721 flow; price changes use cancel then relist.

Do not replace old contract addresses without a migration plan: approvals,
listings, offer deposits and withdrawable proceeds remain in the old contracts.
Keep legacy withdrawal/cancellation access available and cancel/relist intentionally.
Database scopes prevent new deployments from reusing old deployment cursors.

For the old Base deployment at `0xD811Cd9bB417B479Eb6e0849b5AB5ABe8C1A47d8`,
users can still use its verified explorer contract interface to check
`getProceeds(wallet)`, call `withdrawProceeds()` from the recipient wallet,
cancel their own offers/listings, and then approve/relist on V5 if desired.
Do not claim or attempt automatic migration of escrowed offers or proceeds.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build`.
Run `npm run health:marketplace` against the production URL to check every live
network's listing index. Set `MARKETPLACE_URL` to check another deployment.
Optionally set `OWNER_ADDRESS` to check whether each network returns complete
NFT holdings for that wallet. A nonzero exit status means at least one network
needs attention; run this command from your deployment monitor to trigger alerts.
Tests use an isolated Ganache EVM with synthetic test tokens/accounts; no mainnet
funds, production demo collections, or private wallet keys are used. Covered flows
include fees/royalties, approval revocation, stale ownership, offer settlement,
batch atomicity, edition quantities/multiple sellers, price changes, SQL replay,
database restart/rollback, and receipt replacement handling. This is not a security audit.

Pending transaction hashes are kept in tab session storage so a reload can restore
the confirmation check. A timeout is never treated as a failed trade. Recovery
does not auto-sign the next step of a multi-transaction operation.
