"use client";

import { Bell, Check, Trash2, Wallet, TrendingUp, Gift, Heart } from "lucide-react";
import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications } from "@/lib/notifications";

type Notification = {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  read: boolean;
};

export default function NotificationsPage() {
  const { address } = useAccount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!address) return;

    const loadNotifications = () => {
      const loaded = getNotifications(address);
      setNotifications(loaded);
    };

    loadNotifications();

    // Listen for new notifications
    const handleNewNotification = () => {
      loadNotifications();
    };

    window.addEventListener("hoj-new-notification", handleNewNotification);
    window.addEventListener("storage", loadNotifications);

    return () => {
      window.removeEventListener("hoj-new-notification", handleNewNotification);
      window.removeEventListener("storage", loadNotifications);
    };
  }, [address]);

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "WELCOME":
        return <Wallet size={20} />;
      case "SALE":
        return <TrendingUp size={20} />;
      case "OFFER":
        return <Gift size={20} />;
      case "FAVORITE":
        return <Heart size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const handleMarkAsRead = (id: string) => {
    if (address) {
      markNotificationAsRead(address, id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const handleMarkAllAsRead = () => {
    if (address) {
      markAllNotificationsAsRead(address);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleClearAll = () => {
    if (address) {
      clearNotifications(address);
      setNotifications([]);
    }
  };

  if (!address) {
    return (
      <main className="royal-page">
        <section className="royal-page-hero">
          <div className="royal-badge">
            <Bell size={16} />
            <span>Notifications</span>
          </div>
          <h1>Your Royal Announcements</h1>
          <p>Connect your wallet to view your notifications.</p>
        </section>

        <section className="royal-content">
          <div className="royal-empty-state">
            <Wallet size={48} />
            <h2>Connect Your Wallet</h2>
            <p>Connect your wallet to view your notifications.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="royal-page">
      <section className="royal-page-hero">
        <div className="royal-badge">
          <Bell size={16} />
          <span>Notifications</span>
        </div>
        <h1>Your Royal Announcements</h1>
        <p>Stay updated on marketplace activity, offers, and collection updates.</p>
      </section>

      <section className="royal-content">
        <div className="royal-notifications-header">
          <div className="royal-notification-filters">
            <button 
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All ({notifications.length})
            </button>
            <button 
              className={filter === "unread" ? "active" : ""}
              onClick={() => setFilter("unread")}
            >
              Unread ({notifications.filter(n => !n.read).length})
            </button>
          </div>
          <div className="royal-notification-actions">
            {notifications.some(n => !n.read) && (
              <button onClick={handleMarkAllAsRead}>
                <Check size={16} /> Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={handleClearAll}>
                <Trash2 size={16} /> Clear all
              </button>
            )}
          </div>
        </div>

        {filteredNotifications.length > 0 ? (
          <div className="royal-notifications-list">
            {filteredNotifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`royal-notification-card ${notification.read ? 'read' : ''}`}
              >
                <div className="royal-notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="royal-notification-details">
                  <div className="royal-notification-header">
                    <span className="royal-notification-type">{notification.type}</span>
                    <small>{new Date(notification.timestamp).toLocaleString()}</small>
                  </div>
                  <p>{notification.message}</p>
                </div>
                {!notification.read && (
                  <button 
                    className="royal-notification-mark-read"
                    onClick={() => handleMarkAsRead(notification.id)}
                    aria-label="Mark as read"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="royal-empty-state">
            <Bell size={48} />
            <h2>No Notifications</h2>
            <p>You&apos;re all caught up! Check back soon for marketplace updates.</p>
          </div>
        )}
      </section>
    </main>
  );
}
