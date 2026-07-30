import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Web3Provider } from "./web3-provider";
import { GlobalFooter, GlobalHeader } from "./site-chrome";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "House of Joshi — Multichain NFT Marketplace",
    description: "A curated, non-custodial NFT marketplace across Ethereum, Shibarium, Polygon, Base, and Robinhood Chain.",
    openGraph: { title: "House of Joshi NFT Marketplace", description: "Curated works. Permanent provenance. Chain-specific settlement.", images: ["/og.png"], type: "website" },
    twitter: { card: "summary_large_image", title: "House of Joshi", description: "The Multichain NFT Marketplace", images: ["/og.png"] },
    icons: { icon: "/house-of-joshi.png", apple: "/house-of-joshi.png" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Web3Provider><GlobalHeader/>{children}<GlobalFooter/></Web3Provider></body></html>;
}
