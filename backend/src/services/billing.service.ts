import { and, desc, eq, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db, type DbExecutor } from "../database/client.js";
import { billingEvents, invoices, memberships, subscriptions, usageCounters, workspaces } from "../database/schema.js";
import { stripe, verifyStripeSignature } from "../integrations/billing/stripe.js";
import type { Plan } from "../types/domain.js";
import { AppError, badRequest, notConfigured } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { recordActivity } from "./activity.service.js";
import { audit } from "./audit.service.js";

/**
 * Plans and limits are defined server-side only. Subscription state changes
 * exclusively through verified Stripe webhooks — never from a client request.
 */
export const PLANS: Record<Plan, { price: number; seats: number | null; aiGenerations: number; emails: number; features: string[] }> = {
  starter: { price: 19, seats: 3, aiGenerations: 100, emails: 2_000, features: ["Releases", "Changelog", "Widget", "AI generation"] },
  pro: { price: 49, seats: 10, aiGenerations: 1_000, emails: 25_000, features: ["Releases", "AI generation", "Changelog", "Widget", "Analytics", "Team"] },
  scale: { price: 149, seats: null, aiGenerations: 10_000, emails: 250_000, features: ["Everything in Pro", "Unlimited seats", "Integrations", "API & webhooks", "Priority support"] },
};

export type UsageMetric = "ai_generations" | "emails";

export function currentPeriod(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export async function getSubscription(workspaceId: string, executor: DbExecutor = db) {
  const [row] = await executor.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).limit(1);
  return row ?? null;
}

/** The plan whose limits apply right now (an expired trial or canceled subscription falls back to Starter limits). */
export function effectivePlan(subscription: typeof subscriptions.$inferSelect | null): Plan {
  if (!subscription) return "starter";
  if (subscription.status === "trialing" && subscription.trialEndsAt && subscription.trialEndsAt < new Date()) return "starter";
  if (subscription.status === "canceled" || subscription.status === "incomplete") return "starter";
  return subscription.plan;
}

export async function getUsage(workspaceId: string, metric: UsageMetric) {
  const [row] = await db
    .select({ count: usageCounters.count })
    .from(usageCounters)
    .where(and(eq(usageCounters.workspaceId, workspaceId), eq(usageCounters.metric, metric), eq(usageCounters.period, currentPeriod())))
    .limit(1);
  return row?.count ?? 0;
}

export async function assertWithinLimit(workspaceId: string, metric: UsageMetric, amount = 1) {
  const plan = effectivePlan(await getSubscription(workspaceId));
  const limit = metric === "ai_generations" ? PLANS[plan].aiGenerations : PLANS[plan].emails;
  const used = await getUsage(workspaceId, metric);
  if (used + amount > limit) {
    throw new AppError(402, "PLAN_LIMIT_REACHED", `This workspace has used its ${limit.toLocaleString("en-US")} monthly ${metric === "ai_generations" ? "AI generations" : "emails"} on the ${plan} plan. Upgrade to continue.`);
  }
}

export async function incrementUsage(workspaceId: string, metric: UsageMetric, amount = 1, executor: DbExecutor = db) {
  await executor
    .insert(usageCounters)
    .values({ workspaceId, metric, period: currentPeriod(), count: amount })
    .onConflictDoUpdate({ target: [usageCounters.workspaceId, usageCounters.metric, usageCounters.period], set: { count: sql`${usageCounters.count} + ${amount}` } });
}

export async function assertSeatAvailable(workspaceId: string, pendingInvites: number) {
  const plan = effectivePlan(await getSubscription(workspaceId));
  const seats = PLANS[plan].seats;
  if (seats === null) return;
  const [{ members } = { members: 0 }] = await db.select({ members: sql<number>`count(*)::int` }).from(memberships).where(eq(memberships.workspaceId, workspaceId));
  if (members + pendingInvites + 1 > seats) {
    throw new AppError(402, "PLAN_LIMIT_REACHED", `The ${plan} plan includes ${seats} seats. Upgrade to invite more teammates.`);
  }
}

export async function getBilling(actor: Actor) {
  const subscription = await getSubscription(actor.workspaceId);
  const plan = effectivePlan(subscription);
  const aiUsed = await getUsage(actor.workspaceId, "ai_generations");
  const history = await db
    .select()
    .from(invoices)
    .where(eq(invoices.workspaceId, actor.workspaceId))
    .orderBy(desc(invoices.issuedAt))
    .limit(24);
  const paymentMethod = subscription?.stripeCustomerId && stripe ? await stripe.getDefaultPaymentMethod(subscription.stripeCustomerId).catch(() => null) : null;

  return {
    plan: subscription?.plan ?? "starter",
    effectivePlan: plan,
    status: subscription?.status ?? "incomplete",
    trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    price: PLANS[subscription?.plan ?? "starter"].price,
    usagePercent: Math.min(100, Math.round((aiUsed / PLANS[plan].aiGenerations) * 100)),
    usage: { aiGenerations: { used: aiUsed, limit: PLANS[plan].aiGenerations }, emails: { used: await getUsage(actor.workspaceId, "emails"), limit: PLANS[plan].emails } },
    features: PLANS[plan].features,
    invoices: history.map((invoice) => ({ id: invoice.id, date: invoice.issuedAt.toISOString().slice(0, 10), amount: invoice.amountCents / 100, status: invoice.status, url: invoice.hostedUrl ?? undefined })),
    paymentMethod,
    billingConfigured: Boolean(stripe),
  };
}

/** Starts a Stripe Checkout session for a plan change. The plan only changes once Stripe confirms payment. */
export async function createCheckout(actor: Actor, plan: Plan) {
  if (!stripe) throw notConfigured("BILLING_NOT_CONFIGURED", "Billing isn't configured for this installation, so plans can't be changed yet.");
  const priceId = { starter: config.STRIPE_PRICE_STARTER, pro: config.STRIPE_PRICE_PRO, scale: config.STRIPE_PRICE_SCALE }[plan];
  if (!priceId) throw notConfigured("BILLING_NOT_CONFIGURED", `No Stripe price is configured for the ${plan} plan.`);
  const subscription = await getSubscription(actor.workspaceId);
  const [workspace] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, actor.workspaceId)).limit(1);

  let customerId = subscription?.stripeCustomerId;
  if (!customerId) {
    customerId = await stripe.createCustomer({ email: actor.email, name: workspace?.name ?? actor.name, workspaceId: actor.workspaceId });
    await db.update(subscriptions).set({ stripeCustomerId: customerId }).where(eq(subscriptions.workspaceId, actor.workspaceId));
  }
  if (subscription?.stripeSubscriptionId && subscription.status !== "canceled") {
    // Existing subscribers change plans in the billing portal, where proration is handled by Stripe.
    return { url: await stripe.createPortalSession(customerId, `${config.APP_URL}/app/billing`) };
  }
  const url = await stripe.createCheckoutSession({
    customerId,
    priceId,
    workspaceId: actor.workspaceId,
    successUrl: `${config.APP_URL}/app/billing?checkout=success`,
    cancelUrl: `${config.APP_URL}/app/billing?checkout=cancelled`,
  });
  await audit({ action: "billing.checkout_started", workspaceId: actor.workspaceId, userId: actor.userId, metadata: { plan } });
  return { url };
}

export async function createPortal(actor: Actor) {
  if (!stripe) throw notConfigured("BILLING_NOT_CONFIGURED", "Billing isn't configured for this installation.");
  const subscription = await getSubscription(actor.workspaceId);
  if (!subscription?.stripeCustomerId) throw badRequest("NO_BILLING_ACCOUNT", "Choose a plan first to set up billing.");
  return { url: await stripe.createPortalSession(subscription.stripeCustomerId, `${config.APP_URL}/app/billing`) };
}

const PLAN_BY_PRICE = () =>
  new Map<string, Plan>(
    (
      [
        [config.STRIPE_PRICE_STARTER, "starter"],
        [config.STRIPE_PRICE_PRO, "pro"],
        [config.STRIPE_PRICE_SCALE, "scale"],
      ] as [string | undefined, Plan][]
    ).filter((entry): entry is [string, Plan] => Boolean(entry[0])),
  );

type StripeEvent = { id: string; type: string; data: { object: Record<string, any> } };

/** Verified, idempotent Stripe webhook processing. */
export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) throw notConfigured("BILLING_NOT_CONFIGURED", "Billing isn't configured.");
  if (!signature || !verifyStripeSignature(rawBody.toString("utf8"), signature, config.STRIPE_WEBHOOK_SECRET)) {
    throw badRequest("INVALID_SIGNATURE", "Invalid Stripe signature.");
  }
  const event = JSON.parse(rawBody.toString("utf8")) as StripeEvent;
  const object = event.data.object;

  await db.transaction(async (tx) => {
    const inserted = await tx.insert(billingEvents).values({ providerEventId: event.id, type: event.type }).onConflictDoNothing().returning({ id: billingEvents.id });
    if (inserted.length === 0) return; // already processed

    if (event.type.startsWith("customer.subscription.")) {
      const [subscription] = await tx.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, String(object.customer))).limit(1);
      if (!subscription) return logger.warn({ eventId: event.id }, "Stripe subscription event for unknown customer");
      const priceId = object.items?.data?.[0]?.price?.id as string | undefined;
      const plan = (priceId && PLAN_BY_PRICE().get(priceId)) || subscription.plan;
      const statusMap: Record<string, typeof subscription.status> = { trialing: "trialing", active: "active", past_due: "past_due", unpaid: "past_due", canceled: "canceled", incomplete: "incomplete", incomplete_expired: "canceled" };
      const status = event.type === "customer.subscription.deleted" ? "canceled" : statusMap[String(object.status)] ?? subscription.status;
      await tx
        .update(subscriptions)
        .set({
          plan,
          status,
          stripeSubscriptionId: String(object.id),
          currentPeriodEnd: object.current_period_end ? new Date(Number(object.current_period_end) * 1000) : subscription.currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
          trialEndsAt: object.trial_end ? new Date(Number(object.trial_end) * 1000) : status === "active" ? null : subscription.trialEndsAt,
        })
        .where(eq(subscriptions.id, subscription.id));
      await tx.update(billingEvents).set({ workspaceId: subscription.workspaceId }).where(eq(billingEvents.providerEventId, event.id));
      if (plan !== subscription.plan || status !== subscription.status) {
        await recordActivity(tx, { workspaceId: subscription.workspaceId, type: "comment", message: `Subscription is now ${plan} (${status})`, link: "/app/billing", actorName: "Billing" });
      }
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed" || event.type === "invoice.finalized") {
      const [subscription] = await tx.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, String(object.customer))).limit(1);
      if (!subscription) return;
      await tx
        .insert(invoices)
        .values({
          workspaceId: subscription.workspaceId,
          providerInvoiceId: String(object.id),
          amountCents: Number(object.amount_paid ?? object.amount_due ?? 0),
          currency: String(object.currency ?? "usd"),
          status: String(object.status ?? "open"),
          hostedUrl: object.hosted_invoice_url ? String(object.hosted_invoice_url) : null,
          issuedAt: new Date(Number(object.created ?? Date.now() / 1000) * 1000),
        })
        .onConflictDoUpdate({ target: invoices.providerInvoiceId, set: { status: String(object.status ?? "open"), amountCents: Number(object.amount_paid ?? object.amount_due ?? 0) } });
    }
  });
  return { received: true };
}

