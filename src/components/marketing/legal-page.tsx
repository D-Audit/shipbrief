import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";

export const LEGAL_CONTACT_EMAIL = "donjesuskayiranga@gmail.com";
export const LEGAL_UPDATED = "October 6, 2026";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared layout for the Terms and Privacy pages: title, a jump list, then numbered sections. */
export function LegalPage({ title, intro, sections, related }: { title: string; intro: ReactNode; sections: LegalSection[]; related: { href: string; label: string } }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto max-w-[76rem] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
          <h1 className="mt-3 text-[2.25rem] font-semibold tracking-[-0.03em] sm:text-[2.75rem]">{title}</h1>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">{intro}</div>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-medium">On this page</p>
            <ol className="mt-4 space-y-2 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-muted-foreground transition-colors hover:text-foreground">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
            <Link href={related.href} className="mt-6 inline-block text-sm text-foreground underline-offset-4 hover:underline">
              {related.label} →
            </Link>
          </nav>

          <div className="max-w-3xl divide-y divide-border border-y border-border">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24 py-8">
                <h2 id={`${section.id}-heading`} className="text-lg font-semibold tracking-[-0.01em]">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function ContactLink() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
}
