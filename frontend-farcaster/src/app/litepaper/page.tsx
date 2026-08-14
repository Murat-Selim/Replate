"use client";

import Link from "next/link";
import Shell from "@/components/Shell";

type Section = { title: string; body: string };

const sections: Section[] = [
  { title: "How Replate Works", body: "Receipt Upload -> OCR and Product Classification -> Health and Nutrition Score -> User-Signed Base Verification -> XP, Streaks, and Badges. The basic experience is designed to remain accessible without charging users for every receipt. After verification, users may optionally access Advanced Replate Intelligence for deeper analysis and personalized recommendations." },
  { title: "Replate Intelligence", body: "Replate plans to build a structured intelligence layer from verified grocery activity. Instead of monetizing raw personal receipt data, Replate focuses on privacy-conscious derived intelligence such as basket quality and diversity, nutritional patterns, behavioral trends, historical improvement, shopping consistency, personalized recommendations, aggregated consumer signals, and permissioned reputation. PostgreSQL becomes the intelligence and historical data layer while Base remains the verification, ownership, XP, badge, and rewards layer." },
  { title: "Premium Consumer Model", body: "Replate may offer advanced reports through x402-compatible USDC payments. Replate Intelligence+ is planned at 5 USDC for 30 days and may include advanced receipt analysis, personalized recommendations, 30/60/90-day trends, advanced weekly reports, premium quests, early feature access, premium profile benefits, and a proposed 1.5x XP multiplier on eligible verified activity." },
  { title: "x402 and AI Infrastructure", body: "The same intelligence engine can later serve AI agents, Web3 applications, and developers: AI Agent -> Replate API or MCP Tool -> x402 USDC Payment -> Replate Intelligence. Potential services include Basket Intelligence, Nutrition Intelligence, Behavioral Trend Analysis, Recommendation Intelligence, Aggregated Consumer Insights, and Permissioned Reputation Signals. x402 is the payment rail. Replate Intelligence is the product." },
  { title: "Economic Model", body: "Users contribute verified real-world activity and receive health feedback, progress, optional premium intelligence, and potential rewards. AI and Web3 applications gain access to structured real-world intelligence through pay-per-use services. Replate can generate revenue through Intelligence+ memberships, advanced analysis, x402 B2B APIs, MCP and AI-agent usage, sponsored programs, and premium ecosystem features. Part of future infrastructure revenue may support recurring reward pools." },
  { title: "Founder NFT", body: "Replate plans to explore 444 Founder NFTs with a 5 USDC mint price. Potential utility includes permanent Founder status, a Founder badge, early access, Founder-only quests, selected seasonal privileges, community benefits, and possible Intelligence+ perks. Founder NFTs are intended primarily as membership and utility assets, not guaranteed revenue-sharing products." },
  { title: "The Replate Flywheel", body: "More Users -> More Verified Receipts -> Better Behavioral History -> Better Replate Intelligence -> More Premium and AI Usage -> More x402 Revenue -> Larger Ecosystem Rewards -> More Users." },
  { title: "Vision", body: "Replate begins with a grocery receipt and evolves toward a Health and Nutrition Tracker, Onchain Healthy-Living Proof, Replate Intelligence, x402 AI Services, MCP Agent Infrastructure, and a Real-World Intelligence Network. Real behavior. Verified intelligence. Machine-to-machine commerce." },
];

export default function LitepaperPage() {
  return (
    <Shell>
      <article className="mx-auto max-w-4xl space-y-10">
        <header className="border-b border-brand-primary/15 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">Replate Litepaper</p>
              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Onchain proof of healthy living.</h1>
            </div>
            <Link href="/whitepaper" className="inline-flex shrink-0 rounded-2xl border border-brand-primary/25 px-5 py-3 text-sm font-black text-brand-primary">Read Whitepaper</Link>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-text/65">A concise overview of Replate's receipt intelligence, onchain progress, and future AI infrastructure.</p>
        </header>

        <section className="rounded-3xl border border-brand-primary/20 bg-brand-primary/5 p-6 sm:p-8">
          <p className="leading-8 text-brand-text/70">Replate is a receipt intelligence and rewards protocol for health-focused users in the Base and Farcaster ecosystems. Users upload grocery receipts, receive Health and Nutrition Scores, and verify progress on Base from their own wallet. Over time, Replate tracks XP, streaks, badges, and behavioral history.</p>
        </section>

        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-6 sm:p-7">
              <h2 className="text-lg font-black text-brand-primary">{section.title}</h2>
              <p className="mt-3 leading-8 text-brand-text/65">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap gap-3 border-t border-brand-primary/15 pt-6">
          <Link href="/whitepaper" className="inline-flex rounded-2xl bg-brand-primary px-6 py-3 font-black text-[#050806]">Read full Whitepaper</Link>
          <Link href="/verify-receipt" className="inline-flex rounded-2xl border border-brand-primary/20 px-6 py-3 font-black text-brand-primary">Verify a receipt</Link>
        </footer>
      </article>
    </Shell>
  );
}

