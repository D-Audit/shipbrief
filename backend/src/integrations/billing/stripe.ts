import crypto from "node:crypto";
import { config } from "../../config/env.js";
import { safeEqual } from "../../utils/crypto.js";
import { upstreamError } from "../../utils/errors.js";

/**
 * Minimal Stripe REST client — only the calls ShipBrief needs. All Stripe
 * specifics live in this file; `stripe` is null when billing isn't configured.
 */
class StripeClient {
  constructor(private readonly secretKey: string) {}

  private async request<T>(method: "GET" | "POST", path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.stripe.com/v1${path}`);
    if (method === "GET" && params) url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: method === "POST" && params ? new URLSearchParams(params) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!response.ok) throw upstreamError("BILLING_PROVIDER_ERROR", body.error?.message ?? "The billing provider returned an error.");
    return body;
  }

  async createCustomer(input: { email: string; name: string; workspaceId: string }) {
    const customer = await this.request<{ id: string }>("POST", "/customers", { email: input.email, name: input.name, "metadata[workspace_id]": input.workspaceId });
    return customer.id;
  }

  async createCheckoutSession(input: { customerId: string; priceId: string; workspaceId: string; successUrl: string; cancelUrl: string }) {
    const session = await this.request<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: input.customerId,
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.workspaceId,
      "subscription_data[metadata][workspace_id]": input.workspaceId,
    });
    return session.url;
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await this.request<{ url: string }>("POST", "/billing_portal/sessions", { customer: customerId, return_url: returnUrl });
    return session.url;
  }

  async getDefaultPaymentMethod(customerId: string) {
    const customer = await this.request<{ invoice_settings?: { default_payment_method?: { card?: { brand: string; last4: string; exp_month: number; exp_year: number } } | null } }>(
      "GET",
      `/customers/${encodeURIComponent(customerId)}`,
      { "expand[]": "invoice_settings.default_payment_method" },
    );
    const card = customer.invoice_settings?.default_payment_method?.card;
    if (!card) return null;
    return { brand: card.brand.charAt(0).toUpperCase() + card.brand.slice(1), last4: card.last4, expires: `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}` };
  }
}

export const stripe = config.STRIPE_SECRET_KEY ? new StripeClient(config.STRIPE_SECRET_KEY) : null;

/** Verifies a `Stripe-Signature` header (t=…,v1=…) with a 5-minute tolerance. */
export function verifyStripeSignature(payload: string, header: string, secret: string, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return header
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .some((part) => safeEqual(part.slice(3), expected));
}
