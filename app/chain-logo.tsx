type ChainLogoProps = {
  chainId: number;
  className?: string;
};

const officialLogoSources: Record<number, string> = {
  1: "https://ethereum.org/images/assets/svgs/eth-diamond-glyph.svg",
  109: "https://docs.shib.io/shib-docs-logo.svg",
  137: "https://cdn.prod.website-files.com/637359c81e22b715cec245ad/66273f100889f2489acb2d8e_Polygon%20Logo%20Complete%20White.svg",
  8453: "/base-square-blue.svg",
  4663: "https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/feather-light.svg",
  33139: "https://apechain.com/favicon.ico",
  7777777: "https://zora.co/favicon.ico",
};

export function ChainLogo({ chainId, className = "" }: ChainLogoProps) {
  const source = officialLogoSources[chainId];
  if (!source) return <span className={`official-chain-logo official-chain-logo-fallback ${className}`.trim()} aria-hidden="true"/>;

  return (
    <span className={`official-chain-logo official-chain-${chainId} ${className}`.trim()} aria-hidden="true">
      {/* These files are served by each network's official brand or documentation site. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt=""/>
    </span>
  );
}
