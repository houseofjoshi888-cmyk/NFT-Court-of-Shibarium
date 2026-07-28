"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, midnightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { base, polygon } from "viem/chains";

export const shibarium = defineChain({
  id: 109,
  name: "Shibarium",
  nativeCurrency: { name: "BONE", symbol: "BONE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.shibarium.shib.io"] } },
  blockExplorers: { default: { name: "ShibariumScan", url: "https://shibariumscan.io" } },
});

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Chain Explorer", url: "https://robinhoodchain.blockscout.com" } },
});

// Reown / WalletConnect project ID. Deployments may override this public ID with
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID without changing the application code.
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "798a4c4e5870335d10cd2621358e0f77";
export const supportedChains = [shibarium, polygon, base, robinhood] as const;
const transport = {
  [shibarium.id]: http(shibarium.rpcUrls.default.http[0]),
  [polygon.id]: http(),
  [base.id]: http(),
  [robinhood.id]: http(robinhood.rpcUrls.default.http[0]),
};

const config = walletConnectProjectId
  ? getDefaultConfig({
      appName: "House of Joshi",
      appDescription: "A multichain NFT marketplace by House of Joshi",
      projectId: walletConnectProjectId,
      chains: supportedChains,
      transports: transport,
      ssr: true,
    })
  : createConfig({
      chains: supportedChains,
      connectors: [injected()],
      transports: transport,
      ssr: true,
    });

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={shibarium}
          modalSize="compact"
          theme={midnightTheme({ accentColor: "#c88632", accentColorForeground: "#11110f", borderRadius: "none", overlayBlur: "small" })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
