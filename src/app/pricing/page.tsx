import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ShipBriefLogo } from "@/components/brand";
import { PricingSection } from "@/components/marketing/pricing-section";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose a ShipBrief plan for your product communication workflow.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="ShipBrief home"><ShipBriefLogo /></Link>
          <Link href="/" className={`${buttonVariants({ variant: "ghost", size: "sm" })} gap-1.5`}><ArrowLeft />Back to home</Link>
        </div>
      </header>
      <main>
        <PricingSection eyebrow="Pricing" title="The right release loop for the team you are becoming." description="Every plan starts with the same deliberate foundation: source context, a clear customer story, and channel-ready publishing." />
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6"><p className="text-[11px] font-medium tracking-[0.14em] text-primary uppercase">Questions before you begin?</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Explore the complete product before you decide.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">This frontend preview includes the workspace, AI Studio, public changelog, feedback loop, and widget installer—no billing backend is connected yet.</p><Link href="/app/overview" className={`${buttonVariants({ variant: "outline" })} mt-6`}>View the workspace</Link></section>
      </main>
    </div>
  );
}
