import Link from "next/link";
import Shell from "@/components/Shell";
import MarkdownDocument from "@/components/MarkdownDocument";

export default function LitepaperPage() {
  return (
    <Shell>
      <article className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-brand-primary/15 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">Replate Litepaper</p>
              <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">A concise view of Replate.</h1>
            </div>
            <Link href="/whitepaper" className="inline-flex shrink-0 rounded-2xl border border-brand-primary/25 px-5 py-3 text-sm font-black text-brand-primary">Read Whitepaper</Link>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-text/65">The complete litepaper overview of Replate's receipt intelligence, onchain progress, and future AI infrastructure.</p>
        </header>
        <section className="rounded-3xl border border-brand-primary/15 bg-[#0c1310] p-6 sm:p-9">
          <MarkdownDocument fileName="litepaper.md" />
        </section>
        <footer className="flex flex-wrap gap-3 border-t border-brand-primary/15 pt-6">
          <Link href="/whitepaper" className="inline-flex rounded-2xl bg-brand-primary px-6 py-3 font-black text-[#050806]">Read full Whitepaper</Link>
          <Link href="/verify-receipt" className="inline-flex rounded-2xl border border-brand-primary/20 px-6 py-3 font-black text-brand-primary">Verify a receipt</Link>
        </footer>
      </article>
    </Shell>
  );
}

