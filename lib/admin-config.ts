// Admin configuration management
// In production, this should be stored in a database

export type AdminConfig = {
  // Contract Settings
  contractAddresses: Record<number, string>;
  marketplaceFeeBps: number;
  treasuryAddress: string;
  
  // Platform Settings
  maintenanceMode: boolean;
  allowNewListings: boolean;
  allowTrading: boolean;
  
  // Feature Flags
  enableOffers: boolean;
  enableAuctions: boolean;
  enableBundles: boolean;
  enableLaunchpad: boolean;
  
  // UI Settings
  featuredCollections: Array<{ chainId: number; contract: string; name: string }>;
  announcementBanner: string;
  announcementEnabled: boolean;
  
  // Rate Limits
  maxListingsPerUser: number;
  maxOffersPerUser: number;
  
  // Platform Fees
  royaltyFeeBps: number;
  protocolFeeBps: number;
};

const DEFAULT_CONFIG: AdminConfig = {
  contractAddresses: {},
  marketplaceFeeBps: 200, // 2%
  treasuryAddress: "",
  maintenanceMode: false,
  allowNewListings: true,
  allowTrading: true,
  enableOffers: true,
  enableAuctions: false,
  enableBundles: false,
  enableLaunchpad: true,
  featuredCollections: [],
  announcementBanner: "",
  announcementEnabled: false,
  maxListingsPerUser: 100,
  maxOffersPerUser: 50,
  royaltyFeeBps: 200,
  protocolFeeBps: 200,
};

export function getAdminConfig(): AdminConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem("hoj:admin-config");
    return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
  } catch (error) {
    console.error("Failed to load admin config:", error);
    return DEFAULT_CONFIG;
  }
}

export function isMaintenanceMode(): boolean {
  return getAdminConfig().maintenanceMode;
}

export function isFeatureEnabled(feature: keyof AdminConfig): boolean {
  const config = getAdminConfig();
  return Boolean(config[feature]);
}

export function getMarketplaceFee(): number {
  return getAdminConfig().marketplaceFeeBps;
}

export function getTreasuryAddress(): string {
  return getAdminConfig().treasuryAddress;
}

export function getContractAddress(chainId: number): string | null {
  const config = getAdminConfig();
  return config.contractAddresses[chainId] || null;
}

export function getAnnouncement(): { enabled: boolean; message: string } {
  const config = getAdminConfig();
  return {
    enabled: config.announcementEnabled,
    message: config.announcementBanner
  };
}

export function getFeaturedCollections(): Array<{ chainId: number; contract: string; name: string }> {
  return getAdminConfig().featuredCollections;
}