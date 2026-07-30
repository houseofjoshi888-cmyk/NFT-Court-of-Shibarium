type ChainLogoProps = {
  chainId: number;
  className?: string;
};

export function ChainLogo({ chainId, className = "" }: ChainLogoProps) {
  const common = {
    className: `official-chain-logo ${className}`.trim(),
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 32 32",
  } as const;

  if (chainId === 1) return (
    <svg {...common}>
      <path fill="#8A92B2" d="M16 2 7.8 15.6 16 20.3l8.2-4.7L16 2Z"/>
      <path fill="#62688F" d="m16 20.3-8.2-4.7L16 30V20.3Z"/>
      <path fill="#454A75" d="M16 30 24.2 15.6 16 20.3V30Z"/>
      <path fill="#fff" fillOpacity=".45" d="M16 2v18.3l8.2-4.7L16 2Z"/>
    </svg>
  );

  if (chainId === 109) return (
    <svg {...common}>
      <circle cx="16" cy="16" r="15" fill="#EF3F35"/>
      <path fill="#fff" d="m7.4 13.2 3.2-5.5 3.2 1.7h4.4l3.2-1.7 3.2 5.5-1.8 8.1-6.8 4.1-6.8-4.1-1.8-8.1Zm4.1-.9-1.2 2.1 1.3 5.2 4.4 2.7 4.4-2.7 1.3-5.2-1.2-2.1-1.7.9H13l-1.5-.9Zm.8 3.4 2.3.7-.8 1.8-1.5-2.5Zm7.4 0-1.5 2.5-.8-1.8 2.3-.7ZM14 19h4l-2 1.7-2-1.7Z"/>
    </svg>
  );

  if (chainId === 137) return (
    <svg {...common}>
      <circle cx="16" cy="16" r="15" fill="#8247E5"/>
      <path fill="#fff" d="M21.2 11.4a3.2 3.2 0 0 0-3.1 0l-2.2 1.3-1.5.8-2.2 1.3a1.6 1.6 0 0 1-1.6 0 1.6 1.6 0 0 1-.8-1.4v-2.5c0-.6.3-1.1.8-1.4a1.6 1.6 0 0 1 1.6 0l2.2 1.3 1.5-.9-2.2-1.3a4.7 4.7 0 0 0-4.6 0 4.6 4.6 0 0 0-2.3 4v1.7a4.6 4.6 0 0 0 2.3 4 4.7 4.7 0 0 0 4.6 0l2.2-1.3 1.5-.8 2.2-1.3a1.6 1.6 0 0 1 1.6 0c.5.3.8.8.8 1.4v2.5c0 .6-.3 1.1-.8 1.4a1.6 1.6 0 0 1-1.6 0l-2.2-1.3-1.5.9 2.2 1.3a4.7 4.7 0 0 0 4.6 0 4.6 4.6 0 0 0 2.3-4v-1.7a4.6 4.6 0 0 0-2.3-4Z"/>
    </svg>
  );

  if (chainId === 8453) return (
    <svg {...common}>
      <circle cx="16" cy="16" r="15" fill="#0052FF"/>
      <path fill="#fff" d="M15.8 25.3a9.3 9.3 0 1 1 8.9-12h-3.9a5.7 5.7 0 1 0 0 5.4h3.9a9.3 9.3 0 0 1-8.9 6.6Z"/>
    </svg>
  );

  if (chainId === 4663) return (
    <svg {...common}>
      <circle cx="16" cy="16" r="15" fill="#C3F53C"/>
      <path fill="#090A08" d="M8 21.8c3.4-1 5.6-3 6.9-5.8-2 .7-3.8.8-5.4.3 4.4-1.3 7.4-3.8 9-7.3 1.7 1.1 3.5 1.7 5.5 1.9-2.2 6.5-7.5 10.6-16 12.1v-1.2Z"/>
    </svg>
  );

  return <svg {...common}><circle cx="16" cy="16" r="14" fill="#C7A44A"/><circle cx="16" cy="16" r="5" fill="#090908"/></svg>;
}
