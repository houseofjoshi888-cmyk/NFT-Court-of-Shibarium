import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import solc from "solc";
import { DatabaseSync } from "node:sqlite";
import { loadModule } from "./load-module.mjs";
import { createPublicClient, createWalletClient, custom, parseEther, zeroAddress } from "viem";
const require=createRequire(import.meta.url);
let ganache;
try{ganache=require("ganache");}catch{ganache=require("../work/evm-runtime/node_modules/ganache");}
const fixture=`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface Receiver { function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4); }
contract TestNFT {
  mapping(uint256=>address) public ownerOf;
  mapping(uint256=>address) public getApproved;
  mapping(address=>mapping(address=>bool)) public isApprovedForAll;
  address public royalty;
  constructor(address recipient){royalty=recipient;}
  function mint(address owner,uint256 id) external {require(ownerOf[id]==address(0));ownerOf[id]=owner;}
  function approve(address operator,uint256 id) external {require(msg.sender==ownerOf[id]);getApproved[id]=operator;}
  function setApprovalForAll(address operator,bool approved) external {isApprovedForAll[msg.sender][operator]=approved;}
  function transferFrom(address from,address to,uint256 id) public {
    require(ownerOf[id]==from && to!=address(0));
    require(msg.sender==from || getApproved[id]==msg.sender || isApprovedForAll[from][msg.sender]);
    ownerOf[id]=to;delete getApproved[id];
  }
  function safeTransferFrom(address from,address to,uint256 id) external {
    transferFrom(from,to,id);
    if(to.code.length>0)require(Receiver(to).onERC721Received(msg.sender,from,id,"")==Receiver.onERC721Received.selector);
  }
  function supportsInterface(bytes4 id) external pure returns(bool){return id==0x2a55205a || id==0x80ac58cd || id==0x01ffc9a7;}
  function royaltyInfo(uint256,uint256 price) external view returns(address,uint256){return (royalty,price*500/10000);}
}
`;
const output=JSON.parse(solc.compile(JSON.stringify({language:"Solidity",sources:{"NFTMarketplace.sol":{content:readFileSync("contracts/NFTMarketplace.sol","utf8")},"TestNFT.sol":{content:fixture}},settings:{evmVersion:"shanghai",optimizer:{enabled:true,runs:200},outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}}),{import:path=>{try{return {contents:readFileSync(`node_modules/${path}`,"utf8")};}catch{return {error:`Missing ${path}`};}}}));
const errors=(output.errors??[]).filter(error=>error.severity==="error");assert.deepEqual(errors,[]);
const contract=output.contracts["NFTMarketplace.sol"].NFTMarketplace,nftContract=output.contracts["TestNFT.sol"].TestNFT;

test("marketplace contract lifecycle on a local EVM",async t=>{
  const provider=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:6},chain:{hardfork:"shanghai"}});
  const transport=custom(provider),publicClient=createPublicClient({transport,pollingInterval:10,cacheTime:0});
  const wallet=createWalletClient({transport});
  const [seller,buyer,newOwner,royalty,other]=await wallet.getAddresses();
  async function receipt(hash){const result=await publicClient.waitForTransactionReceipt({hash,pollingInterval:10});assert.equal(result.status,"success");return result;}
  async function write(address,abi,account,functionName,args=[],value){const {request}=await publicClient.simulateContract({address,abi,account,functionName,args,value});return receipt(await wallet.writeContract({...request,gas:await publicClient.estimateContractGas(request),chain:null}));}
  const market=(await receipt(await wallet.deployContract({abi:contract.abi,bytecode:`0x${contract.evm.bytecode.object}`,args:[other],account:seller,gas:8000000n,chain:null}))).contractAddress;
  const nft=(await receipt(await wallet.deployContract({abi:nftContract.abi,bytecode:`0x${nftContract.evm.bytecode.object}`,args:[royalty],account:seller,gas:8000000n,chain:null}))).contractAddress;
  const read=(functionName,args=[])=>publicClient.readContract({address:market,abi:contract.abi,functionName,args});
  const owner=()=>publicClient.readContract({address:nft,abi:nftContract.abi,functionName:"ownerOf",args:[1n]});
  const marketWrite=(account,name,args,value)=>write(market,contract.abi,account,name,args,value);
  const nftWrite=(account,name,args)=>write(nft,nftContract.abi,account,name,args);
  const treasury=await read("HOUSE_TREASURY");
  await nftWrite(seller,"mint",[seller,1n]);await nftWrite(seller,"approve",[market,1n]);
  let snapshot=await provider.request({method:"evm_snapshot",params:[]});
  async function scenario(name,fn){await t.test(name,async()=>{try{await fn();}finally{await provider.request({method:"evm_revert",params:[snapshot]});snapshot=await provider.request({method:"evm_snapshot",params:[]});}});}
  try{
    await scenario("lists, buys, credits exact fees and royalties, and withdraws once",async()=>{
      const price=parseEther("1");await marketWrite(seller,"listItem",[nft,1n,price]);await marketWrite(buyer,"buyItem",[nft,1n],price);
      assert.equal((await owner()).toLowerCase(),buyer.toLowerCase());
      assert.equal(await read("getProceeds",[seller]),parseEther("0.93"));assert.equal(await read("getProceeds",[royalty]),parseEther("0.05"));assert.equal(await read("getProceeds",[treasury]),parseEther("0.02"));
      await marketWrite(seller,"withdrawProceeds",[]);assert.equal(await read("getProceeds",[seller]),0n);await assert.rejects(()=>marketWrite(seller,"withdrawProceeds",[]));
    });
    await scenario("rejects incorrect payment and revoked approval without transferring ownership",async()=>{
      await marketWrite(seller,"listItem",[nft,1n,parseEther("1")]);
      await assert.rejects(()=>marketWrite(buyer,"buyItem",[nft,1n],parseEther("0.9")));
      await nftWrite(seller,"approve",[zeroAddress,1n]);await assert.rejects(()=>marketWrite(buyer,"buyItem",[nft,1n],parseEther("1")));
      assert.equal((await owner()).toLowerCase(),seller.toLowerCase());
    });
    await scenario("new owner can replace a stale listing after an external transfer",async()=>{
      await marketWrite(seller,"listItem",[nft,1n,parseEther("1")]);await nftWrite(seller,"transferFrom",[seller,newOwner,1n]);
      await assert.rejects(()=>marketWrite(buyer,"buyItem",[nft,1n],parseEther("1")));
      await nftWrite(newOwner,"approve",[market,1n]);await marketWrite(newOwner,"listItem",[nft,1n,parseEther("2")]);
      const listing=await read("getListing",[nft,1n]);assert.equal(listing.seller.toLowerCase(),newOwner.toLowerCase());assert.equal(listing.price,parseEther("2"));
      await assert.rejects(()=>marketWrite(seller,"cancelListing",[nft,1n]));await marketWrite(buyer,"buyItem",[nft,1n],parseEther("2"));
      assert.equal((await owner()).toLowerCase(),buyer.toLowerCase());
    });
    await scenario("only the recorded seller can cancel an active listing",async()=>{
      await marketWrite(seller,"listItem",[nft,1n,1n]);await assert.rejects(()=>marketWrite(other,"cancelListing",[nft,1n]));
      await marketWrite(seller,"cancelListing",[nft,1n]);assert.equal((await read("getListing",[nft,1n])).price,0n);
    });
    await scenario("replaced and canceled offers credit deposits without double withdrawal",async()=>{
      const expiry=(await publicClient.getBlock()).timestamp+86400n;
      await marketWrite(buyer,"makeOffer",[nft,1n,expiry],parseEther("0.1"));await marketWrite(buyer,"makeOffer",[nft,1n,expiry],parseEther("0.2"));
      assert.equal(await read("getProceeds",[buyer]),parseEther("0.1"));assert.equal((await read("getOffer",[nft,1n,buyer])).amount,parseEther("0.2"));
      await assert.rejects(()=>marketWrite(other,"cancelOffer",[nft,1n]));await marketWrite(buyer,"cancelOffer",[nft,1n]);
      assert.equal(await read("getProceeds",[buyer]),parseEther("0.3"));await marketWrite(buyer,"withdrawProceeds",[]);assert.equal(await read("getProceeds",[buyer]),0n);
    });
    await scenario("acceptance transfers NFT, clears listing and offer, and credits sale proceeds",async()=>{
      const expiry=(await publicClient.getBlock()).timestamp+86400n;
      await marketWrite(seller,"listItem",[nft,1n,parseEther("2")]);await marketWrite(buyer,"makeOffer",[nft,1n,expiry],parseEther("1"));
      await assert.rejects(()=>marketWrite(other,"acceptOffer",[nft,1n,buyer]));await marketWrite(seller,"acceptOffer",[nft,1n,buyer]);
      assert.equal((await owner()).toLowerCase(),buyer.toLowerCase());assert.equal((await read("getListing",[nft,1n])).price,0n);assert.equal((await read("getOffer",[nft,1n,buyer])).amount,0n);assert.equal(await read("getProceeds",[seller]),parseEther("0.93"));
      await assert.rejects(()=>marketWrite(seller,"acceptOffer",[nft,1n,buyer]));
    });
    await scenario("expired offers cannot settle but their deposits remain recoverable",async()=>{
      const expiry=(await publicClient.getBlock()).timestamp+3600n;await marketWrite(buyer,"makeOffer",[nft,1n,expiry],parseEther("0.1"));
      await provider.request({method:"evm_increaseTime",params:[3601]});await provider.request({method:"evm_mine",params:[]});
      await assert.rejects(()=>marketWrite(seller,"acceptOffer",[nft,1n,buyer]));await marketWrite(buyer,"cancelOffer",[nft,1n]);assert.equal(await read("getProceeds",[buyer]),parseEther("0.1"));
    });
    await scenario("batch checkout is atomic when one listing becomes invalid",async()=>{
      await nftWrite(seller,"mint",[seller,2n]);await nftWrite(seller,"approve",[market,2n]);
      await marketWrite(seller,"listItem",[nft,1n,parseEther("1")]);await marketWrite(seller,"listItem",[nft,2n,parseEther("1")]);
      await nftWrite(seller,"transferFrom",[seller,newOwner,2n]);
      await assert.rejects(()=>marketWrite(buyer,"batchBuy",[[nft,nft],[1n,2n]],parseEther("2")));assert.equal((await owner()).toLowerCase(),seller.toLowerCase());assert.equal(await read("getProceeds",[seller]),0n);
    });
    await scenario("real contract events produce matching persistent and stateless indexes",async()=>{
      const {loadMarketplaceIndex}=await loadModule("lib/marketplace-index.ts");
      const config={chain:{id:109,name:"Test",currency:"BONE",confirmations:0},address:market,deployBlock:"0",rpcUrl:"http://test-chain.invalid"};
      const db=new DatabaseSync(":memory:");
      const adapter={
        prepare(sql){return {bind(...args){return {sql,args,first:async()=>db.prepare(sql).get(...args)??null};},sql,args:[],first:async()=>db.prepare(sql).get()??null};},
        async batch(statements){db.exec("BEGIN");try{const results=statements.map(({sql,args=[]})=>{const statement=db.prepare(sql);return statement.columns().length?{results:statement.all(...args)}:(statement.run(...args),{results:[]});});db.exec("COMMIT");return results;}catch(error){db.exec("ROLLBACK");throw error;}}
      };
      const originalFetch=globalThis.fetch;
      globalThis.fetch=async(input,options)=>{
        assert.equal(new URL(String(input)).href,new URL(config.rpcUrl).href);
        const request=JSON.parse(options.body);
        try{return Response.json({jsonrpc:"2.0",id:request.id,result:await provider.request({method:request.method,params:request.params})});}
        catch(error){return Response.json({jsonrpc:"2.0",id:request.id,error:{code:-32000,message:error.message}});}
      };
      try{
        await marketWrite(seller,"listItem",[nft,1n,parseEther("1")]);
        const indexed=await loadMarketplaceIndex(config,adapter);assert.equal(indexed.listings.length,1);assert.ok(indexed.activity[0].timestamp>0);
        await nftWrite(seller,"transferFrom",[seller,newOwner,1n]);
        assert.equal((await loadMarketplaceIndex(config,adapter)).listings.length,0);
        await nftWrite(newOwner,"approve",[market,1n]);await marketWrite(newOwner,"listItem",[nft,1n,parseEther("2")]);
        const expiry=(await publicClient.getBlock()).timestamp+86400n;await marketWrite(buyer,"makeOffer",[nft,1n,expiry],parseEther("1"));
        const before=await loadMarketplaceIndex(config,adapter);assert.equal(before.offers.length,1);
        await marketWrite(newOwner,"acceptOffer",[nft,1n,buyer]);
        for(const database of [adapter,undefined]){
          const after=await loadMarketplaceIndex(config,database);assert.equal(after.listings.length,0);assert.equal(after.offers.length,0);assert.equal(after.activity[0].eventType,"offer_accepted");assert.equal(after.sync.caughtUp,true);
        }
      }finally{globalThis.fetch=originalFetch;db.close();}
    });
  }finally{await provider.disconnect();}
});
