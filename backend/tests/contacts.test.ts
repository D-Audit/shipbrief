import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/database/client.js";
import { campaigns, contacts, emailDeliveries } from "../src/database/schema.js";
import { devOutbox } from "../src/integrations/email/provider.js";
import { client, createRelease, memberOf, ownerWithWorkspace, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

const contactsIn = (workspaceId: string) => db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId));

describe("contacts in the app", () => {
  it("adds, finds, filters and removes contacts, and refuses duplicates", async () => {
    const { client: c } = await ownerWithWorkspace("contacts");
    const added = await c.post("/api/contacts", { email: "Ada@Example.com", name: "Ada", plan: "pro", tags: ["Beta"] });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ email: "ada@example.com", name: "Ada", plan: "pro", tags: ["beta"], subscribed: true });

    const duplicate = await c.post("/api/contacts", { email: "ada@example.com" });
    expect(duplicate.status).toBe(409);
    expect((await c.post("/api/contacts", { email: "not-an-email" })).status).toBe(400);

    await c.post("/api/contacts", { email: "grace@example.com", name: "Grace" });
    const all = (await c.get("/api/contacts")).body.data;
    expect(all.counts).toEqual({ total: 2, subscribed: 2, unsubscribed: 0 });
    const found = (await c.get("/api/contacts?search=grac")).body.data;
    expect(found.items.map((item: { email: string }) => item.email)).toEqual(["grace@example.com"]);

    expect((await c.delete(`/api/contacts/${added.body.data.id}`)).status).toBe(200);
    expect((await c.get("/api/contacts")).body.data.counts.total).toBe(1);
  });

  it("keeps customer emails away from people who can't send to them", async () => {
    const { workspaceId } = await ownerWithWorkspace("contacts-roles");
    const { client: viewer } = await memberOf(workspaceId, "viewer");
    expect((await viewer.get("/api/contacts")).status).toBe(403);
    expect((await viewer.post("/api/contacts", { email: "x@example.com" })).status).toBe(403);
  });

  it("imports a CSV: reads headers, quotes and semicolons, skips bad rows, and never re-subscribes anyone", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("contacts-import");
    await db.insert(contacts).values({ workspaceId, email: "left@example.com", unsubscribedAt: new Date() });

    const csv = ['Email,Name,Plan,Tags', 'ada@example.com,"Lovelace, Ada",pro,"beta|vip"', "not-an-email,Nobody,,", "ADA@example.com,Ada again,,", "left@example.com,Left,free,", ",,,"].join("\n");
    const res = await c.post("/api/contacts/import", { csv });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ added: 1, updated: 1, skippedCount: 2 });
    expect(res.body.data.skipped.map((skip: { row: number }) => skip.row)).toEqual([3, 4]);

    const rows = await contactsIn(workspaceId);
    const ada = rows.find((row) => row.email === "ada@example.com")!;
    expect(ada).toMatchObject({ name: "Lovelace, Ada", plan: "pro", tags: ["beta", "vip"] });
    const left = rows.find((row) => row.email === "left@example.com")!;
    expect(left.plan).toBe("free");
    expect(left.unsubscribedAt).not.toBeNull();

    // A plain list of emails (no header) saved by Excel with semicolons also works.
    const plain = await c.post("/api/contacts/import", { csv: "grace@example.com;Grace\r\nlinus@example.com;Linus\r\n" });
    expect(plain.body.data).toMatchObject({ added: 2, updated: 0, skippedCount: 0 });
    expect((await contactsIn(workspaceId)).find((row) => row.email === "grace@example.com")!.name).toBeNull();
  });
});

describe("subscribing from the public changelog", () => {
  const confirmLink = (email: string) => {
    const message = [...devOutbox()].reverse().find((m) => m.to === email)!;
    return message.text.match(/\/api\/public\/subscribe\/confirm\?token=\S+/)![0];
  };

  it("emails a confirmation link and only subscribes once it's clicked", async () => {
    const { workspaceId, slug } = await ownerWithWorkspace("subscribe");
    const visitor = client();
    const res = await visitor.post(`/api/public/workspaces/${slug}/subscribe`, { email: "Reader@Example.com" });
    expect(res.status).toBe(202);
    expect(await contactsIn(workspaceId)).toHaveLength(0);

    const link = confirmLink("reader@example.com");
    const confirmed = await visitor.get(link);
    expect(confirmed.status).toBe(303);
    expect(confirmed.headers.location).toBe(`http://localhost:3000/c/${slug}?subscribed=1`);
    const [contact] = await contactsIn(workspaceId);
    expect(contact).toMatchObject({ email: "reader@example.com", tags: ["changelog"], unsubscribedAt: null });

    // Clicking again changes nothing.
    await visitor.get(link);
    expect(await contactsIn(workspaceId)).toHaveLength(1);
  });

  it("rejects altered links, and re-subscribes someone who unsubscribed only when they confirm", async () => {
    const { workspaceId, slug } = await ownerWithWorkspace("subscribe-again");
    await db.insert(contacts).values({ workspaceId, email: "back@example.com", unsubscribedAt: new Date() });
    const visitor = client();
    await visitor.post(`/api/public/workspaces/${slug}/subscribe`, { email: "back@example.com" });
    const link = confirmLink("back@example.com");

    const tampered = await visitor.get(link.replace(/token=./, "token=x"));
    expect(tampered.status).toBe(400);
    expect((await contactsIn(workspaceId))[0]!.unsubscribedAt).not.toBeNull();

    await visitor.get(link);
    const [contact] = await contactsIn(workspaceId);
    expect(contact!.unsubscribedAt).toBeNull();
    expect(contact!.tags).toEqual(["changelog"]);
  });

  it("validates the email and the workspace", async () => {
    const { slug } = await ownerWithWorkspace("subscribe-bad");
    expect((await client().post(`/api/public/workspaces/${slug}/subscribe`, { email: "nope" })).status).toBe(400);
    expect((await client().post(`/api/public/workspaces/no-such-workspace-x/subscribe`, { email: "a@example.com" })).status).toBe(404);
  });
});

describe("sending a test email", () => {
  it("sends the campaign only to the person testing it, marked as a test", async () => {
    const { client: c, email, workspaceId } = await ownerWithWorkspace("test-send");
    await db.insert(contacts).values({ workspaceId, email: "customer@example.com" });
    const release = await createRelease(c, { title: "Faster search", channels: ["changelog", "email"] });
    const campaign = (await c.post("/api/campaigns", { releaseId: release.id, subject: "Search is faster", previewText: "p" })).body.data;

    const res = await c.post(`/api/campaigns/${campaign.id}/test`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ to: email, status: "logged" });
    const message = [...devOutbox()].reverse().find((m) => m.to === email && m.subject.startsWith("[Test]"))!;
    expect(message.subject).toBe("[Test] Search is faster");

    expect(devOutbox().some((m) => m.to === "customer@example.com")).toBe(false);
    expect(await db.select().from(emailDeliveries).where(eq(emailDeliveries.campaignId, campaign.id))).toHaveLength(0);
    const [stored] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaign.id), eq(campaigns.workspaceId, workspaceId)));
    expect(stored!.status).toBe("draft");
  });
});
