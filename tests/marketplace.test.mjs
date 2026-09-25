import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { encodeAbiParameters, encodeEventTopics, parseEther } from "viem";
import { loadModule } from "./load-module.mjs";
const {marketplaceAbi,parseNativeAmount}=await loadModule("lib/marketplace-abi.ts");
const {decodeMarketplaceLogs,replayEvents,eventStatements}=await loadModule("lib/marketplace-index.ts");
const {sortActivity}=await loadModule("lib/activity-sort.ts");
const {confirmedReceipt}=await loadModule("lib/transaction-receipt.ts");
const seller="0x1111111111111111111111111111111111111111",buyer="0x2222222222222222222222222222222222222222",nft="0x3333333333333333333333333333333333333333";
const hash=`0x${"ab".repeat(32)}`;
function log(eventName,args,index){
  const event=marketplaceAbi.find(item=>item.type==="event"&&item.name===eventName);
  const values=event.inputs.filter(input=>!input.indexed);
  return {topics:encodeEventTopics({abi:marketplaceAbi,eventName,args}),data:encodeAbiParameters(values,values.map(input=>args[input.name])),transactionHash:hash,blockNumber:"0xa",logIndex:`0x${index.toString(16)}`};
}
const logs=[
  log("ItemListed",{seller,nftAddress:nft,tokenId:1n,price:parseEther("1")},0),
  log("OfferMade",{buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.1"),expiresAt:2000n},1),
  log("OfferMade",{buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.2"),expiresAt:3000n},2),
  log("OfferAccepted",{seller,buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.2"),marketplaceFee:4n,royaltyRecipient:seller,royaltyAmount:5n},3),
];
test("amounts retain exact native units and reject malformed, nonpositive or overprecise input",()=>{
  assert.equal(parseNativeAmount("0.1"),100000000000000000n);
  assert.equal(parseNativeAmount("1"),1000000000000000000n);
  assert.equal(parseNativeAmount("0.000000000000000001"),1n);
  for(const input of ["0","-1","1e3","NaN","Infinity","0.0000000000000000001","1.2.3","", "9".repeat(90)])assert.throws(()=>parseNativeAmount(input));
});
test("offer acceptance deactivates the listing and funded offer in stateless replay",()=>{
  const events=decodeMarketplaceLogs(137,[...logs].reverse());
  const before=replayEvents(events.slice(0,3));
  assert.equal(before.offers.length,1);assert.equal(before.offers[0].amount,parseEther("0.2").toString());
  const after=replayEvents(events);assert.equal(after.listings.length,0);assert.equal(after.offers.length,0);assert.equal(after.activity.at(-1).eventType,"offer_accepted");
});
test("cancellation removes only the matching buyer's offer",()=>{
  const events=decodeMarketplaceLogs(109,[logs[1],log("OfferMade",{buyer:seller,nftAddress:nft,tokenId:1n,amount:1n,expiresAt:3000n},2),log("OfferCanceled",{buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.1")},3)]);
  const replay=replayEvents(events);assert.equal(replay.offers.length,1);assert.equal(replay.offers[0].buyer.toLowerCase(),seller);
});
test("persistent SQL replay matches stateless offer settlement and is idempotent",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE marketplace_v3_listings(scope,id,chain_id,nft_address,token_id,seller,price,active,transaction_hash,created_block,updated_block,PRIMARY KEY(scope,id));
  CREATE TABLE marketplace_v3_activity(scope,id,chain_id,event_type,nft_address,token_id,seller,buyer,price,marketplace_fee,royalty_recipient,royalty_amount,transaction_hash,block_number,log_index,timestamp,PRIMARY KEY(scope,id));
  CREATE TABLE marketplace_v3_offers(scope,id,chain_id,nft_address,token_id,buyer,amount,expires_at,status,transaction_hash,block_number,PRIMARY KEY(scope,id));`);
  const adapter={prepare(sql){return {bind(...args){return {sql,args};}};}};
  const events=decodeMarketplaceLogs(137,logs).map(e=>({...e,timestamp:1000}));
  for(let run=0;run<2;run++)for(const statement of eventStatements(adapter,"137:market",events))db.prepare(statement.sql).run(...statement.args);
  assert.equal(db.prepare("SELECT active FROM marketplace_v3_listings").get().active,0);
  assert.equal(db.prepare("SELECT status FROM marketplace_v3_offers").get().status,"accepted");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM marketplace_v3_activity").get().count,4);
  assert.equal(db.prepare("SELECT timestamp FROM marketplace_v3_activity LIMIT 1").get().timestamp,1000);
  db.close();
});
test("cross-chain recency uses timestamps and cross-currency price sorting is disabled",()=>{
  const a={chainId:1,timestamp:200,blockNumber:10,price:"1"},b={chainId:137,timestamp:100,blockNumber:99999999,price:"1000000"};
  assert.equal(sortActivity([b,a],"recent","all")[0],a);
  assert.equal(sortActivity([b,a],"price-high","all")[0],a);
  const c={...a,price:"9007199254740993"},d={...a,price:"9007199254740992"};
  assert.equal(sortActivity([d,c],"price-high",1)[0],c);
});
test("transaction tracking rejects reverted, canceled and changed transactions, accepts fee bumps",async()=>{
  await assert.rejects(()=>confirmedReceipt({waitForTransactionReceipt:async()=>({status:"reverted"})},hash),/failed on chain/);
  for(const reason of ["cancelled","replaced"]){
    await assert.rejects(()=>confirmedReceipt({waitForTransactionReceipt:async({onReplaced})=>{onReplaced({reason,transaction:{hash}});return {status:"success"};}},hash),/canceled or replaced/);
  }
  const result=await confirmedReceipt({waitForTransactionReceipt:async({onReplaced})=>{onReplaced({reason:"repriced",transaction:{hash}});return {status:"success"};}},hash);
  assert.equal(result.status,"success");
});
test("mock offer mutation endpoints reject writes",async()=>{
  const {POST,PUT}=await loadModule("app/api/offers/route.ts");
  for(const method of [POST,PUT]){const response=await method(new Request("http://localhost/api/offers",{method:"POST",body:JSON.stringify({offerer:buyer,amount:"1",action:"accept"})}));assert.equal(response.status,405);assert.equal(response.headers.get("Allow"),"GET");}
});
