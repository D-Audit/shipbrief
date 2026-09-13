"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { marketingPlans } from "@/lib/marketing-pricing";
import { buttonVariants } from "@/components/ui/button";

type PricingSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function PricingSection({
  eyebrow = "Simple pricing",
  title = "A clear plan for every stage of your product story.",
  description = "Start with the release loop you need today. Upgrade when the audience, channels, and signals grow with you.",
}: PricingSectionProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  return (
    <section id="pricing" className="border-y border-[#e5e5e5] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold leading-[1.06] tracking-[-0.05em] sm:text-4xl">{title}</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
          <div className="mt-7 inline-flex items-center rounded-xl border border-[#e4e4e7] bg-[#f6f6f7] p-1" aria-label="Billing interval">
            <button type="button" onClick={() => setBillingInterval("monthly")} aria-pressed={billingInterval === "monthly"} className={`h-9 rounded-lg px-3.5 text-sm font-medium transition-colors ${billingInterval === "monthly" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Monthly</button>
            <button type="button" onClick={() => setBillingInterval("yearly")} aria-pressed={billingInterval === "yearly"} className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors ${billingInterval === "yearly" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Yearly <span className="text-[10px] font-semibold tracking-[0.06em] text-primary uppercase">2 months free</span></button>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-3 lg:items-stretch">
          {marketingPlans.map((plan) => {
            const featured = plan.id === "pro";
            const price = billingInterval === "yearly" ? plan.price * 10 : plan.price;
            return (
              <article key={plan.id} className={`relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border p-6 sm:p-7 ${featured ? "border-primary bg-[#fffafd] shadow-[0_20px_50px_rgb(228_1_120/0.12)]" : "border-[#e4e4e7] bg-white"}`}>
                <div className="flex min-h-16 items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.035em]">{plan.name}</h3>
                    <p className="mt-2 max-w-xs text-sm leading-5 text-muted-foreground">{plan.detail}</p>
                  </div>
                  {featured && <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-primary-foreground uppercase">Most popular</span>}
                </div>

                <div className="mt-8 border-y border-[#e7e7ea] py-6">
                  <p className="text-5xl font-semibold tracking-[-0.065em]">${price}<span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">/ {billingInterval === "yearly" ? "year" : "month"}</span></p>
                  <p className="mt-2 text-xs text-muted-foreground">{billingInterval === "yearly" ? "Two months free, billed annually" : "Billed monthly per workspace"}</p>
                </div>

                <Link href="/signup" className={`${buttonVariants({ variant: featured ? "default" : "outline" })} mt-7 h-11 w-full justify-between rounded-lg px-4`}>
                  Start with {plan.name} <ArrowRight className="size-4" />
                </Link>

                <div className="mt-8 border-t border-[#e7e7ea] pt-6">
                  <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Included in {plan.name}</p>
                  <ul className="mt-4 space-y-3 text-sm leading-5 text-foreground">
                    {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{feature}</li>)}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-7 text-center text-xs text-muted-foreground">Every plan starts with the complete ShipBrief release workflow. Change plans as your product communication grows.</p>
      </div>
    </section>
  );
}
