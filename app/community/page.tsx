"use client";

import { Users } from "lucide-react";

export default function CommunityPage() {
  return (
    <main className="royal-page">
      <section className="royal-page-hero">
        <div className="royal-badge">
          <Users size={16} />
          <span>Community</span>
        </div>
        <h1>Join the Kingdom</h1>
        <p>Connect with fellow collectors, creators, and enthusiasts.</p>
      </section>

      <section className="royal-content">
        <div className="royal-community-links">
          <a href="https://x.com/thehouseofjoshi" target="_blank" rel="noreferrer" className="royal-community-card">
            <div className="royal-community-icon">𝕏</div>
            <h3>Twitter/X</h3>
            <p>Follow for updates and announcements</p>
          </a>
          <a href="https://discord.com/invite/uH9zVeAwDu" target="_blank" rel="noreferrer" className="royal-community-card">
            <div className="royal-community-icon">Discord</div>
            <h3>Discord</h3>
            <p>Join our community server</p>
          </a>
          <a href="https://www.instagram.com/thehouseofjoshi" target="_blank" rel="noreferrer" className="royal-community-card">
            <div className="royal-community-icon">Instagram</div>
            <h3>Instagram</h3>
            <p>Visual content and behind the scenes</p>
          </a>
        </div>
      </section>
    </main>
  );
}
