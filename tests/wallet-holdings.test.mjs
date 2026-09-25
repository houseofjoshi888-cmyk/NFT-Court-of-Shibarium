import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

const owner="0x06753AC9405c473324655EB1174d79471745564B";
const contract="0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002";
const request=new Request(`http://localhost/api/wallet-nfts?owner=${owner}&chainId=109`);

test("wallet holdings retries a throttled explorer and keeps NFT metadata",async()=>{
  const {GET}=await loadModule("app/api/wallet-nfts/route.ts");
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return new Response("rate limited",{status:429});
    return Response.json({items:[{id:"42",value:"1",token_type:"ERC-721",token:{address_hash:contract,name:"Shib Magazine Covers",type:"ERC-721"},metadata:{name:"Cover #42",image:"ipfs://bafybeiexample/42.png"}}],next_page_params:null});
  };
  try{
    const response=await GET(request);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.complete,true);
    assert.equal(calls,2);
    assert.equal(body.nfts.length,1);
    assert.equal(body.nfts[0].tokenId,"42");
    assert.equal(body.nfts[0].collection,"Shib Magazine Covers");
    assert.match(body.nfts[0].imageUrl,/\/api\/nft-image\?/);
  }finally{globalThis.fetch=originalFetch;}
});

test("wallet holdings keep a partial page but never label it complete",async()=>{
  const {GET}=await loadModule("app/api/wallet-nfts/route.ts");
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return Response.json({items:[{id:"42",token:{address_hash:contract,name:"Magazine"}}],next_page_params:{token_id:"42",items_count:50}});
    return new Response("provider failed",{status:403});
  };
  try{
    const response=await GET(request);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.complete,false);
    assert.equal(body.nfts.length,1);
    assert.ok(body.warnings.length>0);
  }finally{globalThis.fetch=originalFetch;}
});
