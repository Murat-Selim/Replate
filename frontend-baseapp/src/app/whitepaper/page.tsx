import Link from "next/link";
import Shell from "@/components/Shell";

type Section = { title: string; status: "Live" | "Planned" | "Strategy"; body: string };

const sections: Section[] = [
  {
    title: "1. Mission",
    status: "Strategy",
    body: "Replate turns everyday grocery receipts into understandable health and nutrition insight. The long-term goal is to help people make healthier, less wasteful choices while creating a transparent, verifiable record of progress.",
  },
  {
    title: "2. Target audience",
    status: "Strategy",
    body: "Phase 1 is designed primarily for crypto-native users in the Base and Farcaster ecosystems who are interested in health, fitness, community, and onchain identity. Replate is not positioned as a mass-market grocery rewards app at launch. A simpler, wallet-abstracted consumer version may be evaluated only after the core community and usage model are proven.",
  },
  {
    title: "3. The problem",
    status: "Strategy",
    body: "Many nutrition apps rely on self-reported data, while traditional receipt-reward apps generally keep the value and activity record inside a closed platform. Replate connects receipt-based evidence with transparent progress, community participation, and an optional onchain record.",
  },
  {
    title: "4. Risks and open questions",
    status: "Strategy",
    body: "A paid reward system may increase fake receipt and Sybil attempts. Small rewards may not be sufficient without strong community and game mechanics. Product coverage and OCR accuracy vary by retailer and image quality. The sustainability of the reward pool depends on real receipt activity. Privacy, consumer rewards, and future token plans require appropriate legal and compliance review before expansion.",
  },
  {
    title: "5. Reward economy",
    status: "Planned",
    body: "The contract supports FREE and PAID phases. The current onboarding strategy is FREE; the validator can activate the PAID phase when usage and retention justify it. The configured fee is 0.50 USDC per verified receipt in the PAID phase, split equally between the weekly reward pool and the developer fund. The current distribution implementation uses validator-submitted point shares, based on total points. A multi-factor formula combining nutrition, health, streak, and consistency is proposed for a future upgrade and is not yet the active distribution rule.",
  },
  {
    title: "6. Future utility and monetization",
    status: "Planned",
    body: "Future experiments may include badge-holder participation rewards, sponsored quests, premium analytics, founder or utility NFTs, marketplace fees, and other partner-funded programs. These are roadmap possibilities, not current guarantees. The proposed badge sign pool and mystery-box rewards are not implemented onchain today; current quest previews are offchain and do not promise tokens, XP, or USDC.",
  },
  {
    title: "7. Roadmap",
    status: "Planned",
    body: "Near-term work includes better retailer parsing, stronger product aliases, clearer OCR confidence signals, simpler mobile UX, and improved feedback. The next economic phase may include PAID activation and a multi-factor reward formula. Medium-term possibilities include badge utility, sponsored quests, premium features, and partner programs. A native token or mass-market wallet-abstracted experience remains conditional on proven product-market fit and community health.",
  },
  {
    title: "8. Product flow",
    status: "Live",
    body: "A user uploads or captures a grocery receipt and provides household context. Google Cloud Vision extracts the receipt text. Replate removes totals, payment lines, and recognized non-food items, then normalizes and classifies product lines as healthy, unhealthy, or neutral. Optional Open Food Facts enrichment can support product analysis. The first analysis happens offchain. After reviewing the result, the user signs an EIP-712 message and submits the verification transaction from the connected wallet. A validator-relayed gasless path exists in the backend, but it is not the default frontend flow today.",
  },
  {
    title: "9. Scoring model",
    status: "Live",
    body: "The Health Score gives full weight to recognized healthy products, partial weight to neutral products, and zero weight to unhealthy products. The Nutrition Score compares fruit-and-vegetable grams with an average reference target of approximately 300g per person per day, multiplied by household size and the period covered. The current model rewards an ideal range and reduces the score for both severe under-purchasing and possible over-purchasing. This is informational feedback, not medical advice.",
  },
  {
    title: "10. Onchain verification",
    status: "Live",
    body: "The blockchain record contains aggregate receipt data such as item counts, scores, fruit-and-vegetable grams, household size, days covered, points, and timestamp. The raw image, OCR text, product names, and store name are not written to the contract. A one-way receipt hash prevents the same receipt hash from being reused. Onchain activity is pseudonymous, not fully anonymous: the wallet address and aggregate activity are publicly visible on Base.",
  },
  {
    title: "11. XP, streaks, and badges",
    status: "Live",
    body: "Verified receipts can produce XP and update weekly reports. Daily check-ins provide a separate 10 XP mechanic. Receipt health streaks and daily check-in streaks are tracked separately. A Replate Badge NFT can be minted when the required health and nutrition thresholds are reached. These mechanics are designed to reward consistency rather than perfection.",
  },
  {
    title: "12. Privacy and responsible AI",
    status: "Live",
    body: "Replate does not intend to retain raw receipt images or full OCR text in application storage. Third-party OCR providers may process submitted images under their own service terms. OCR and product classification can be wrong, especially with blurry, angled, damaged, or unusual receipts. Replate outputs are assistive and informational and should not be treated as medical, financial, or legal advice.",
  },
];

const statusStyles = {
  Live: "border-[#00E36E]/25 bg-[#00E36E]/10 text-[#00E36E]",
  Planned: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  Strategy: "border-sky-400/25 bg-sky-400/10 text-sky-300",
};

export default function WhitepaperPage() {
  return (
    <Shell>
      <article className="mx-auto max-w-4xl space-y-10">
        <header className="border-b border-brand-primary/15 pb-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">Replate Whitepaper v2</p>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Onchain proof of healthy living.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-text/65">A receipt intelligence and rewards protocol built for health-focused users in the Base and Farcaster ecosystems.</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-text/40">Version 2.0 · Living product document</p>
        </header>

        <section className="rounded-3xl border border-brand-primary/20 bg-brand-primary/5 p-6 sm:p-8">
          <h2 className="text-xl font-black text-brand-primary">Abstract</h2>
          <p className="mt-3 leading-8 text-brand-text/70">Replate combines OCR, product classification, household context, and Base blockchain verification to turn grocery receipts into useful health feedback and verifiable progress. This document separates the current product from proposed economic and ecosystem features so that users can distinguish what is live today from what is planned.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className={`rounded-full border px-3 py-1 ${statusStyles.Live}`}>Live</span>
            <span className={`rounded-full border px-3 py-1 ${statusStyles.Planned}`}>Planned</span>
            <span className={`rounded-full border px-3 py-1 ${statusStyles.Strategy}`}>Strategy</span>
          </div>
        </section>

        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black text-brand-primary">{section.title}</h2>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[section.status]}`}>{section.status}</span>
              </div>
              <p className="mt-3 leading-8 text-brand-text/65">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap gap-3 border-t border-brand-primary/15 pt-6">
          <Link href="/verify-receipt" className="inline-flex rounded-2xl bg-brand-primary px-6 py-3 font-black text-[#050806]">Verify a receipt</Link>
          <Link href="/privacy" className="inline-flex rounded-2xl border border-brand-primary/20 px-6 py-3 font-black text-brand-primary">Read privacy principles</Link>
        </footer>
      </article>
    </Shell>
  );
}