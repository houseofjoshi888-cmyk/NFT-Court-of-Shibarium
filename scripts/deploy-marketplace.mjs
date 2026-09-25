import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import solc from "solc";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { apeChain, base, cronos, mainnet, polygon, zora } from "viem/chains";

const shibarium = {
  id: 109,
  name: "Shibarium",
  nativeCurrency: { name: "BONE", symbol: "BONE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.shibarium.shib.io"] } },
};
const robinhood = {
  id: 4663,
  name: "Robinhood",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
};
const chains = new Map([[1, mainnet], [25, cronos], [109, shibarium], [137, polygon], [8453, base], [4663, robinhood], [7777777, zora], [33139, apeChain]]);
const chainId = Number(process.env.DEPLOY_CHAIN_ID);
const chain = chains.get(chainId);
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const rpcUrl = process.env.DEPLOY_RPC_URL ?? chain?.rpcUrls.default.http[0];

if (!chain) throw new Error("DEPLOY_CHAIN_ID must be 1, 25, 109, 137, 8453, 4663, 33139, or 7777777.");

const sourceFiles = ["NFTMarketplace.sol", "NFTMarketplaceV4.sol", "NFTMarketplaceV5.sol", "NFTMarketplaceV6.sol"];
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [
  `contracts/${name}`, { content: await readFile(resolve("contracts", name), "utf8") },
])));
const input = {
  language: "Solidity",
  sources,
  settings: {
    evmVersion: "shanghai",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), {
  import(path) {
    try {
      return { contents: requireSource(resolve("node_modules", path)) };
    } catch {
      return { error: `Import not found: ${path}` };
    }
  },
}));

const errors = (output.errors ?? []).filter(error => error.severity === "error");
if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join("\n"));

const artifact = output.contracts["contracts/NFTMarketplaceV6.sol"].HOJNFTMarketplaceV6;
if (process.env.COMPILE_ONLY === "1") {
  console.log(`HOJNFTMarketplaceV6 compiled for ${chain.name}.`);
  process.exit(0);
}
const treasury = process.env.FEE_TREASURY_ADDRESS;
if (!treasury) throw new Error("Set FEE_TREASURY_ADDRESS to the wallet that should receive the 2% marketplace fee.");
const treasuryAddress = getAddress(treasury);
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY to the funded deployer wallet's 0x-prefixed private key.");
}
const account = privateKeyToAccount(privateKey);
const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
const client = createPublicClient({ chain, transport: http(rpcUrl) });
const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: `0x${artifact.evm.bytecode.object}`,
  args: [treasuryAddress],
});
const receipt = await client.waitForTransactionReceipt({ hash });

console.log(JSON.stringify({
  chainId,
  chain: chain.name,
  deployer: account.address,
  marketplaceAddress: receipt.contractAddress,
  deploymentBlock: receipt.blockNumber.toString(),
  transactionHash: hash,
}, null, 2));

function requireSource(path) {
  return readFileSync(path, "utf8");
}
