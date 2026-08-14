"use client";

import Link from "next/link";
import Shell from "@/components/Shell";

type Status = "Live" | "Planned" | "Strategy";
type Section = { title: string; status: Status; body: string };

const sections: Section[] = [
  { title: "1. Current product", status: "Live", body: "Users upload grocery receipts and provide household context. Google Cloud Vision extracts receipt text; Replate removes totals, payment lines, and recognized non-food items, then normalizes and classifies products as healthy, unhealthy, or neutral. Users receive Health and Nutrition Scores, review the result, sign an EIP-712 message, and submit the verification transaction from their wallet. A validator-relayed gasless path also exists in the backend." },
  { title: "2. Scoring and onchain verification", status: "Live", body: "The Health Score gives full weight to healthy products, partial weight to neutral products, and zero weight to unhealthy products. The Nutrition Score compares fruit-and-vegetable grams with an approximate 300g-per-person-per-day reference adjusted for household size and days covered. Base stores aggregate scores, item counts, grams, household size, points, timestamp, and receipt hash; raw images, OCR text, product names, and store names remain offchain. Scoring is informational, not medical advice." },
  { title: "3. XP, streaks, and badges", status: "Live", body: "Verified receipts produce XP and weekly progress. Daily check-ins use a separate XP and streak mechanic. A Replate Badge NFT can be minted when defined health and nutrition thresholds are reached. These mechanics reward consistency rather than perfection." },
  { title: "4. Privacy and current data handling", status: "Live", body: "Replate is designed to keep detailed receipt content offchain and does not intend to retain raw images or full OCR text longer than necessary. OCR, normalization, and classification may be inaccurate for blurry, damaged, multilingual, or unusual receipts. Wallet addresses and aggregate activity remain publicly visible on Base, so onchain activity is pseudonymous rather than fully anonymous." },
  { title: "5. Replate Intelligence data layer", status: "Planned", body: "Replate plans to build a PostgreSQL-based intelligence layer alongside the Base contracts. The pipeline is Raw Receipt -> Normalized Data -> Derived Features -> Behavioral History -> Replate Intelligence. Potential intelligence includes basket diversity, processed-food ratio, protein diversity, fruit-and-vegetable quality, household coverage, 30/60/90-day trends, historical improvement, shopping consistency, personalized recommendations, aggregate consumer signals, and permissioned reputation. PostgreSQL handles normalization, history, aggregation, and intelligence while Base remains the verification and rewards layer." },
  { title: "6. Premium consumer model", status: "Planned", body: "The basic experience is intended to remain accessible without charging for every receipt. After verification, users may purchase advanced intelligence through x402-compatible USDC payments. Replate Intelligence+ is proposed at 5 USDC for 30 days and may include advanced analysis, recommendations, historical trends, premium quests, early access, and a proposed 1.5x XP multiplier on eligible verified activity." },
  { title: "7. x402, MCP, and AI infrastructure", status: "Planned", body: "The same Replate Intelligence engine may serve users, AI agents, Web3 applications, and developers. The planned flow is AI Agent or Web3 Application -> Replate API or MCP Tool -> x402 USDC Payment -> Replate Intelligence. Potential services include Basket Intelligence, Nutrition Intelligence, Behavioral Trend Analysis, Recommendation Intelligence, Aggregated Consumer Insights, and Permissioned Reputation Signals. x402 is the payment rail; Replate Intelligence is the product." },
  { title: "8. Founder NFT and sponsored ecosystem", status: "Planned", body: "Replate plans to explore a limited collection of 444 Founder NFTs at a 5 USDC mint price. Potential utility includes Founder status, profile badges, early access, Founder-only quests, selected seasonal benefits, community privileges, and possible Intelligence+ benefits. Replate may also explore sponsored quests, seasons, reward pools, and infrastructure campaigns with AI, Web3, wellness, wallet, Base ecosystem, and consumer-brand partners." },
  { title: "9. Roadmap", status: "Planned", body: "Near-term priorities include better retailer parsing, stronger normalization, OCR and classification confidence, duplicate and fraud detection, PostgreSQL intelligence architecture, historical behavioral tracking, Advanced Replate Intelligence, x402 payments, Intelligence+ membership, B2B Intelligence APIs, MCP-compatible tools, Founder NFT utility, and sponsored ecosystem experiments. A native token and mass-market wallet-abstracted experience remain conditional on proven product-market fit." },
  { title: "10. Abstract", status: "Strategy", body: "Replate combines OCR, product classification, household context, AI analysis, and Base verification to turn grocery receipts into health feedback, verifiable progress, and privacy-conscious behavioral intelligence. Today it focuses on receipt analysis, scores, XP, streaks, badges, weekly progress, and user-signed onchain verification. The long-term vision is Replate Intelligence: a structured layer for users, AI agents, and Web3 applications." },
  { title: "11. Mission and audience", status: "Strategy", body: "Replate helps users understand and improve grocery-shopping behavior while creating a transparent record of progress. Phase 1 focuses on crypto-native users in Base and Farcaster interested in health, fitness, community, AI, and onchain identity. The initial objective is to prove repeated receipt usage, retention, useful scoring, reliable normalization, and sustained onchain participation." },
  { title: "12. The problem", status: "Strategy", body: "Grocery receipts are usually discarded after proving that a purchase happened, even though they contain signals about real-world behavior, nutrition, household habits, and change over time. Replate aims to transform discarded receipt data into structured, privacy-conscious intelligence while allowing users, developers, AI systems, and the ecosystem to participate in the value created." },
  { title: "13. Privacy and data principles", status: "Strategy", body: "Replate separates data into Private Data such as raw receipts and OCR text, Permissioned Data such as user-level trends authorized by the user, and Aggregated Intelligence such as sufficiently aggregated behavioral signals. The guiding principle is simple: Replate monetizes intelligence, not personal receipt data." },
  { title: "14. Economic model", status: "Strategy", body: "Users contribute verified activity and receive health feedback, XP, streaks, badges, optional premium intelligence, and potential future rewards. AI and Web3 applications may pay for structured intelligence through subscriptions, pay-per-use services, x402 APIs, MCP usage, and sponsored programs. Replate provides the infrastructure and may direct part of future revenue toward ecosystem growth and recurring reward pools." },
  { title: "15. Risks and open questions", status: "Strategy", body: "Intelligence quality depends on OCR, normalization, classification, fraud resistance, sufficient activity, historical depth, and privacy controls. Fake receipts, duplicate submissions, and Sybil activity can weaken rewards and data quality. Demand for intelligence must be proven, and privacy, consent, data licensing, subscriptions, NFTs, rewards, sponsorships, and future token plans require appropriate legal and compliance review." },
  { title: "16. Vision", status: "Strategy", body: "Replate begins with a grocery receipt and evolves toward a Health and Nutrition Tracker, Onchain Healthy-Living Proof, Verified Behavioral Data Layer, Replate Intelligence, x402 AI Services, MCP Agent Infrastructure, and a Real-World Intelligence Network. Real behavior. Verified intelligence. Machine-to-machine commerce." },
];

const statusStyles: Record<Status, string> = {
  Live: "border-[#00E36E]/25 bg-[#00E36E]/10 text-[#00E36E]",
  Planned: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  Strategy: "border-sky-400/25 bg-sky-400/10 text-sky-300",
};

export default function WhitepaperPage() {
  return (
    <Shell>
      <article className="mx-auto max-w-4xl space-y-10">
        <header className="border-b border-brand-primary/15 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">Replate Whitepaper v2</p>
              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Onchain proof of healthy living.</h1>
            </div>
            <Link href="/litepaper" className="inline-flex shrink-0 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-black text-[#050806]">Read Litepaper</Link>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-text/65">A receipt intelligence and rewards protocol built for health-focused users in the Base and Farcaster ecosystems.</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-text/40">Version 2.0 - Living product document</p>
        </header>

        <section className="rounded-3xl border border-brand-primary/20 bg-brand-primary/5 p-6 sm:p-8">
          <h2 className="text-xl font-black text-brand-primary">Abstract</h2>
          <p className="mt-3 leading-8 text-brand-text/70">Replate combines OCR, product classification, household context, and Base blockchain verification to turn grocery receipts into useful health feedback and verifiable progress. This document separates the current product from proposed economic and ecosystem features.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className={"rounded-full border px-3 py-1 " + statusStyles.Live}>Live</span>
            <span className={"rounded-full border px-3 py-1 " + statusStyles.Planned}>Planned</span>
            <span className={"rounded-full border px-3 py-1 " + statusStyles.Strategy}>Strategy</span>
          </div>
        </section>

        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black text-brand-primary">{section.title}</h2>
                <span className={"rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest " + statusStyles[section.status]}>{section.status}</span>
              </div>
              <p className="mt-3 leading-8 text-brand-text/65">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap gap-3 border-t border-brand-primary/15 pt-6">
          <Link href="/litepaper" className="inline-flex rounded-2xl bg-brand-primary px-6 py-3 font-black text-[#050806]">Read Litepaper</Link>
          <Link href="/verify-receipt" className="inline-flex rounded-2xl border border-brand-primary/20 px-6 py-3 font-black text-brand-primary">Verify a receipt</Link>
          <Link href="/privacy" className="inline-flex rounded-2xl border border-brand-primary/20 px-6 py-3 font-black text-brand-primary">Read privacy principles</Link>
        </footer>
      </article>
    </Shell>
  );
}
