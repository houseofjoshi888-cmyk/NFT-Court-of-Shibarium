"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { formatEther, zeroAddress, type Address } from "viem";
import { TransactionStatus, useMarketplaceTransaction } from "@/app/components/use-marketplace-transaction";
import { ChainLogo } from "@/app/chain-logo";
import { marketplaceAbi } from "@/lib/marketplace-abi";
import { marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";

const chains = Object.values(marketplaceChains);
const houseTreasury = "0x6736d2eA9807297F0e56967361B9410854B86a5f";

function ProceedsCard({ chainId }: { chainId: MarketplaceChainId }) {
  const chain = marketplaceChains[chainId];
  const { address } = useAccount();
  const transaction = useMarketplaceTransaction(chainId);
  const { data, isLoading, isError, refetch, isRefetching } = useReadContract({
    address: chain.marketplaceAddress as Address,
    abi: marketplaceAbi,
    functionName: "getProceeds",
    args: [address ?? zeroAddress],
    chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });
  const { data: treasury, isError: treasuryError } = useReadContract({
    address: chain.marketplaceAddress as Address,
    abi: marketplaceAbi,
    functionName: "HOUSE_TREASURY",
    chainId,
  });
  const { data: feeBps, isError: feeError } = useReadContract({
    address: chain.marketplaceAddress as Address,
    abi: marketplaceAbi,
    functionName: "MARKETPLACE_FEE_BPS",
    chainId,
  });
  const settlementVerified = treasury?.toLowerCase() === houseTreasury.toLowerCase() && feeBps === 200n;

  async function withdraw() {
    if (!address || !data || data <= 0n || transaction.pending) return;
    const confirmed = await transaction.run("Withdrawal", async send => {
      await send({ address: chain.marketplaceAddress as Address, abi: marketplaceAbi, functionName: "withdrawProceeds" });
    });
    if (confirmed) void refetch();
  }

  return <article className="hoj-proceeds-card">
    <div className="hoj-proceeds-chain"><ChainLogo chainId={chainId}/><div><h2>{chain.name}</h2><small>{chain.currency} · House of Joshi marketplace</small></div></div>
    <p className="hoj-proceeds-verification">{settlementVerified ? "2% House fee · fee wallet verified" : treasuryError || feeError ? "Fee settings unavailable — check this contract on its explorer" : "Checking contract fee settings…"}</p>
    <div className="hoj-proceeds-amount"><span>AVAILABLE TO WITHDRAW</span><strong>{!address ? "—" : isLoading ? "Checking…" : isError ? "Unavailable" : `${formatEther(data ?? 0n)} ${chain.currency}`}</strong></div>
    <div className="hoj-proceeds-actions"><button type="button" onClick={() => void withdraw()} disabled={!address || isLoading || isError || !data || data === 0n || transaction.pending}>Withdraw to my wallet <ArrowUpRight size={16}/></button><button type="button" className="hoj-proceeds-refresh" onClick={() => void refetch()} disabled={!address || isRefetching} aria-label={`Refresh ${chain.name} balance`}><RefreshCw size={16}/></button></div>
    {isError && <p role="status">Could not read this contract right now. Try refreshing.</p>}
    {treasury && feeBps !== undefined && !settlementVerified && <p role="alert">This contract does not match the expected 2% House fee settings. Verify it before trading.</p>}
    <TransactionStatus transaction={transaction}/>
  </article>;
}

export default function WalletPage() {
  const { address } = useAccount();
  return <main className="hoj-proceeds-page">
    <header><span>MARKETPLACE WALLET</span><h1>Withdrawable balance</h1><p>These amounts are read from the marketplace contracts for your connected wallet. Each network has its own balance and withdrawal transaction.</p></header>
    {!address ? <div className="hoj-proceeds-connect"><Wallet size={24}/><h2>Connect your wallet</h2><p>Connect the wallet that earned the sale proceeds or holds a refundable offer.</p><ConnectButton.Custom>{({ openConnectModal }) => <button type="button" onClick={openConnectModal}>Connect wallet</button>}</ConnectButton.Custom></div> : <p className="hoj-proceeds-owner">Showing contract balances for {address.slice(0, 6)}…{address.slice(-4)}. Withdrawals go directly to this wallet.</p>}
    <section className="hoj-proceeds-grid" aria-label="Withdrawable balances by network">{chains.map(chain => chain.marketplaceStatus === "live" ? <ProceedsCard key={chain.id} chainId={chain.id as MarketplaceChainId}/> : <article className="hoj-proceeds-card" key={chain.id}><div className="hoj-proceeds-chain"><ChainLogo chainId={chain.id as MarketplaceChainId}/><div><h2>{chain.name}</h2><small>{chain.currency} · Coming soon</small></div></div><p>This marketplace is not live on {chain.name}. There is no active withdrawal here yet.</p></article>)}</section>
    <p className="hoj-proceeds-note">After a sale, the buyer receives the NFT. The contract credits the seller with the sale price minus the 2% House fee and any creator royalty; the seller then withdraws those proceeds to their wallet. The 2% fee is credited to the House treasury wallet and can only be withdrawn by that wallet. This page can withdraw credited balances and refundable offers, but cannot recover arbitrary or uncredited funds stuck in a deployed contract. Network gas is paid separately.</p>
  </main>;
}
