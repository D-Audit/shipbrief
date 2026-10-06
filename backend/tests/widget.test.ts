import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config/env.js";
import { db } from "../src/database/client.js";
import { contacts } from "../src/database/schema.js";
import { client, createRelease, memberOf, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

const sign = (secret: string, userId: string) => crypto.createHmac("sha256", secret).update(userId).digest("hex");

async function widgetWithSecret(label: string) {
  const owner = await ownerWithWorkspace(label);
  const key = (await owner.client.get("/api/widget")).body.data.projectId as string;
  const secretRes = await owner.client.get("/api/widget/identity-secret");
  expect(secretRes.status).toBe(200);
  return { ...owner, key, secret: secretRes.body.data.secret as string };
}

const identify = (key: string, body: object, visitor?: string) => {
  const req = client().post(`/api/public/widget/${key}/identify`, body);
  return visitor ? req.set("X-Visitor-Id", visitor) : req;
};

const contactsIn = (workspaceId: string) => db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId));

describe("identified widget users", () => {
  it("adds a verified user as a contact the release email will reach, and links a later sign-in to the same person", async () => {
    const { client: c, workspaceId, key, secret } = await widgetWithSecret("identify");
    expect((await c.get("/api/widget")).body.data).toMatchObject({ identityVerification: true, emailSubscribe: true });

    const user = { id: "user_42", email: "Maya@Customer.com", name: "Maya", plan: "pro", tags: ["beta"] };
    const res = await identify(key, { user, userHash: sign(secret, "user_42") });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ email: "maya@customer.com", name: "Maya", subscribed: true });
    expect(res.body.data.session).toEqual(expect.any(String));

    const [contact] = await contactsIn(workspaceId);
    expect(contact).toMatchObject({ externalId: "user_42", email: "maya@customer.com", plan: "pro", tags: ["beta"], source: "widget" });
    expect(contact!.lastSeenAt).not.toBeNull();

    // The plan changes in their product: the next page load updates the same contact.
    await identify(key, { user: { ...user, plan: "team" }, userHash: sign(secret, "user_42") });
    const after = await contactsIn(workspaceId);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ plan: "team", source: "widget" });
  });

  it("refuses unsigned or forged identities, so nobody can add someone else's email from the browser", async () => {
    const { client: c, workspaceId, key, secret } = await widgetWithSecret("forged");
    const forged = await identify(key, { user: { id: "user_1", email: "victim@example.org" }, userHash: sign(secret, "user_2") });
    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe("WIDGET_IDENTITY_INVALID");
    expect((await identify(key, { user: { id: "user_1", email: "victim@example.org" } })).status).toBe(400);
    expect(await contactsIn(workspaceId)).toHaveLength(0);

    // A rotated secret invalidates hashes signed with the old one.
    const rotated = await c.post("/api/widget/identity-secret/rotate");
    expect(rotated.body.data.secret).not.toBe(secret);
    expect((await identify(key, { user: { id: "user_1" }, userHash: sign(secret, "user_1") })).status).toBe(401);
    expect((await identify(key, { user: { id: "user_1" }, userHash: sign(rotated.body.data.secret, "user_1") })).status).toBe(200);
  });

  it("links an existing imported contact by email and never re-subscribes someone who opted out", async () => {
    const { workspaceId, key, secret } = await widgetWithSecret("link");
    await db.insert(contacts).values({ workspaceId, email: "left@customer.com", source: "import", unsubscribedAt: new Date() });

    const res = await identify(key, { user: { id: "u-left", email: "left@customer.com" }, userHash: sign(secret, "u-left") });
    expect(res.body.data.user.subscribed).toBe(false);
    const rows = await contactsIn(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: "u-left", source: "import" });
    expect(rows[0]!.unsubscribedAt).not.toBeNull();
  });

  it("lets a signed-in user turn release emails off and on from the widget", async () => {
    const { workspaceId, key, secret } = await widgetWithSecret("toggle");
    const { session } = (await identify(key, { user: { id: "u1", email: "u1@customer.com" }, userHash: sign(secret, "u1") })).body.data;

    const off = await client().post(`/api/public/widget/${key}/subscription`, { subscribed: false }).set("X-Widget-Session", session);
    expect(off.body.data.subscribed).toBe(false);
    expect((await contactsIn(workspaceId))[0]!.unsubscribedAt).not.toBeNull();
    const on = await client().post(`/api/public/widget/${key}/subscription`, { subscribed: true }).set("X-Widget-Session", session);
    expect(on.body.data.subscribed).toBe(true);
    expect((await contactsIn(workspaceId))[0]!.unsubscribedAt).toBeNull();

    expect((await client().post(`/api/public/widget/${key}/subscription`, { subscribed: true })).status).toBe(401);
    // A session is only valid for the widget that issued it.
    const other = await widgetWithSecret("toggle-other");
    expect((await client().post(`/api/public/widget/${other.key}/subscription`, { subscribed: false }).set("X-Widget-Session", session)).status).toBe(401);
  });

  it("keeps read state per user across devices and carries over what they read before signing in", async () => {
    const { client: c, key, secret } = await widgetWithSecret("reads");
    const first = await createRelease(c, { title: "First", channels: ["in_app"] });
    const second = await createRelease(c, { title: "Second", channels: ["in_app"] });
    await publishRelease(c, first.id);
    await publishRelease(c, second.id);

    await client().post(`/api/public/widget/${key}/updates/${first.id}/read`).set("X-Visitor-Id", "laptop-visitor-1");
    const { session } = (await identify(key, { user: { id: "reader" }, userHash: sign(secret, "reader") }, "laptop-visitor-1")).body.data;

    // A different browser, same user: the earlier read is already there.
    const phone = (await client().get(`/api/public/widget/${key}/updates`).set("X-Visitor-Id", "phone-visitor-22").set("X-Widget-Session", session)).body.data;
    expect(phone.unreadCount).toBe(1);
    await client().post(`/api/public/widget/${key}/updates/${second.id}/read`).set("X-Visitor-Id", "phone-visitor-22").set("X-Widget-Session", session);
    const laptop = (await client().get(`/api/public/widget/${key}/updates`).set("X-Visitor-Id", "laptop-visitor-1").set("X-Widget-Session", session)).body.data;
    expect(laptop.unreadCount).toBe(0);
  });

  it("only lets technical roles see or rotate the identity secret", async () => {
    const { workspaceId } = await widgetWithSecret("secret-roles");
    const { client: marketer } = await memberOf(workspaceId, "marketer");
    expect((await marketer.get("/api/widget/identity-secret")).status).toBe(403);
    expect((await marketer.post("/api/widget/identity-secret/rotate")).status).toBe(403);
    const { client: developer } = await memberOf(workspaceId, "developer");
    expect((await developer.get("/api/widget/identity-secret")).status).toBe(200);
  });
});

describe("subscribing from the widget", () => {
  it("records the widget as the source once the confirmation link is clicked", async () => {
    const { client: c, workspaceId, slug } = await ownerWithWorkspace("widget-sub");
    expect((await c.patch("/api/widget", { emailSubscribe: false })).body.data.emailSubscribe).toBe(false);
    const key = (await c.get("/api/widget")).body.data.projectId;
    expect((await client().get(`/api/public/widget/${key}`)).body.data.emailSubscribe).toBe(false);

    const { devOutbox } = await import("../src/integrations/email/provider.js");
    await client().post(`/api/public/workspaces/${slug}/subscribe`, { email: "fan@customer.com", source: "widget" });
    const message = [...devOutbox()].reverse().find((m) => m.to === "fan@customer.com")!;
    await client().get(message.text.match(/\/api\/public\/subscribe\/confirm\?token=\S+/)![0]);
    expect((await contactsIn(workspaceId))[0]).toMatchObject({ email: "fan@customer.com", source: "widget" });
  });
});


describe("ShipBrief's own What's new panel", () => {
  it("is off until configured, then identifies the signed-in user to the configured widget", async () => {
    const { client: c, email, workspaceId, key } = await widgetWithSecret("dogfood");
    expect((await c.get("/api/auth/product-updates")).body.data).toBeNull();
    expect((await client().get("/api/auth/product-updates")).status).toBe(401);

    // Config is read-only to the app; the test points it at this workspace's widget and restores it.
    const mutableConfig = config as { PRODUCT_UPDATES_WIDGET_KEY?: string };
    mutableConfig.PRODUCT_UPDATES_WIDGET_KEY = key;
    try {
      const res = await c.get("/api/auth/product-updates");
      expect(res.body.data).toMatchObject({ key, user: { email } });
      // The app hands this straight to the widget, which accepts it.
      const identified = await identify(key, { user: res.body.data.user, userHash: res.body.data.userHash });
      expect(identified.status).toBe(200);
      expect((await contactsIn(workspaceId)).map((row) => row.email)).toEqual([email]);
    } finally {
      mutableConfig.PRODUCT_UPDATES_WIDGET_KEY = undefined;
    }
  });
});
