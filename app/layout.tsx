import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Mono, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "500", "600"] });
const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["300", "400", "500"] });

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
  return <html lang="en"><body className={`${serif.variable} ${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
