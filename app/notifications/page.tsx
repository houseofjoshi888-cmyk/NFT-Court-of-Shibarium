"use client";

import { Bell } from "lucide-react";

export default function NotificationsPage() {
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
        <div className="royal-empty-state">
          <Bell size={48} />
          <h2>No Notifications</h2>
          <p>You&apos;re all caught up! Check back soon for marketplace updates.</p>
        </div>
      </section>
    </main>
  );
}
