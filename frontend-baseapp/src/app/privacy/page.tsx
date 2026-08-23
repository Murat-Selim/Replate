import Link from "next/link";
import Shell from "@/components/Shell";

const principles = [
  ["We do not sell personal data", "Receipt-derived data is not sold to advertisers, data brokers, or sponsors."],
  ["Raw receipt images are not retained", "The API processes the uploaded image in memory for OCR and does not write the image or full OCR text to application storage. The OCR provider processes the image under its own service terms."],
  ["Only necessary results continue", "Product names/categories, aggregate counts, scores, and a one-way receipt hash may continue through the verification flow. Public onchain summaries cannot be erased like a normal database record."],
  ["AI is assistive, not medical advice", "Google Cloud Vision extracts text; Replate rules and optional food-data sources classify products. OCR and classification can be wrong and do not provide a diagnosis."],
];

export default function PrivacyPage() {
  return (
    <Shell>
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">Privacy & AI transparency</p>
          <h1 className="mt-2 text-4xl font-black text-white">Your receipt is not the product.</h1>
          <p className="mt-4 leading-7 text-brand-text/60">Plain-language product principles for the current Replate flow.</p>
        </header>
        <div className="space-y-4">
          {principles.map(([title, body]) => (
            <section key={title} className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-6">
              <h2 className="font-black text-brand-primary">✅ {title}</h2>
              <p className="mt-2 leading-7 text-brand-text/60">{body}</p>
            </section>
          ))}
        </div>
          <Link href="/shop" className="inline-flex rounded-2xl bg-brand-primary px-6 py-3 font-black text-[#050806]">Verify a receipt</Link>
      </article>
    </Shell>
  );
}
