"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, midnightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const shibarium = defineChain({
  id: 109,
  name: "Shibarium",
  nativeCurrency: { name: "BONE", symbol: "BONE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.shibarium.shib.io"] } },
  blockExplorers: { default: { name: "ShibariumScan", url: "https://shibariumscan.io" } },
});

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const transport = { [shibarium.id]: http(shibarium.rpcUrls.default.http[0]) };

const config = walletConnectProjectId
  ? getDefaultConfig({
      appName: "House of Joshi",
      appDescription: "The NFT Court of Shibarium",
      projectId: walletConnectProjectId,
      chains: [shibarium],
      transports: transport,
      ssr: true,
    })
  : createConfig({
      chains: [shibarium],
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
