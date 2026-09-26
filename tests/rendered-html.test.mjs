import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("configured chains resolve independently with the correct native currencies",async()=>{
  const {chainConfig}=await loadModule("lib/server-marketplace-config.ts");
  const polygon=chainConfig({POLYGON_MARKETPLACE_ADDRESS:"0x1111111111111111111111111111111111111111"},137);
  const base=chainConfig({},8453);
  assert.equal(polygon.chain.currency,"POL");assert.equal(base.chain.currency,"ETH");
  assert.notEqual(polygon.address,base.address);
  assert.equal(base.address,"0xCb54f70B0eb580a8ec22a0e67C05293206C358F2");
  assert.equal(base.deployBlock,"51733550");
  assert.equal(base.rpcUrl,"https://mainnet.base.org");
  assert.equal(polygon.chain.marketplaceStatus,"live");
  assert.equal(chainConfig({},137).address,"0xfb985d4eDd4C1F909899389C217aEC9D6895B72d");
  assert.equal(chainConfig({},137).deployBlock,"94404469");
  const cronos=chainConfig({},25);
  assert.equal(cronos.chain.currency,"CRO");
  assert.equal(cronos.address,"0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875");
  assert.equal(cronos.deployBlock,"95919348");
  assert.equal(chainConfig({},109).chain.currency,"BONE");assert.equal(chainConfig({},33139).chain.currency,"APE");
  assert.equal(chainConfig({},109).address,"0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875");
  assert.equal(chainConfig({},109).deployBlock,"19143354");
  const zora=chainConfig({},7777777);
  assert.equal(zora.chain.marketplaceStatus,"live");
  assert.equal(zora.address,"0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875");
  assert.equal(zora.deployBlock,"51793532");
  const arc=chainConfig({},5042);
  assert.equal(arc.chain.currency,"USDC");
  assert.equal(arc.chain.marketplaceStatus,"coming-soon");
  assert.equal(arc.address,"");
  assert.equal(arc.rpcUrl,"https://rpc.mainnet.arc.io");
});
test("coming-soon networks expose no live marketplace listings",async()=>{
  const {GET}=await loadModule("app/api/indexer/route.ts");
  for(const chainId of [1,5042,4663,33139]){
    const response=await GET(new Request(`http://localhost/api/indexer?chainId=${chainId}`));
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.configured,false);
    assert.equal(body.status,"coming-soon");
    assert.deepEqual(body.listings,[]);
  }
});
test("NFT price history keeps only recorded listing and settlement prices in time order",async()=>{
  const {toPriceHistoryPoints}=await loadModule("lib/nft-price-history.ts");
  const base={chainId:8453,nftAddress:"0x1111111111111111111111111111111111111111",tokenId:"7",seller:null,buyer:null,marketplaceFee:null,royaltyRecipient:null,royaltyAmount:null,transactionHash:`0x${"a".repeat(64)}`,timestamp:100,logIndex:0};
  const points=toPriceHistoryPoints([
    {...base,id:"sale",eventType:"sold",price:"200",blockNumber:12},
    {...base,id:"offer",eventType:"offer",price:"300",blockNumber:11},
    {...base,id:"list",eventType:"listed",price:"100",blockNumber:10},
  ]);
  assert.deepEqual(points.map(point=>[point.eventType,point.price]),[["listed","100"],["sold","200"]]);
});
test("coming-soon NFT price history returns a truthful empty state",async()=>{
  const {GET}=await loadModule("app/api/nft-price-history/route.ts");
  const response=await GET(new Request("http://localhost/api/nft-price-history?chainId=5042&contract=0x1111111111111111111111111111111111111111&tokenId=7"));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(body.points,[]);
  assert.match(body.warning,/coming soon/i);
});
test("indexer rejects unsupported networks without issuing RPC requests",async()=>{
  const {GET}=await loadModule("app/api/indexer/route.ts");
  const response=await GET(new Request("http://localhost/api/indexer?chainId=999"));
  assert.equal(response.status,400);assert.equal((await response.json()).configured,false);
});
