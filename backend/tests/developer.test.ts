import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/database/client.js";
import { apiKeys, webhookDeliveries } from "../src/database/schema.js";
import { deliverWebhookJob } from "../src/services/webhook.service.js";
import { isPrivateAddress } from "../src/utils/ssrf.js";
import { app, createRelease, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

describe("API keys and the v1 API", () => {
  it("shows the secret once, stores only a hash, and authenticates v1 requests", async () => {
    const { client: c } = await ownerWithWorkspace("keys");
    const created = await c.post("/api/api-keys", { name: "Production sync" });
    expect(created.status).toBe(201);
    const secret = created.body.data.secret as string;
    expect(secret).toMatch(/^sb_live_/);
    expect(created.body.data.prefix).toBe(secret.slice(0, 12));

    const listed = (await c.get("/api/api-keys")).body.data;
    expect(JSON.stringify(listed)).not.toContain(secret);
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, created.body.data.id));
    expect(row!.keyHash).toBe(crypto.createHash("sha256").update(secret).digest("hex"));

    const release = await createRelease(c, { title: "Visible via API" });
    const v1 = await request(app).get("/api/v1/releases").set("Authorization", `Bearer ${secret}`);
    expect(v1.status).toBe(200);
    expect(v1.body.data.map((r: { id: string }) => r.id)).toContain(release.id);

    const contact = await request(app).post("/api/v1/contacts").set("Authorization", `Bearer ${secret}`).send({ externalId: "u-1", email: "Person@Example.com", plan: "pro" });
    expect(contact.body.data).toMatchObject({ externalId: "u-1", email: "person@example.com", plan: "pro" });

    expect((await c.delete(`/api/api-keys/${created.body.data.id}`)).status).toBe(200);
    const revoked = await request(app).get("/api/v1/releases").set("Authorization", `Bearer ${secret}`);
    expect(revoked.status).toBe(401);
    expect(revoked.body.error.code).toBe("INVALID_API_KEY");
  });

  it("enforces scopes and rejects missing keys", async () => {
    const { client: c } = await ownerWithWorkspace("scopes");
    const { secret } = (await c.post("/api/api-keys", { name: "Read only", scopes: ["releases:read"] })).body.data;
    const denied = await request(app).post("/api/v1/feedback").set("Authorization", `Bearer ${secret}`).send({ title: "From API" });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("INSUFFICIENT_SCOPE");
    expect((await request(app).get("/api/v1/releases")).body.error.code).toBe("API_KEY_REQUIRED");
  });
});

describe("webhooks", () => {
  let server: http.Server;
  let received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  let respondWith = 200;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received.push({ headers: req.headers, body });
        res.writeHead(respondWith).end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("delivers signed events that receivers can verify, and logs failures for retry", async () => {
    received = [];
    const { client: c } = await ownerWithWorkspace("hooks");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    const created = await c.post("/api/webhooks", { url, events: ["release.published"] });
    expect(created.status).toBe(201);
    const secret = created.body.data.secret as string;
    expect(JSON.stringify((await c.get("/api/webhooks")).body.data)).not.toContain(secret);

    const release = await createRelease(c, { title: "Hooked" });
    await publishRelease(c, release.id);
    const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.webhookId, created.body.data.id));
    expect(delivery).toMatchObject({ event: "release.published", status: "pending" });

    await deliverWebhookJob({ deliveryId: delivery!.id }, { attempt: 1 });
    expect(received).toHaveLength(1);
    const { headers, body } = received[0]!;
    const [t, v1] = String(headers["shipbrief-signature"]).split(",").map((part) => part.split("=")[1]);
    const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    expect(v1).toBe(expected);
    expect(headers["shipbrief-event-id"]).toBe(delivery!.eventId);
    expect(JSON.parse(body)).toMatchObject({ type: "release.published", data: { id: release.id, title: "Hooked" } });

    // A 5xx is recorded and rethrown so the queue retries with backoff.
    respondWith = 503;
    const test = await c.post(`/api/webhooks/${created.body.data.id}/test`);
    await expect(deliverWebhookJob({ deliveryId: test.body.data.id, manual: true }, { attempt: 1 })).rejects.toThrow();
    const log = (await c.get("/api/webhooks/deliveries")).body.data as { status: string; responseCode: number }[];
    expect(log.find((d) => d.responseCode === 503)?.status).toBe("failed");
    respondWith = 200;
  });

  it("classifies private network addresses for SSRF protection", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});
