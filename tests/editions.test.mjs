import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import solc from "solc";
import ganache from "ganache";
import { createPublicClient, createWalletClient, custom, parseEther } from "viem";
import { loadModule } from "./load-module.mjs";

const fixture=`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Editions {
 mapping(address=>mapping(uint256=>uint256)) public balanceOf;
 mapping(address=>mapping(address=>bool)) public isApprovedForAll;
 function supportsInterface(bytes4 id) external pure returns(bool){return id==0xd9b67a26||id==0x01ffc9a7;}
 function mint(address who,uint256 id,uint256 quantity) external {balanceOf[who][id]+=quantity;}
 function setApprovalForAll(address operator,bool approved) external {isApprovedForAll[msg.sender][operator]=approved;}
 function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes calldata) external {
  require(msg.sender==from||isApprovedForAll[from][msg.sender]);require(to!=address(0));
  balanceOf[from][id]-=amount;balanceOf[to][id]+=amount;
 }
}
contract Unique {
 mapping(uint256=>address) public ownerOf;
 mapping(uint256=>address) public getApproved;
 mapping(address=>mapping(address=>bool)) public isApprovedForAll;
 function supportsInterface(bytes4 id) external pure returns(bool){return id==0x80ac58cd||id==0x01ffc9a7;}
 function mint(address who,uint256 id) external {require(ownerOf[id]==address(0));ownerOf[id]=who;}
 function approve(address operator,uint256 id) external {require(msg.sender==ownerOf[id]);getApproved[id]=operator;}
 function safeTransferFrom(address from,address to,uint256 id) external {
  require(ownerOf[id]==from&&to!=address(0));require(msg.sender==from||getApproved[id]==msg.sender||isApprovedForAll[from][msg.sender]);
  ownerOf[id]=to;delete getApproved[id];
 }
}`;
const sources=Object.fromEntries(["NFTMarketplace.sol","NFTMarketplaceV4.sol","NFTMarketplaceV5.sol"].map(name=>[name,{content:readFileSync(`contracts/${name}`,"utf8")}]));
sources["Fixture.sol"]={content:fixture};
const output=JSON.parse(solc.compile(JSON.stringify({language:"Solidity",sources,settings:{evmVersion:"shanghai",optimizer:{enabled:true,runs:200},outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}}),{import:path=>{try{return {contents:readFileSync(`node_modules/${path}`,"utf8")};}catch{return {error:path};}}}));
assert.deepEqual((output.errors??[]).filter(error=>error.severity==="error"),[]);

test("V5 edition and unique-token trading on an isolated local EVM",async()=>{
 const provider=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:4},chain:{hardfork:"shanghai"}});
 const transport=custom(provider),client=createPublicClient({transport,pollingInterval:10,cacheTime:0}),wallet=createWalletClient({transport});
 const [seller,other,buyer,treasuryAddress]=await wallet.getAddresses();
 async function receipt(hash){const value=await client.waitForTransactionReceipt({hash,pollingInterval:10});assert.equal(value.status,"success");return value;}
 async function deploy(file,name,args=[]){const artifact=output.contracts[file][name];const {contractAddress}=await receipt(await wallet.deployContract({account:seller,chain:null,abi:artifact.abi,bytecode:`0x${artifact.evm.bytecode.object}`,args,gas:8000000n}));return {address:contractAddress,abi:artifact.abi};}
 async function write(target,account,functionName,args=[],value){const {request}=await client.simulateContract({...target,account,functionName,args,value});return receipt(await wallet.writeContract({...request,gas:await client.estimateContractGas(request),chain:null}));}
 const read=(target,functionName,args=[])=>client.readContract({...target,functionName,args});
 try {
  const market=await deploy("NFTMarketplaceV5.sol","HOJNFTMarketplace",[treasuryAddress]),editions=await deploy("Fixture.sol","Editions"),unique=await deploy("Fixture.sol","Unique");
  assert.equal(await read(market,"marketplaceVersion"),5n);
  for(const who of [seller,other]){await write(editions,who,"mint",[who,1n,10n]);await write(editions,who,"setApprovalForAll",[market.address,true]);await write(market,who,"listEdition",[editions.address,1n,5n,parseEther("1")]);}
  await assert.rejects(()=>write(market,seller,"listEdition",[editions.address,1n,11n,1n]));
  await assert.rejects(()=>write(market,buyer,"buyEdition",[editions.address,1n,seller,6n,parseEther("1")],parseEther("6")));
  await assert.rejects(()=>write(market,buyer,"buyEdition",[editions.address,1n,seller,1n,parseEther("2")],parseEther("2")));
  await write(market,buyer,"buyEdition",[editions.address,1n,seller,2n,parseEther("1")],parseEther("2"));
  assert.equal(await read(editions,"balanceOf",[buyer,1n]),2n);
  assert.equal((await read(market,"getEditionListing",[editions.address,1n,seller])).quantity,3n);
  assert.equal((await read(market,"getEditionListing",[editions.address,1n,other])).quantity,5n);
  const expiry=(await client.getBlock()).timestamp+86400n;
  await write(market,buyer,"makeEditionOffer",[editions.address,1n,2n,expiry],parseEther("0.4"));
  await write(market,buyer,"makeEditionOffer",[editions.address,1n,2n,expiry],parseEther("0.6"));
  assert.equal(await read(market,"getProceeds",[buyer]),parseEther("0.4"));
  await write(market,other,"acceptEditionOffer",[editions.address,1n,buyer]);
  assert.equal(await read(editions,"balanceOf",[buyer,1n]),4n);
  assert.equal((await read(market,"getEditionOffer",[editions.address,1n,buyer])).amount,0n);
  assert.equal((await read(market,"getEditionListing",[editions.address,1n,other])).quantity,5n);
  await write(market,buyer,"makeEditionOffer",[editions.address,1n,1n,expiry],parseEther("0.3"));
  await write(market,buyer,"cancelEditionOffer",[editions.address,1n]);
  assert.equal(await read(market,"getProceeds",[buyer]),parseEther("0.7"));
  const treasury=await read(market,"HOUSE_TREASURY");
  assert.equal(await read(market,"getProceeds",[treasury]),parseEther("0.052"));
  assert.equal(await read(market,"getProceeds",[seller]),parseEther("1.96"));
  await write(editions,seller,"setApprovalForAll",[market.address,false]);
  await assert.rejects(()=>write(market,buyer,"buyEdition",[editions.address,1n,seller,1n,parseEther("1")],parseEther("1")));
  await write(market,seller,"cancelEdition",[editions.address,1n]);
  assert.equal((await read(market,"getEditionListing",[editions.address,1n,seller])).quantity,0n);
  assert.equal((await read(market,"getEditionListing",[editions.address,1n,other])).quantity,5n);
  await write(unique,seller,"mint",[seller,1n]);await write(unique,seller,"approve",[market.address,1n]);
  await write(market,seller,"listItem",[unique.address,1n,1n]);
  await assert.rejects(()=>write(market,other,"updateListing",[unique.address,1n,2n]));
  await write(market,seller,"updateListing",[unique.address,1n,2n]);
  assert.equal((await read(market,"getListing",[unique.address,1n])).price,2n);
  await write(market,buyer,"buyItem",[unique.address,1n],2n);
  assert.equal((await read(unique,"ownerOf",[1n])).toLowerCase(),buyer.toLowerCase());
  const {decodeMarketplaceLogs,replayEvents,eventStatements}=await loadModule("lib/marketplace-index.ts");
  const logs=await client.request({method:"eth_getLogs",params:[{address:market.address,fromBlock:"0x0",toBlock:"latest"}]});
  const events=decodeMarketplaceLogs(8453,logs),replay=replayEvents(events);
  assert.equal(replay.listings.length,1);assert.equal(replay.listings[0].seller.toLowerCase(),other.toLowerCase());assert.equal(replay.listings[0].quantity,"5");
  const {DatabaseSync}=await import("node:sqlite");const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE marketplace_v4_editions(scope,id,chain_id,nft_address,token_id,seller,price,quantity,transaction_hash,created_block,updated_block,PRIMARY KEY(scope,id)); CREATE TABLE marketplace_v5_edition_offers(scope,id,chain_id,nft_address,token_id,buyer,amount,quantity,expires_at,status,transaction_hash,block_number,PRIMARY KEY(scope,id)); CREATE TABLE marketplace_v3_activity(scope,id,chain_id,event_type,nft_address,token_id,seller,buyer,price,marketplace_fee,royalty_recipient,royalty_amount,transaction_hash,block_number,log_index,timestamp,PRIMARY KEY(scope,id));");
  const adapter={prepare(sql){return {bind(...values){return {sql,values};}};}};
  for(let repeat=0;repeat<2;repeat++)for(const statement of eventStatements(adapter,"test",events.filter(event=>event.tokenType==="ERC-1155")))db.prepare(statement.sql).run(...statement.values);
  const rows=db.prepare("SELECT * FROM marketplace_v4_editions WHERE quantity!='0'").all();assert.equal(rows.length,1);assert.equal(rows[0].quantity,"5");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM marketplace_v5_edition_offers WHERE status='active'").get().n,0);
  db.close();
 }finally{await provider.disconnect();}
});

test("durable index adapter survives restart and rolls back failed batches",async()=>{
 const {mkdtempSync,rmSync}=await import("node:fs");const {tmpdir}=await import("node:os");const {join}=await import("node:path");
 const directory=mkdtempSync(join(tmpdir(),"hoj-index-test-"));
 const {createLocalMarketplaceDb}=await loadModule("lib/local-marketplace-db.ts");
 try{
  const db=createLocalMarketplaceDb(join(directory,"index.sqlite"));
  await db.batch([db.prepare("CREATE TABLE cursor(id TEXT PRIMARY KEY, block INTEGER)"),db.prepare("INSERT INTO cursor VALUES (?,?)").bind("base",123)]);
  const restarted=createLocalMarketplaceDb(join(directory,"index.sqlite"));assert.equal((await restarted.prepare("SELECT block FROM cursor WHERE id=?").bind("base").first()).block,123);
  await assert.rejects(()=>db.batch([db.prepare("UPDATE cursor SET block=999"),db.prepare("INSERT INTO missing_table VALUES (1)")]));
  assert.equal((await restarted.prepare("SELECT block FROM cursor").first()).block,123);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test("transaction failures have actionable messages",async()=>{
 const {transactionError}=await loadModule("lib/transaction-errors.ts");
 assert.match(transactionError(new Error("User rejected the request")),/canceled in your wallet/);
 assert.match(transactionError(new Error("PriceChanged()")),/price changed/);
 assert.match(transactionError(new Error("insufficient funds")),/network gas fee/);
});
