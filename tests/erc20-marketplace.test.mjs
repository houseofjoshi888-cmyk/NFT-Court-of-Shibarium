import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import solc from "solc";
import { createPublicClient, createWalletClient, custom, parseUnits, zeroAddress } from "viem";

const require = createRequire(import.meta.url);
const ganache = require("ganache");
const fixture = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract TestNFT {
  mapping(uint256 => address) public ownerOf;
  mapping(uint256 => address) public getApproved;
  mapping(address => mapping(address => bool)) public isApprovedForAll;
  address public royalty;
  constructor(address recipient) { royalty = recipient; }
  function mint(address to, uint256 id) external { ownerOf[id] = to; }
  function approve(address to, uint256 id) external { require(msg.sender == ownerOf[id]); getApproved[id] = to; }
  function safeTransferFrom(address from, address to, uint256 id) external {
    require(ownerOf[id] == from && (msg.sender == from || getApproved[id] == msg.sender));
    ownerOf[id] = to; delete getApproved[id];
  }
  function transferFrom(address from, address to, uint256 id) external {
    require(ownerOf[id] == from && (msg.sender == from || getApproved[id] == msg.sender));
    ownerOf[id] = to; delete getApproved[id];
  }
  function supportsInterface(bytes4 id) external pure returns (bool) { return id == 0x2a55205a || id == 0x80ac58cd || id == 0x01ffc9a7; }
  function royaltyInfo(uint256, uint256 price) external view returns (address, uint256) { return (royalty, price * 500 / 10_000); }
}
contract TestToken {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
  function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
  function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
  }
}`;
const sourceFiles = ["NFTMarketplace.sol", "NFTMarketplaceV4.sol", "NFTMarketplaceV5.sol", "NFTMarketplaceV6.sol"];
const sources = Object.fromEntries(sourceFiles.map(name => [`contracts/${name}`, { content: readFileSync(`contracts/${name}`, "utf8") }]));
sources["TestAssets.sol"] = { content: fixture };
const output = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources, settings: { evmVersion: "shanghai", optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } }), {
  import(path) { try { return { contents: readFileSync(`node_modules/${path}`, "utf8") }; } catch { return { error: `Missing ${path}` }; } },
}));
assert.deepEqual((output.errors ?? []).filter(error => error.severity === "error"), []);

test("V6 settles an ERC-721 sale in an approved six-decimal ERC-20", async () => {
  const provider = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 5 }, chain: { hardfork: "shanghai" } });
  const transport = custom(provider);
  const client = createPublicClient({ transport, pollingInterval: 10, cacheTime: 0 });
  const wallet = createWalletClient({ transport });
  const [seller, buyer, treasury, royalty, stranger] = await wallet.getAddresses();
  async function receipt(hash) { const result = await client.waitForTransactionReceipt({ hash, pollingInterval: 10 }); assert.equal(result.status, "success"); return result; }
  async function deploy(artifact, args = []) { return (await receipt(await wallet.deployContract({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, args, account: seller, gas: 12_000_000n, chain: null }))).contractAddress; }
  async function write(address, abi, account, functionName, args = []) {
    const { request } = await client.simulateContract({ address, abi, account, functionName, args });
    return receipt(await wallet.writeContract({ ...request, gas: await client.estimateContractGas(request), chain: null }));
  }
  const marketArtifact = output.contracts["contracts/NFTMarketplaceV6.sol"].HOJNFTMarketplaceV6;
  const nftArtifact = output.contracts["TestAssets.sol"].TestNFT;
  const tokenArtifact = output.contracts["TestAssets.sol"].TestToken;
  const market = await deploy(marketArtifact, [treasury]);
  const nft = await deploy(nftArtifact, [royalty]);
  const token = await deploy(tokenArtifact);
  const price = parseUnits("100", 6);
  const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
  const marketWrite = (account, functionName, args = []) => write(market, marketArtifact.abi, account, functionName, args);
  try {
    assert.equal(await read(market, marketArtifact.abi, "marketplaceVersion"), 6n);
    await write(nft, nftArtifact.abi, seller, "mint", [seller, 1n]);
    await write(nft, nftArtifact.abi, seller, "approve", [market, 1n]);
    await write(token, tokenArtifact.abi, seller, "mint", [buyer, price]);
    await assert.rejects(() => marketWrite(stranger, "setAllowedPaymentToken", [token, true]));
    await assert.rejects(() => marketWrite(treasury, "setAllowedPaymentToken", [zeroAddress, true]));
    await assert.rejects(() => marketWrite(seller, "listTokenItem", [nft, 1n, token, price]));
    await marketWrite(treasury, "setAllowedPaymentToken", [token, true]);
    await marketWrite(seller, "listTokenItem", [nft, 1n, token, price]);
    await assert.rejects(() => marketWrite(buyer, "buyTokenItem", [nft, 1n, token, price]));
    await write(token, tokenArtifact.abi, buyer, "approve", [market, price]);
    await assert.rejects(() => marketWrite(buyer, "buyTokenItem", [nft, 1n, token, price - 1n]));
    await marketWrite(treasury, "setAllowedPaymentToken", [token, false]);
    await assert.rejects(() => marketWrite(buyer, "buyTokenItem", [nft, 1n, token, price]));
    await marketWrite(treasury, "setAllowedPaymentToken", [token, true]);
    await marketWrite(buyer, "buyTokenItem", [nft, 1n, token, price]);
    assert.equal((await read(nft, nftArtifact.abi, "ownerOf", [1n])).toLowerCase(), buyer.toLowerCase());
    assert.equal(await read(token, tokenArtifact.abi, "balanceOf", [seller]), parseUnits("93", 6));
    assert.equal(await read(token, tokenArtifact.abi, "balanceOf", [treasury]), parseUnits("2", 6));
    assert.equal(await read(token, tokenArtifact.abi, "balanceOf", [royalty]), parseUnits("5", 6));
    assert.equal((await read(market, marketArtifact.abi, "getTokenListing", [nft, 1n])).price, 0n);
    await write(nft, nftArtifact.abi, seller, "mint", [seller, 2n]);
    await write(nft, nftArtifact.abi, seller, "approve", [market, 2n]);
    await marketWrite(seller, "listTokenItem", [nft, 2n, token, price]);
    await assert.rejects(() => marketWrite(stranger, "cancelTokenItem", [nft, 2n]));
    await marketWrite(seller, "cancelTokenItem", [nft, 2n]);
    assert.equal((await read(market, marketArtifact.abi, "getTokenListing", [nft, 2n])).price, 0n);
    await write(nft, nftArtifact.abi, seller, "mint", [seller, 3n]);
    await write(nft, nftArtifact.abi, seller, "approve", [market, 3n]);
    await marketWrite(seller, "listTokenItem", [nft, 3n, token, price]);
    await write(nft, nftArtifact.abi, seller, "transferFrom", [seller, stranger, 3n]);
    await assert.rejects(() => marketWrite(buyer, "buyTokenItem", [nft, 3n, token, price]));
  } finally { await provider.disconnect(); }
});
