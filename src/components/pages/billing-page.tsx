"use client";

import { useState } from "react";
import { Check, CreditCard, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/use-async-data";
import { marketingPlans } from "@/lib/marketing-pricing";
import { billingService } from "@/lib/services";

export function BillingPage() {
  const [changing, setChanging] = useState<string | null>(null);
  const { state, reload } = useAsyncData(() => billingService.get(), []);

  const changePlan = async (plan: "starter" | "pro" | "scale") => {
    setChanging(plan);
    try {
      await billingService.changePlan(plan);
      await reload();
      toast.success("Plan change recorded (mock). No payment was processed.");
    } catch {
      toast.error("We could not change the plan.");
    } finally {
      setChanging(null);
    }
  };

  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;
  const billing = state.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Plan, usage, and invoices. No payment processing is implemented in this frontend." />
      <section className="sb-panel p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-muted-foreground">Current plan</p><div className="mt-1 flex items-baseline gap-2"><h2 className="text-2xl font-semibold capitalize">{billing.plan}</h2><span className="text-sm text-muted-foreground">{"$" + billing.price} / month</span></div><p className="mt-2 text-sm text-muted-foreground">Your plan includes release communication, feedback intelligence, and selected operations tooling.</p></div><span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-medium text-primary"><Sparkles className="size-3.5" />Active plan</span></div><div className="mt-6"><div className="mb-2 flex justify-between text-sm"><span>Workspace usage</span><span className="font-medium">{billing.usagePercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: billing.usagePercent + "%" }} /></div><p className="mt-2 text-xs text-muted-foreground">{billing.usagePercent >= 80 ? "You are nearing a usage threshold. Upgrade UI is available below." : "Usage is within the current plan allowance."}</p></div><ul className="mt-6 grid gap-2 sm:grid-cols-2">{billing.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-sm"><Check className="size-4 text-success" />{feature}</li>)}</ul></section>
      <section className="space-y-3"><div><h2 className="text-base font-semibold">Plans</h2><p className="text-sm text-muted-foreground">Choose the feature envelope that fits your team. This updates local mock state only.</p></div><div className="grid gap-4 lg:grid-cols-3">{marketingPlans.map((plan) => <article key={plan.id} className={plan.id === billing.plan ? "rounded-xl border border-primary/40 bg-primary/5 p-5" : "sb-panel p-5"}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{plan.detail}</p></div>{plan.id === billing.plan && <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Current</span>}</div><p className="mt-5 text-2xl font-semibold">{"$" + plan.price}<span className="text-sm font-normal text-muted-foreground"> / month</span></p><ul className="mt-5 space-y-2">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{feature}</li>)}</ul><Button type="button" variant={plan.id === billing.plan ? "outline" : "default"} className="mt-6 w-full" onClick={() => void changePlan(plan.id)} disabled={plan.id === billing.plan || changing !== null}>{changing === plan.id && <Loader2 className="animate-spin" />}{plan.id === billing.plan ? "Current plan" : plan.price > billing.price ? "Upgrade" : "Switch plan"}</Button></article>)}</div></section>
      <div className="grid gap-6 xl:grid-cols-2"><section className="sb-panel p-5"><div className="flex items-center gap-2"><CreditCard className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Payment method</h2><p className="text-xs text-muted-foreground">Secure payment management connects later.</p></div></div>{billing.paymentMethod ? <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-surface-subtle/60 p-3"><div><p className="text-sm font-medium">{billing.paymentMethod.brand} ending in {billing.paymentMethod.last4}</p><p className="text-xs text-muted-foreground">Expires {billing.paymentMethod.expires}</p></div><Button type="button" variant="outline" size="sm" onClick={() => toast.message("Payment method editing is a backend billing-provider boundary.")}>Update</Button></div> : <p className="mt-5 text-sm text-muted-foreground">No payment method is shown in this frontend workspace.</p>}</section>
      <section className="sb-panel p-5"><h2 className="text-base font-semibold">Invoices</h2><div className="mt-4 divide-y divide-border">{billing.invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium">{invoice.date}</p><p className="text-xs capitalize text-success">{invoice.status}</p></div><div className="flex items-center gap-3"><span className="text-sm font-medium">{"$" + invoice.amount}</span><Button type="button" variant="ghost" size="icon-sm" aria-label={"Download invoice " + invoice.id} onClick={() => toast.success("Invoice download prepared (mock).")}><Download /></Button></div></div>)}</div></section></div>
    </div>
  );
}
