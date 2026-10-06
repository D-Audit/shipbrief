/**
 * Sends one real email through the configured provider and prints the outcome,
 * so email setup can be checked without signing up a new account:
 *
 *   npm run email:test -- you@yourdomain.com
 */
import { desc, eq } from "drizzle-orm";
import { config } from "../../config/env.js";
import { db, pool } from "../../database/client.js";
import { emailDeliveries } from "../../database/schema.js";
import { sendTransactionalEmail } from "../../services/email.service.js";
import { emailProvider } from "./provider.js";
import { notificationTemplate } from "./templates.js";

const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error("Usage: npm run email:test -- you@example.com");
  process.exit(1);
}

console.log(`Provider: ${emailProvider.name}\nFrom:     ${config.EMAIL_FROM}\nTo:       ${to}\n`);
const rendered = notificationTemplate({ workspaceName: "ShipBrief", message: "Test email: your email setup works", url: config.APP_URL });
const result = await sendTransactionalEmail({ template: "test", message: { to, ...rendered } });

if (result.ok && result.status === "sent") {
  console.log("Sent. Check the inbox (and the spam folder) for “ShipBrief: Test email: your email setup works”.");
} else if (result.ok) {
  console.log("Logged only (development log provider): nothing was delivered. Set RESEND_API_KEY to send for real.");
} else {
  const [delivery] = await db.select({ error: emailDeliveries.error }).from(emailDeliveries).where(eq(emailDeliveries.template, "test")).orderBy(desc(emailDeliveries.createdAt)).limit(1);
  console.error(`Failed: ${delivery?.error ?? "unknown error"}`);
  process.exitCode = 1;
}
await pool.end();
