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

  assert.match(marketplace, /fetch\("\/api\/indexer"/);
  assert.match(portal, /fetch\("\/api\/indexer"/);
  assert.match(indexer, /eth_getLogs/);
  assert.match(indexer, /0x2C5F372746330465C3f4084CE6C6aBce22a48B4d/);
  assert.match(indexer, /18216976/);
  assert.match(indexer, /configured: false, listings: \[\], activity: \[\]/);
  assert.doesNotMatch(`${marketplace}\n${portal}`, /demo listing|mock listing|sample listing/i);
});

test("keeps the protocol fee fixed at two percent", async () => {
  const contract = await read("contracts/NFTMarketplace.sol");
  assert.match(contract, /MARKETPLACE_FEE_BPS = 200/);
  assert.match(contract, /BPS_DENOMINATOR = 10_000/);
  assert.match(contract, /HOUSE_TREASURY = 0x6736d2eA9807297F0e56967361B9410854B86a5f/);
  assert.match(contract, /IERC2981/);
  assert.match(contract, /withdrawProceeds/);
});
