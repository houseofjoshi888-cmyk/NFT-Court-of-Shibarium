import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./responsive.css";
import { Web3Provider } from "./web3-provider";
import { GlobalFooter, GlobalHeader } from "./site-chrome";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "House of Joshi — Multichain NFT Marketplace",
    description: "A curated, non-custodial NFT marketplace across Ethereum, Shibarium, Polygon, Base, Robinhood Chain, Zora, and ApeChain.",
    openGraph: { title: "House of Joshi NFT Marketplace", description: "Curated works. Permanent provenance. Chain-specific settlement.", images: [{ url:"/social-share-cover.png", width:1200, height:630, alt:"The House of Joshi Multichain NFT Marketplace" }], type: "website" },
    twitter: { card: "summary_large_image", title: "House of Joshi", description: "The Multichain NFT Marketplace", images: ["/social-share-cover.png"] },
    icons: { icon: "/house-of-joshi-logo.png", apple: "/house-of-joshi-logo.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#060606",
  colorScheme: "dark",
};

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
        <Web3Provider><GlobalHeader/>{children}<GlobalFooter/></Web3Provider>
      </body>
    </html>
  );
}
