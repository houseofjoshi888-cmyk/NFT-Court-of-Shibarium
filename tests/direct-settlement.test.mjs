import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import solc from "solc";
import ganache from "ganache";
import { createPublicClient, createWalletClient, custom, parseEther } from "viem";

const fixture = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Unique {
 mapping(uint256 => address) public ownerOf;
 mapping(uint256 => address) public getApproved;
 mapping(address => mapping(address => bool)) public isApprovedForAll;
 function mint(address to, uint256 id) external { ownerOf[id] = to; }
 function approve(address to, uint256 id) external { require(msg.sender == ownerOf[id]); getApproved[id] = to; }
 function safeTransferFrom(address from, address to, uint256 id) external {
  require(ownerOf[id] == from && msg.sender == getApproved[id]); ownerOf[id] = to; delete getApproved[id];
 }
 function supportsInterface(bytes4 id) external pure returns (bool) { return id == 0x01ffc9a7; }
}
contract RejectingSeller {
 function list(address market, address nft, uint256 token, uint256 price) external {
  Unique(nft).approve(market, token);
  IMarket(market).listItem(nft, token, price);
 }
 function claim(address market) external { IMarket(market).withdrawProceeds(); }
 receive() external payable { revert("direct payment rejected"); }
}
contract Editions {
 mapping(address => mapping(uint256 => uint256)) public balanceOf;
 mapping(address => mapping(address => bool)) public isApprovedForAll;
 function supportsInterface(bytes4 id) external pure returns (bool) { return id == 0xd9b67a26 || id == 0x01ffc9a7; }
 function mint(address to, uint256 id, uint256 quantity) external { balanceOf[to][id] += quantity; }
 function setApprovalForAll(address operator, bool approved) external { isApprovedForAll[msg.sender][operator] = approved; }
 function safeTransferFrom(address from, address to, uint256 id, uint256 quantity, bytes calldata) external {
  require(msg.sender == from || isApprovedForAll[from][msg.sender]);
  balanceOf[from][id] -= quantity; balanceOf[to][id] += quantity;
 }
}
interface IMarket {
 function listItem(address nft, uint256 token, uint256 price) external;
 function withdrawProceeds() external;
}`;

const sources = Object.fromEntries(["NFTMarketplace.sol", "NFTMarketplaceV4.sol", "NFTMarketplaceV5.sol", "NFTMarketplaceV6.sol", "NFTMarketplaceV7.sol"].map(name => [name, { content: readFileSync(`contracts/${name}`, "utf8") }]));
sources["Fixture.sol"] = { content: fixture };
const output = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources, settings: { evmVersion: "shanghai", optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } }), { import: path => { try { return { contents: readFileSync(`node_modules/${path}`, "utf8") }; } catch { return { error: path }; } } }));
assert.deepEqual((output.errors ?? []).filter(error => error.severity === "error"), []);

test("V7 sends sale proceeds and 2% fee immediately, with a failed-payment withdrawal fallback", async () => {
  const provider = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 4 }, chain: { hardfork: "shanghai" } });
  const transport = custom(provider);
  const client = createPublicClient({ transport, pollingInterval: 10, cacheTime: 0 });
  const wallet = createWalletClient({ transport });
  const [seller, buyer, treasury] = await wallet.getAddresses();
  async function receipt(hash) { const result = await client.waitForTransactionReceipt({ hash, pollingInterval: 10 }); assert.equal(result.status, "success"); return result; }
  async function deploy(file, name, args = []) {
    const artifact = output.contracts[file][name];
    const result = await receipt(await wallet.deployContract({ account: seller, chain: null, abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, args, gas: 8000000n }));
    return { address: result.contractAddress, abi: artifact.abi };
  }
  async function write(target, account, functionName, args = [], value) {
    const { request } = await client.simulateContract({ ...target, account, functionName, args, value });
    return receipt(await wallet.writeContract({ ...request, gas: 1500000n, chain: null }));
  }
  const read = (target, functionName, args = []) => client.readContract({ ...target, functionName, args });
  try {
    const market = await deploy("NFTMarketplaceV7.sol", "HOJNFTMarketplaceV7", [treasury]);
    const nft = await deploy("Fixture.sol", "Unique");
    const rejectingSeller = await deploy("Fixture.sol", "RejectingSeller");
    assert.equal(await read(market, "marketplaceVersion"), 7n);
    await write(nft, seller, "mint", [seller, 1n]);
    await write(nft, seller, "approve", [market.address, 1n]);
    await write(market, seller, "listItem", [nft.address, 1n, parseEther("1")]);
    const sellerBefore = await client.getBalance({ address: seller });
    const treasuryBefore = await client.getBalance({ address: treasury });
    await write(market, buyer, "buyItem", [nft.address, 1n], parseEther("1"));
    assert.equal(await read(nft, "ownerOf", [1n]), buyer);
    assert.equal((await client.getBalance({ address: seller })) - sellerBefore, parseEther("0.98"));
    assert.equal((await client.getBalance({ address: treasury })) - treasuryBefore, parseEther("0.02"));
    assert.equal(await read(market, "getProceeds", [seller]), 0n);
    assert.equal(await read(market, "getProceeds", [treasury]), 0n);

    await write(nft, seller, "mint", [rejectingSeller.address, 2n]);
    await write(rejectingSeller, seller, "list", [market.address, nft.address, 2n, parseEther("1")]);
    await write(market, buyer, "buyItem", [nft.address, 2n], parseEther("1"));
    assert.equal(await read(nft, "ownerOf", [2n]), buyer);
    assert.equal(await read(market, "getProceeds", [rejectingSeller.address]), parseEther("0.98"));
    assert.equal(await read(market, "getProceeds", [treasury]), 0n);

    const editions = await deploy("Fixture.sol", "Editions");
    await write(editions, seller, "mint", [seller, 3n, 2n]);
    await write(editions, seller, "setApprovalForAll", [market.address, true]);
    await write(market, seller, "listEdition", [editions.address, 3n, 2n, parseEther("1")]);
    const editionSellerBefore = await client.getBalance({ address: seller });
    const editionTreasuryBefore = await client.getBalance({ address: treasury });
    await write(market, buyer, "buyEdition", [editions.address, 3n, seller, 1n, parseEther("1")], parseEther("1"));
    assert.equal(await read(editions, "balanceOf", [buyer, 3n]), 1n);
    assert.equal((await client.getBalance({ address: seller })) - editionSellerBefore, parseEther("0.98"));
    assert.equal((await client.getBalance({ address: treasury })) - editionTreasuryBefore, parseEther("0.02"));

    await write(nft, seller, "mint", [seller, 4n]);
    await write(nft, seller, "approve", [market.address, 4n]);
    const expiry = (await client.getBlock()).timestamp + 3600n;
    await write(market, buyer, "makeOffer", [nft.address, 4n, expiry], parseEther("1"));
    const offerSellerBefore = await client.getBalance({ address: seller });
    const offerTreasuryBefore = await client.getBalance({ address: treasury });
    await write(market, seller, "acceptOffer", [nft.address, 4n, buyer]);
    assert.equal(await read(nft, "ownerOf", [4n]), buyer);
    assert.equal((await client.getBalance({ address: seller })) - offerSellerBefore > parseEther("0.97"), true);
    assert.equal((await client.getBalance({ address: treasury })) - offerTreasuryBefore, parseEther("0.02"));
  } finally { await provider.disconnect(); }
});
