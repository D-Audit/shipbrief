import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Pricing",
  description: "ShipBrief plans for product teams of every size. Every plan includes the full release workflow.",
};

const faqs = [
  ["What counts as a published release?", "A release that has been approved and sent to at least one channel. Drafts, reviews and scheduled releases don’t count toward the limit."],
  ["Can I choose which channels each release uses?", "Yes. Every release has its own channel selection — changelog, email, in-app, or any combination."],
  ["Does AI publish anything on its own?", "No. AI proposes drafts and edits. A person on your team reviews and approves every release before it goes out."],
  ["Can I change plans later?", "Anytime. Upgrades take effect immediately and downgrades apply at the end of the billing period."],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>
        <PricingSection headingLevel="h1" />
        <section aria-labelledby="faq-heading" className="border-t border-border">
          <div className="mx-auto grid max-w-[76rem] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
            <div>
              <h2 id="faq-heading" className="text-[1.75rem] font-semibold tracking-[-0.03em]">Questions</h2>
              <p className="mt-3 text-muted-foreground">Want to see it first? The demo workspace has sample data for every feature.</p>
              <ButtonLink href="/app/overview" variant="outline" size="lg" className="mt-6">Explore the demo</ButtonLink>
            </div>
            <dl className="divide-y divide-border border-y border-border">
              {faqs.map(([question, answer]) => (
                <div key={question} className="py-6">
                  <dt className="font-medium">{question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
