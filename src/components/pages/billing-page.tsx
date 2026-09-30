"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState, PageHeader, SectionHeader, StatusBadge } from "@/components/shared/page-states";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/use-async-data";
import { marketingPlans } from "@/lib/marketing-pricing";
import { billingService } from "@/lib/services";
import { PlanCard } from "@/components/shared/plan-card";

export function BillingPage() {
  const [changing, setChanging] = useState<string | null>(null);
  const { state, reload } = useAsyncData(() => billingService.get(), []);

  const changePlan = async (plan: "starter" | "pro" | "scale") => {
    setChanging(plan);
    try {
      // Redirects to Stripe; the plan changes only after payment is confirmed.
      await billingService.changePlan(plan);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not start the plan change.");
      setChanging(null);
    }
  };

  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;
  const billing = state.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, usage and invoices." />
      <section aria-labelledby="current-plan-heading" className="grid gap-px overflow-hidden rounded-[var(--radius-xl)] sb-feature lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="p-6">
          <p className="text-xs text-ink-foreground/60">Current plan</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h2 id="current-plan-heading" className="sb-title-page text-ink-foreground capitalize">{billing.plan}</h2>
            <span className="text-sm text-ink-foreground/60">${billing.price} / month</span>
          </div>
          <p className="mt-2 max-w-md text-sm text-ink-foreground/70">Release communication, feedback intelligence and the full review workflow.</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {billing.features.map((feature) => (
              <li key={feature} className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/10 px-2.5 py-1 text-xs">
                <Check className="size-3 text-ink-foreground/50" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center gap-4 bg-ink-foreground/[0.04] p-6">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-foreground/70">Workspace usage</span>
              <span className="sb-stat">{billing.usagePercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-foreground/10">
              <div className={cn("h-full rounded-full transition-all", "bg-primary-strong")} style={{ width: billing.usagePercent + "%" }} />
            </div>
            <p className="mt-2 text-xs text-ink-foreground/60">{billing.usagePercent >= 80 ? "You're close to your plan's limit. Upgrading keeps releases flowing." : "Comfortably within your plan."}</p>
          </div>
          <p className="text-xs text-ink-foreground/60">{billingStatusLine(billing)}</p>
        </div>
      </section>
      <section className="space-y-5">
        <div>
          <h2 className="sb-title-section">Plans</h2>
          <p className="text-sm text-muted-foreground">Change plan anytime. You&apos;ll confirm payment securely with Stripe before the change applies.</p>
        </div>
        <div className="grid gap-4 pt-2 md:grid-cols-3">
          {marketingPlans.map((plan) => {
            const current = plan.id === billing.plan;
            return (
              <PlanCard
                key={plan.id}
                name={plan.name}
                price={plan.price}
                detail={plan.detail}
                features={plan.features}
                highlighted={current}
                emphasis="outline"
                badge={current ? "Current plan" : plan.id === "pro" ? "Most popular" : undefined}
                action={{
                  label: current ? "Your current plan" : plan.price > billing.price ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`,
                  onClick: () => void changePlan(plan.id),
                  disabled: current || changing !== null,
                  loading: changing === plan.id,
                }}
              />
            );
          })}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2"><section className="sb-panel p-5"><SectionHeader title="Payment method" description="Securely stored by our payment provider." />{billing.paymentMethod ? <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-surface-subtle/60 p-3"><div><p className="text-sm font-medium">{billing.paymentMethod.brand} ending in {billing.paymentMethod.last4}</p><p className="text-xs text-muted-foreground">Expires {billing.paymentMethod.expires}</p></div><Button type="button" variant="outline" size="sm" onClick={() => toast.message("Payment method editing is a backend billing-provider boundary.")}>Update</Button></div> : <p className="mt-5 text-sm text-muted-foreground">No payment method is shown in this frontend workspace.</p>}</section>
      <section className="sb-panel p-5"><SectionHeader title="Invoices" description="Download past invoices for your records." /><div className="mt-4 divide-y divide-border">{billing.invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><p className="text-sm font-medium">{invoice.date}</p><StatusBadge status={invoice.status} /></div><div className="flex items-center gap-3"><span className="text-sm font-medium">{"$" + invoice.amount}</span><Button type="button" variant="ghost" size="icon-sm" aria-label={"Download invoice " + invoice.id} onClick={() => toast.success("Invoice download prepared.")}><Download /></Button></div></div>)}</div></section></div>
    </div>
  );
}

function billingStatusLine(billing: { status?: string; trialEndsAt?: string | null; currentPeriodEnd?: string | null; usage?: { aiGenerations: { used: number; limit: number } } }) {
  const usage = billing.usage ? `${billing.usage.aiGenerations.used.toLocaleString()} of ${billing.usage.aiGenerations.limit.toLocaleString()} AI generations this month` : "";
  const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const status =
    billing.status === "trialing" && billing.trialEndsAt ? `Trial ends ${date(billing.trialEndsAt)}`
    : billing.status === "past_due" ? "Payment past due — update your card to keep access"
    : billing.currentPeriodEnd ? `Renews ${date(billing.currentPeriodEnd)}`
    : "";
  return [status, usage].filter(Boolean).join(" · ");
}
