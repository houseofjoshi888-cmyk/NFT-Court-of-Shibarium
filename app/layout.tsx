import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Web3Provider } from "./web3-provider";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "House of Joshi — The NFT Court of Shibarium",
    description: "A curated, non-custodial NFT marketplace for Shibarium. Discover and acquire digital works settled in BONE.",
    openGraph: { title: "The NFT Court of Shibarium", description: "Curated works. Permanent provenance. Settlement in BONE.", images: ["/og.png"], type: "website" },
    twitter: { card: "summary_large_image", title: "House of Joshi", description: "The NFT Court of Shibarium", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Web3Provider>{children}</Web3Provider></body></html>;
}
