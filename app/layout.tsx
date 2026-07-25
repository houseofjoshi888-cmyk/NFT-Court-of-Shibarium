import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./responsive.css";
import { Web3Provider } from "./web3-provider";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "HOJ NFT Marketplace",
    description: "HOJ NFT Marketplace — a curated, non-custodial NFT marketplace for Shibarium and beyond. Discover and acquire digital works settled in BONE.",
    openGraph: { title: "HOJ NFT Marketplace", description: "Curated works. Permanent provenance. Settlement in BONE.", images: ["/og.png"], type: "website" },
    twitter: { card: "summary_large_image", title: "HOJ NFT Marketplace", description: "HOJ NFT Marketplace — curated NFTs and on-chain provenance.", images: ["/og.png"] },
    icons: { icon: "/house-of-joshi.png", apple: "/house-of-joshi.png" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-VV75NFVYLR"></script>
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-VV75NFVYLR');` }} />
      </head>
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
