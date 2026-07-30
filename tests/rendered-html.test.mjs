import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("ships every core marketplace route", async () => {
  const routes = ["market", "sell", "activity", "account", "protocol"];
  for (const route of routes) {
    const source = await read(`app/${route}/page.tsx`);
    assert.match(source, new RegExp(`view=\\"${route}\\"`));
  }
});

test("uses live indexed data without demo listings", async () => {
  const [marketplace, portal, indexer] = await Promise.all([
    read("app/marketplace.tsx"),
    read("app/portal.tsx"),
    read("app/api/indexer/route.ts"),
  ]);

  assert.match(marketplace, /\/api\/indexer\?chainId=/);
  assert.match(portal, /\/api\/indexer\?chainId=/);
  assert.match(indexer, /eth_getLogs/);
  assert.match(indexer, /0x2C5F372746330465C3f4084CE6C6aBce22a48B4d/);
  assert.match(indexer, /18216976/);
  assert.match(indexer, /configured: false, listings: \[\], activity: \[\]/);
  assert.doesNotMatch(`${marketplace}\n${portal}`, /demo listing|mock listing|sample listing/i);
});

test("ships the requested court destinations and keeps network choice in the wallet bar", async () => {
  const [chrome, marketplace, portal, collections] = await Promise.all([
    read("app/site-chrome.tsx"),
    read("app/marketplace.tsx"),
    read("app/portal.tsx"),
    read("app/collections/page.tsx"),
  ]);

  for (const route of ["/collections", "/drops", "/activity", "/profile", "/resources", "/support"]) {
    assert.match(chrome, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(chrome, /https:\/\/swap\.thehouseofjoshi\.com\//);
  assert.match(chrome, /https:\/\/www\.nftlaunchpad\.thehouseofjoshi\.com\//);
  assert.match(collections, /Malkuta Mandalas/);
  assert.match(chrome, /court-network-button/);
  assert.doesNotMatch(marketplace, /<NetworkRail/);
  assert.doesNotMatch(portal, /<NetworkContext/);
});

test("isolates listings and activity by supported chain", async () => {
  const [chains, indexer, portal, schema] = await Promise.all([
    read("lib/marketplace-chains.ts"),
    read("app/api/indexer/route.ts"),
    read("app/portal.tsx"),
    read("db/schema.ts"),
  ]);

  for (const chainId of ["1", "109", "137", "8453", "4663"]) {
    assert.match(chains, new RegExp(`${chainId}:`));
  }
  assert.match(indexer, /POLYGON_MARKETPLACE_ADDRESS/);
  assert.match(indexer, /BASE_MARKETPLACE_ADDRESS/);
  assert.match(indexer, /ROBINHOOD_MARKETPLACE_ADDRESS/);
  assert.match(indexer, /marketplace:\$\{chainId\}/);
  assert.match(indexer, /WHERE chain_id = \?/);
  assert.match(schema, /multichain_listings/);
  assert.match(schema, /multichain_marketplace_activity/);
  assert.match(portal, /chainId:selectedChainId/);
  assert.match(portal, /transactionUrl/);
  assert.match(portal, /tokenUrl/);
});

test("keeps the protocol fee fixed at two percent", async () => {
  const contract = await read("contracts/NFTMarketplace.sol");
  assert.match(contract, /MARKETPLACE_FEE_BPS = 200/);
  assert.match(contract, /BPS_DENOMINATOR = 10_000/);
  assert.match(contract, /HOUSE_TREASURY = 0x6736d2eA9807297F0e56967361B9410854B86a5f/);
  assert.match(contract, /IERC2981/);
  assert.match(contract, /withdrawProceeds/);
});
