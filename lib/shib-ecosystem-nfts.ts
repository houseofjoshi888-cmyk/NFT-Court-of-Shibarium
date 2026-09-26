// Collection references from https://shib.io/ecosystem/nfts. These are
// marketplace listings available on HOJ marketplace.
export const shibEcosystemNfts = [
  {
    name: "SHIBOSHIS",
    chainId: 1,
    contract: "0x11450058d796b02eb53e65374be59cff65d3fe7f",
    source: "https://opensea.io/collection/theshiboshis",
    status: "live",
  },
  {
    name: "SHEboshis",
    chainId: 1,
    contract: "0x7b463415d67b013d5f1106fd3df048973bc214dd",
    source: "https://opensea.io/collection/sheboshis",
    status: "live",
  },
  {
    name: "The SHIB Magazine Covers",
    chainId: 109,
    contract: "0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002",
    source: "https://magazine.shib.io/nfts/",
    status: "live",
  },
] as const;
