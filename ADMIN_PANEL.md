# Admin Panel - Complete Guide

## 🎯 Overview

The House of Joshi Marketplace includes a comprehensive admin panel that allows administrators to manage marketplace settings, contract configurations, and platform parameters without needing to redeploy code or modify smart contracts.

## 🔐 Access Control

### **Admin Wallet Configuration**

Admin access is restricted to specific wallet addresses. In the current implementation, admin wallets are defined in:

**Location**: `app/site-chrome.tsx` and `app/admin/page.tsx`

```typescript
const ADMIN_WALLETS = [
  "0x0000000000000000000000000000000000000000", // Replace with actual admin addresses
];
```

### **How to Add Admin Wallets**

1. Replace the placeholder address with your actual admin wallet addresses
2. Add multiple addresses if needed:
```typescript
const ADMIN_WALLETS = [
  "0x1234567890abcdef1234567890abcdef12345678", // Admin 1
  "0x9876543210fedcba9876543210fedcba98765432", // Admin 2
];
```

### **Production Security**

For production use, consider:
- Move admin wallet addresses to environment variables
- Implement database-based admin management
- Add role-based access control (super admin, moderator, etc.)
- Implement authentication beyond just wallet connection
- Add audit logging for admin actions

## 🎛️ Admin Panel Features

### **1. Contract Configuration Tab**

**Manage deployed marketplace contract addresses:**
- Update contract addresses for each supported chain
- Configure treasury address for fee collection
- Changes apply immediately to marketplace operations

**Supported Chains:**
- Shibarium (109)
- Base (8453)
- Polygon (137)
- Arc (5042)
- Zora (7777777)
- Cronos (25)
- ApeChain (33139)
- Ethereum (1) - Coming soon
- Robinhood (4663) - Coming soon

### **2. Platform Settings Tab**

**Control platform-wide operations:**
- **Maintenance Mode**: Disable all marketplace operations
- **Allow New Listings**: Enable/disable listing creation
- **Allow Trading**: Enable/disable buy/sell operations
- **Max Listings Per User**: Limit active listings per user
- **Max Offers Per User**: Limit active offers per user

### **3. Feature Flags Tab**

**Enable/disable marketplace features:**
- **Enable Offers**: Allow users to make offers on NFTs
- **Enable Auctions**: Allow timed auction listings
- **Enable Bundles**: Allow listing multiple NFTs together
- **Enable Launchpad**: Show launchpad link in navigation

### **4. Fee Configuration Tab**

**Configure marketplace fees (in basis points):**
- **Marketplace Fee**: Platform fee on transactions (default: 200 = 2%)
- **Royalty Fee**: Creator royalty percentage (default: 200 = 2%)
- **Protocol Fee**: Additional protocol fee (default: 200 = 2%)

**Note**: 100 basis points = 1%

### **5. UI Configuration Tab**

**Manage platform announcements and featured content:**
- **Announcement Banner**: Show/hide announcement banner
- **Announcement Message**: Custom announcement text
- **Featured Collections**: JSON array of collections to highlight on homepage

## 📦 Configuration Structure

The admin configuration is stored in `localStorage` with the key: `hoj:admin-config`

**Structure:**
```typescript
{
  contractAddresses: {
    109: "0x...", // Shibarium
    8453: "0x...", // Base
    // ... other chains
  },
  marketplaceFeeBps: 200,
  treasuryAddress: "0x...",
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
}
```

## 🔧 Configuration Library

The `lib/admin-config.ts` library provides helper functions to access admin configuration:

```typescript
import { 
  getAdminConfig,
  isMaintenanceMode,
  isFeatureEnabled,
  getMarketplaceFee,
  getTreasuryAddress,
  getContractAddress,
  getAnnouncement,
  getFeaturedCollections
} from "@/lib/admin-config";

// Check if maintenance mode is active
if (isMaintenanceMode()) {
  // Show maintenance message
}

// Check if a feature is enabled
if (isFeatureEnabled("enableOffers")) {
  // Show offer UI
}

// Get marketplace fee
const fee = getMarketplaceFee(); // Returns basis points

// Get contract address for a chain
const contract = getContractAddress(109); // Returns address or null

// Get announcement settings
const announcement = getAnnouncement();
if (announcement.enabled) {
  // Show announcement banner
}
```

## 🚀 Using Admin Configuration in Your Code

### **Example: Check Maintenance Mode Before Listing**

```typescript
import { isMaintenanceMode } from "@/lib/admin-config";

async function listNFT() {
  if (isMaintenanceMode()) {
    alert("Marketplace is under maintenance. Please try again later.");
    return;
  }
  
  // Proceed with listing
}
```

### **Example: Use Dynamic Contract Addresses**

```typescript
import { getContractAddress } from "@/lib/admin-config";

function getMarketplaceContract(chainId: number) {
  const address = getContractAddress(chainId);
  if (!address) {
    throw new Error("Marketplace not available on this chain");
  }
  return new ethers.Contract(address, abi, provider);
}
```

### **Example: Show Announcement Banner**

```typescript
import { getAnnouncement } from "@/lib/admin-config";

function AnnouncementBanner() {
  const announcement = getAnnouncement();
  
  if (!announcement.enabled || !announcement.message) {
    return null;
  }
  
  return (
    <div className="announcement-banner">
      {announcement.message}
    </div>
  );
}
```

### **Example: Apply Dynamic Fees**

```typescript
import { getMarketplaceFee } from "@/lib/admin-config";

function calculateMarketplaceFee(price: bigint): bigint {
  const feeBps = getMarketplaceFee();
  return (price * BigInt(feeBps)) / 10000n;
}
```

## 🎨 Admin Panel UI

### **Status Indicator**
- **Operational**: Green indicator with zap icon
- **Maintenance Mode**: Red indicator with alert icon

### **Navigation Tabs**
- Contracts
- Platform
- Features
- Fees
- UI

### **Toggle Switches**
- Visual toggle switches for boolean settings
- Green when enabled, gray when disabled
- Immediate visual feedback

### **Save System**
- "Save Changes" button appears when changes are made
- Saves to localStorage
- "Reset to Defaults" button to restore default settings

## 🔒 Security Considerations

### **Current Implementation**
- Admin access based on wallet address
- Settings stored in localStorage
- No authentication beyond wallet connection

### **Production Recommendations**

1. **Database Storage**
   - Store admin configuration in a database
   - Implement proper authentication
   - Add encryption for sensitive data

2. **Environment Variables**
   - Store admin wallet addresses in environment variables
   - Use secret management services (Vercel, AWS Secrets Manager)

3. **Multi-Factor Authentication**
   - Require additional verification for admin actions
   - Implement session timeouts
   - Add IP whitelisting

4. **Audit Logging**
   - Log all admin actions
   - Track who changed what and when
   - Implement change history

5. **Role-Based Access**
   - Different permission levels (super admin, moderator, etc.)
   - Granular control over what each admin can change

## 📊 Monitoring and Analytics

### **What to Monitor**
- Configuration changes
- Admin access attempts
- Feature flag usage
- Fee adjustments
- Maintenance mode activations

### **Suggested Metrics**
- Number of admin actions per day
- Most frequently changed settings
- Time spent in maintenance mode
- Feature flag adoption rates

## 🔄 Backup and Recovery

### **Current System**
- Configuration stored in localStorage
- Reset to defaults available
- No version history

### **Production Improvements**
- Implement configuration versioning
- Add backup/restore functionality
- Store change history
- Implement rollback capability

## 🎯 Best Practices

1. **Test Changes in Staging**
   - Always test configuration changes in a staging environment
   - Verify impact on marketplace operations
   - Get team approval before production changes

2. **Document Changes**
   - Keep a changelog of configuration updates
   - Document reasons for changes
   - Communicate changes to team

3. **Gradual Rollouts**
   - For feature flags, consider gradual rollouts
   - Monitor for issues after changes
   - Have rollback plan ready

4. **Regular Audits**
   - Review admin access list regularly
   - Remove access for inactive admins
   - Audit configuration for unnecessary changes

## 🚀 Future Enhancements

### **Planned Features**
- Database integration for configuration storage
- Role-based access control
- Audit logging and change history
- Configuration versioning and rollback
- Multi-environment support (dev/staging/prod)
- API endpoints for programmatic configuration
- Scheduled configuration changes
- Configuration validation and testing
- Import/export configuration
- Configuration templates

### **Advanced Features**
- A/B testing with feature flags
- Geographic-based configuration
- User-segmented feature flags
- Time-based scheduling
- Automated configuration suggestions
- AI-powered optimization recommendations

## 📞 Support

For issues with the admin panel:
- Check browser console for errors
- Verify admin wallet address is correct
- Ensure localStorage is enabled
- Clear cache if experiencing issues

## 🎯 Quick Start

1. **Add your admin wallet address** to the ADMIN_WALLETS array
2. **Connect your wallet** to the marketplace
3. **Navigate to `/admin`** (only visible to admin wallets)
4. **Configure settings** as needed
5. **Save changes** to apply immediately

The admin panel provides powerful control over your marketplace without requiring code changes or redeployments!