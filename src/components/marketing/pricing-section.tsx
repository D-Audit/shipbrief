"use client";

import { useState } from "react";
import { marketingPlans } from "@/lib/marketing-pricing";
import { PlanCard } from "@/components/shared/plan-card";
import { cn } from "@/lib/utils";

type PricingSectionProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  headingLevel?: "h1" | "h2";
};

export function PricingSection({
  eyebrow = "Pricing",
  title = "Simple pricing for every release loop.",
  description = "Priced per workspace. Every plan includes the full workflow — pick the one that fits how often you ship.",
  headingLevel = "h2",
}: PricingSectionProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const Heading = headingLevel;

  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-20">
      <div className="mx-auto max-w-[76rem] px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary-strong">{eyebrow}</p>
          <Heading id="pricing-heading" className="mt-3 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">{title}</Heading>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full bg-surface-subtle p-1" role="group" aria-label="Billing interval">
            {(["monthly", "yearly"] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                aria-pressed={billingInterval === interval}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors",
                  billingInterval === interval ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {interval === "monthly" ? "Monthly" : "Yearly"}
                {interval === "yearly" && (
                  <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold", billingInterval === "yearly" ? "bg-primary text-primary-foreground" : "bg-accent text-primary-strong")}>
                    2 months free
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          {marketingPlans.map((plan) => {
            const price = billingInterval === "yearly" ? Math.round((plan.price * 10) / 12) : plan.price;
            return (
              <PlanCard
                key={plan.id}
                name={plan.name}
                price={price}
                note={billingInterval === "yearly" ? `Billed $${plan.price * 10} yearly` : "Billed monthly"}
                detail={plan.detail}
                features={plan.features}
                highlighted={plan.id === "pro"}
                badge={plan.id === "pro" ? "Most popular" : undefined}
                action={{ label: `Get ${plan.name}`, href: "/signup" }}
              />
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Every plan starts with a 14-day free trial. No card required.</p>
      </div>
    </section>
  );
}
