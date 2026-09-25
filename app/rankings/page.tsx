"use client";

import { TrendingUp } from "lucide-react";

export default function RankingsPage() {
  return (
    <main className="royal-page">
      <section className="royal-page-hero">
        <div className="royal-badge">
          <TrendingUp size={16} />
          <span>Rankings</span>
        </div>
        <h1>Marketplace Rankings</h1>
        <p>Discover the top collections, creators, and trending NFTs in the kingdom.</p>
      </section>

      <section className="royal-content">
        <div className="royal-rankings-list">
          <p>Rankings will appear when verified marketplace activity is available.</p>
        </div>
      </section>
    </main>
  );
}
