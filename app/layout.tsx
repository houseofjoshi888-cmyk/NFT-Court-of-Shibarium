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
    icons: { icon: "/house-of-joshi.png", apple: "/house-of-joshi.png" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
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
