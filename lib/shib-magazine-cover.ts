export const SHIB_MAGAZINE_CONTRACT = "0x007bbf85988caf18cf4222c9214e4fa019b3e002";

type Cover = { edition: number; imageUrl: string; articleUrl: string };

export function shibMagazineEdition(chainId: number, contract: string, tokenId: string) {
  if (chainId !== 109 || contract.toLowerCase() !== SHIB_MAGAZINE_CONTRACT || !/^\d+$/.test(tokenId)) return null;
  // The magazine mints up to 3,000 serials per edition; e.g. #330923 is edition 33.
  const id = BigInt(tokenId);
  const edition = id / 10_000n;
  if (edition > 1_000n || id % 10_000n >= 3_000n) return null;
  return Number(edition === 0n ? 1n : edition);
}

export function parseShibMagazineCovers(html: string): Cover[] {
  const cards = new Map<string, { imageUrl: string; articleUrl: string }>();
  const pattern = /<div class="gcarousel_item"[\s\S]*?<div class="item_img"[\s\S]*?<a href="([^"]+)"[^>]*>\s*<img[^>]*\bsrc="([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    try {
      const article = new URL(match[1]);
      const image = new URL(match[2]);
      if (article.origin !== "https://magazine.shib.io" || image.origin !== article.origin || !image.pathname.startsWith("/wp-content/uploads/")) continue;
      cards.set(article.href, { articleUrl: article.href, imageUrl: image.href });
    } catch {
      // Ignore malformed external links on the publisher page.
    }
  }
  const ordered = [...cards.values()];
  // Official edition carousel is newest first and includes the first edition.
  return ordered.map((cover, index) => ({ ...cover, edition: ordered.length - index }));
}

export async function officialShibMagazineCover(edition: number, refresh = false) {
  const response = await fetch("https://magazine.shib.io/nfts/", {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(12_000),
    ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 * 60 * 6 } }),
  });
  if (!response.ok) throw new Error(`Magazine covers returned ${response.status}`);
  const cover = parseShibMagazineCovers(await response.text()).find(item => item.edition === edition);
  if (!cover) throw new Error("Edition cover was not found on the official magazine site");
  return cover;
}
