type ChainLogoProps = {
  chainId: number;
  className?: string;
};

const officialLogoSources: Record<number, string> = {
  1: "https://ethereum.org/images/assets/svgs/eth-diamond-glyph.svg",
  109: "https://docs.shib.io/shib-docs-logo.svg",
  137: "https://polygon.technology/favicon.svg",
  8453: "/base-square-blue.svg",
  25: "/cronos-chain-logo.png",
  4663: "https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/feather-light.svg",
  33139: "https://apechain.com/favicon.ico",
  7777777: "https://zora.co/favicon.ico",
  5042: "https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png",
};

export function ChainLogo({ chainId, className = "" }: ChainLogoProps) {
  const source = officialLogoSources[chainId];
  if (!source) return <span className={`official-chain-logo official-chain-logo-fallback ${className}`.trim()} aria-hidden="true"/>;

  return (
    <span className={`official-chain-logo official-chain-${chainId} ${className}`.trim()} aria-hidden="true">
      {/* Chain marks use official-site assets or the supplied Cronos logo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt=""/>
    </span>
  );
}
