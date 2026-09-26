"use client";

import { Shield, Settings, Globe, Coins, AlertTriangle, ToggleLeft, ToggleRight, Save, RefreshCw, Lock, Layout, Zap } from "lucide-react";
import { useAccount } from "wagmi";
import { useState, useMemo } from "react";
import { marketplaceChains } from "@/lib/marketplace-chains";
import { getAdminConfig, type AdminConfig } from "@/lib/admin-config";

// Admin wallet addresses (in production, this should be in a database or environment variable)
const ADMIN_WALLETS = [
  "0x69Bf308E5e30158072Cf9d2c6DE7b86F5Ae2f9B4", // Admin wallet
];

export default function AdminPage() {
  const { address } = useAccount();
  const loadedConfig = getAdminConfig();
  
  // Initialize contract addresses from marketplace-chains if config is empty
  const initialContractAddresses = Object.keys(loadedConfig.contractAddresses).length === 0
    ? Object.fromEntries(
        Object.entries(marketplaceChains)
          .filter(([, chain]) => chain.marketplaceAddress)
          .map(([id, chain]) => [Number(id), chain.marketplaceAddress])
      )
    : loadedConfig.contractAddresses;

  const isAdmin = useMemo(() => {
    return address ? ADMIN_WALLETS.includes(address.toLowerCase()) : false;
  }, [address]);

  const [config, setConfig] = useState<AdminConfig>({ ...loadedConfig, contractAddresses: initialContractAddresses });
  const [activeTab, setActiveTab] = useState<"contracts" | "platform" | "features" | "fees" | "ui">("contracts");
  const [saving, setSaving] = useState(false);
  const [changesMade, setChangesMade] = useState(false);

  const handleConfigChange = (key: keyof AdminConfig, value: string | number | boolean | Array<{ chainId: number; contract: string; name: string }>) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setChangesMade(true);
  };

  const handleContractAddressChange = (chainId: number, address: string) => {
    setConfig(prev => ({
      ...prev,
      contractAddresses: { ...prev.contractAddresses, [chainId]: address }
    }));
    setChangesMade(true);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      localStorage.setItem("hoj:admin-config", JSON.stringify(config));
      setChangesMade(false);
      alert("Configuration saved successfully!");
      
      // In production, this would save to database and potentially trigger contract updates
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      localStorage.removeItem("hoj:admin-config");
      window.location.reload();
    }
  };

  if (!address) {
    return (
      <main className="royal-page">
        <section className="royal-page-hero">
          <div className="royal-badge">
            <Shield size={16} />
            <span>Admin Panel</span>
          </div>
          <h1>Marketplace Administration</h1>
          <p>Connect your admin wallet to access the control panel.</p>
        </section>

        <section className="royal-content">
          <div className="royal-empty-state">
            <Lock size={48} />
            <h2>Admin Access Required</h2>
            <p>Connect your admin wallet to access the administration panel.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="royal-page">
        <section className="royal-page-hero">
          <div className="royal-badge">
            <Shield size={16} />
            <span>Admin Panel</span>
          </div>
          <h1>Marketplace Administration</h1>
          <p>Access restricted to authorized administrators only.</p>
        </section>

        <section className="royal-content">
          <div className="royal-empty-state">
            <Shield size={48} />
            <h2>Access Denied</h2>
            <p>Your wallet is not authorized to access the admin panel.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="royal-page">
      <section className="royal-page-hero">
        <div className="royal-badge">
          <Shield size={16} />
          <span>Admin Panel</span>
        </div>
        <h1>Marketplace Administration</h1>
        <p>Manage marketplace settings, contracts, and platform configuration.</p>
      </section>

      <section className="royal-content">
        <div className="royal-admin-header">
          <div className="royal-admin-status">
            <div className={`royal-status-indicator ${config.maintenanceMode ? 'maintenance' : 'operational'}`}>
              {config.maintenanceMode ? <AlertTriangle size={16} /> : <Zap size={16} />}
              <span>{config.maintenanceMode ? 'Maintenance Mode' : 'Operational'}</span>
            </div>
            <div className="royal-wallet-info">
              <span>Admin Wallet:</span>
              <code>{address.slice(0, 6)}…{address.slice(-4)}</code>
            </div>
          </div>
          <div className="royal-admin-actions">
            {changesMade && (
              <button 
                className="royal-primary-button"
                onClick={saveConfig}
                disabled={saving}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button 
              className="royal-secondary-button"
              onClick={resetConfig}
            >
              <RefreshCw size={16} />
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="royal-admin-tabs">
          <button 
            className={activeTab === "contracts" ? "active" : ""}
            onClick={() => setActiveTab("contracts")}
          >
            <Globe size={16} /> Contracts
          </button>
          <button 
            className={activeTab === "platform" ? "active" : ""}
            onClick={() => setActiveTab("platform")}
          >
            <Settings size={16} /> Platform
          </button>
          <button 
            className={activeTab === "features" ? "active" : ""}
            onClick={() => setActiveTab("features")}
          >
            <Zap size={16} /> Features
          </button>
          <button 
            className={activeTab === "fees" ? "active" : ""}
            onClick={() => setActiveTab("fees")}
          >
            <Coins size={16} /> Fees
          </button>
          <button 
            className={activeTab === "ui" ? "active" : ""}
            onClick={() => setActiveTab("ui")}
          >
            <Layout size={16} /> UI
          </button>
        </div>

        <div className="royal-admin-content">
          {activeTab === "contracts" && (
            <div className="royal-admin-section">
              <h2><Globe size={20} /> Contract Configuration</h2>
              <p>Manage deployed marketplace contract addresses across all supported chains.</p>
              
              <div className="royal-contract-config">
                {Object.entries(marketplaceChains).map(([id, chain]) => (
                  <div key={id} className="royal-contract-item">
                    <div className="royal-contract-info">
                      <span>{chain.name}</span>
                      <small>Chain ID: {id}</small>
                    </div>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={config.contractAddresses[Number(id)] || ""}
                      onChange={(e) => handleContractAddressChange(Number(id), e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Treasury Address</span>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={config.treasuryAddress}
                    onChange={(e) => handleConfigChange("treasuryAddress", e.target.value)}
                  />
                </label>
                <small>Address where marketplace fees are sent</small>
              </div>
            </div>
          )}

          {activeTab === "platform" && (
            <div className="royal-admin-section">
              <h2><Settings size={20} /> Platform Settings</h2>
              <p>Control platform-wide settings and operational modes.</p>
              
              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.maintenanceMode}
                    onChange={(e) => handleConfigChange("maintenanceMode", e.target.checked)}
                  />
                  <div>
                    <span>Maintenance Mode</span>
                    <small>Disable all marketplace operations</small>
                  </div>
                  {config.maintenanceMode ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.allowNewListings}
                    onChange={(e) => handleConfigChange("allowNewListings", e.target.checked)}
                  />
                  <div>
                    <span>Allow New Listings</span>
                    <small>Enable users to create new listings</small>
                  </div>
                  {config.allowNewListings ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.allowTrading}
                    onChange={(e) => handleConfigChange("allowTrading", e.target.checked)}
                  />
                  <div>
                    <span>Allow Trading</span>
                    <small>Enable buy/sell operations</small>
                  </div>
                  {config.allowTrading ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Max Listings Per User</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.maxListingsPerUser}
                    onChange={(e) => handleConfigChange("maxListingsPerUser", Number(e.target.value))}
                  />
                </label>
                <small>Maximum number of active listings per user</small>
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Max Offers Per User</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.maxOffersPerUser}
                    onChange={(e) => handleConfigChange("maxOffersPerUser", Number(e.target.value))}
                  />
                </label>
                <small>Maximum number of active offers per user</small>
              </div>
            </div>
          )}

          {activeTab === "features" && (
            <div className="royal-admin-section">
              <h2><Zap size={20} /> Feature Flags</h2>
              <p>Enable or disable marketplace features without redeployment.</p>
              
              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.enableOffers}
                    onChange={(e) => handleConfigChange("enableOffers", e.target.checked)}
                  />
                  <div>
                    <span>Enable Offers</span>
                    <small>Allow users to make offers on NFTs</small>
                  </div>
                  {config.enableOffers ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.enableAuctions}
                    onChange={(e) => handleConfigChange("enableAuctions", e.target.checked)}
                  />
                  <div>
                    <span>Enable Auctions</span>
                    <small>Allow timed auction listings</small>
                  </div>
                  {config.enableAuctions ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.enableBundles}
                    onChange={(e) => handleConfigChange("enableBundles", e.target.checked)}
                  />
                  <div>
                    <span>Enable Bundles</span>
                    <small>Allow listing multiple NFTs together</small>
                  </div>
                  {config.enableBundles ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.enableLaunchpad}
                    onChange={(e) => handleConfigChange("enableLaunchpad", e.target.checked)}
                  />
                  <div>
                    <span>Enable Launchpad</span>
                    <small>Show launchpad link in navigation</small>
                  </div>
                  {config.enableLaunchpad ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>
            </div>
          )}

          {activeTab === "fees" && (
            <div className="royal-admin-section">
              <h2><Coins size={20} /> Fee Configuration</h2>
              <p>Configure marketplace and royalty fees (in basis points, 100 = 1%).</p>
              
              <div className="royal-config-item">
                <label>
                  <span>Marketplace Fee (BPS)</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={config.marketplaceFeeBps}
                    onChange={(e) => handleConfigChange("marketplaceFeeBps", Number(e.target.value))}
                  />
                </label>
                <small>Current: {(config.marketplaceFeeBps / 100).toFixed(2)}%</small>
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Royalty Fee (BPS)</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={config.royaltyFeeBps}
                    onChange={(e) => handleConfigChange("royaltyFeeBps", Number(e.target.value))}
                  />
                </label>
                <small>Current: {(config.royaltyFeeBps / 100).toFixed(2)}%</small>
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Protocol Fee (BPS)</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={config.protocolFeeBps}
                    onChange={(e) => handleConfigChange("protocolFeeBps", Number(e.target.value))}
                  />
                </label>
                <small>Current: {(config.protocolFeeBps / 100).toFixed(2)}%</small>
              </div>
            </div>
          )}

          {activeTab === "ui" && (
            <div className="royal-admin-section">
              <h2><Layout size={20} /> UI Configuration</h2>
              <p>Manage featured collections and platform announcements.</p>
              
              <div className="royal-config-item">
                <label className="royal-toggle">
                  <input
                    type="checkbox"
                    checked={config.announcementEnabled}
                    onChange={(e) => handleConfigChange("announcementEnabled", e.target.checked)}
                  />
                  <div>
                    <span>Show Announcement Banner</span>
                    <small>Display announcement banner on homepage</small>
                  </div>
                  {config.announcementEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </label>
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Announcement Message</span>
                  <textarea
                    placeholder="Enter announcement message..."
                    value={config.announcementBanner}
                    onChange={(e) => handleConfigChange("announcementBanner", e.target.value)}
                    rows={3}
                  />
                </label>
                <small>Message to display in announcement banner</small>
              </div>

              <div className="royal-config-item">
                <label>
                  <span>Featured Collections</span>
                  <textarea
                    placeholder='{"chainId": 109, "contract": "0x...", "name": "Collection Name"}'
                    value={JSON.stringify(config.featuredCollections, null, 2)}
                    onChange={(e) => {
                      try {
                        handleConfigChange("featuredCollections", JSON.parse(e.target.value));
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    rows={5}
                  />
                </label>
                <small>JSON array of featured collections to highlight on homepage</small>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}