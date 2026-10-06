import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/database/client.js";
import { campaigns, contacts, emailDeliveries, jobs, releasePublications, releases } from "../src/database/schema.js";
import { sendCampaignJob } from "../src/services/campaign.service.js";
import { publishDueReleases } from "../src/services/release.service.js";
import { client, createRelease, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

describe("release CRUD", () => {
  it("creates a draft with a unique slug, sanitizes HTML and ignores server-owned fields", async () => {
    const { client: c } = await ownerWithWorkspace("crud");
    const first = await createRelease(c, { title: "Dark Mode!", body: '<p onclick="steal()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a>', status: "published", views: 9999, publishedBy: "hacker" });
    expect(first.status).toBe("draft");
    expect(first.views).toBe(0);
    expect(first.slug).toBe("dark-mode");
    expect(first.body).toBe("<p>Hi</p><a rel=\"noopener noreferrer nofollow\">x</a>");
    const second = await createRelease(c, { title: "Dark mode" });
    expect(second.slug).toBe("dark-mode-2");
  });

  it("records versions on content changes and can restore them", async () => {
    const { client: c } = await ownerWithWorkspace("versions");
    const release = await createRelease(c, { title: "Version one" });
    await c.patch(`/api/releases/${release.id}`, { title: "Version two", changeNote: "Retitled" });
    await c.patch(`/api/releases/${release.id}`, { featured: true }); // not versioned content
    const versions = (await c.get(`/api/releases/${release.id}/versions`)).body.data as { id: string; version: number; title: string; changeNote: string }[];
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0]).toMatchObject({ title: "Version two", changeNote: "Retitled" });

    const restored = await c.post(`/api/releases/${release.id}/versions/${versions[1]!.id}/restore`);
    expect(restored.body.data.title).toBe("Version one");
    expect(((await c.get(`/api/releases/${release.id}/versions`)).body.data as unknown[]).length).toBe(3);
  });

  it("lists with search, filters, pagination and status counts", async () => {
    const { client: c } = await ownerWithWorkspace("list");
    await createRelease(c, { title: "Faster search", tags: ["search"] });
    await createRelease(c, { title: "Billing exports", category: "Improvement" });
    const searched = await c.get("/api/releases?search=fast");
    expect(searched.body.data.map((r: { title: string }) => r.title)).toEqual(["Faster search"]);
    expect((await c.get("/api/releases?tag=search")).body.data).toHaveLength(1);
    const paged = await c.get("/api/releases?pageSize=1&page=2");
    expect(paged.body.meta).toMatchObject({ page: 2, pageSize: 1, total: 2, hasMore: false });
    expect((await c.get("/api/releases/counts")).body.data).toMatchObject({ all: 2, draft: 2, published: 0 });
  });

  it("duplicates releases and refuses to delete published ones", async () => {
    const { client: c } = await ownerWithWorkspace("dup");
    const release = await createRelease(c, { title: "Original" });
    const copy = await c.post(`/api/releases/${release.id}/duplicate`);
    expect(copy.status).toBe(201);
    expect(copy.body.data).toMatchObject({ title: "Original (copy)", status: "draft" });
    await publishRelease(c, release.id);
    const del = await c.delete(`/api/releases/${release.id}`);
    expect(del.status).toBe(409);
    expect((await c.delete(`/api/releases/${copy.body.data.id}`)).status).toBe(200);
    expect((await c.get(`/api/releases/${copy.body.data.id}`)).status).toBe(404);
  });
});

describe("release workflow", () => {
  it("allows only valid transitions", async () => {
    const { client: c } = await ownerWithWorkspace("flow");
    const release = await createRelease(c);
    const early = await c.post(`/api/releases/${release.id}/publish`);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect((await c.post(`/api/releases/${release.id}/approve`)).status).toBe(409);

    await c.post(`/api/releases/${release.id}/submit`);
    const sentBack = await c.post(`/api/releases/${release.id}/request-changes`, { note: "Lead with the benefit" });
    expect(sentBack.body.data).toMatchObject({ status: "draft", reviewNote: "Lead with the benefit" });

    await publishRelease(c, release.id);
    expect((await c.post(`/api/releases/${release.id}/submit`)).status).toBe(409); // published never returns to draft
    const archived = await c.post(`/api/releases/${release.id}/archive`);
    expect(archived.body.data.status).toBe("archived");
    expect((await c.patch(`/api/releases/${release.id}`, { title: "edit" })).status).toBe(409);
  });

  it("requires at least one channel to publish", async () => {
    const { client: c } = await ownerWithWorkspace("nochan");
    const release = await createRelease(c, { channels: [] });
    await c.post(`/api/releases/${release.id}/submit`);
    await c.post(`/api/releases/${release.id}/approve`);
    const res = await c.post(`/api/releases/${release.id}/publish`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NO_CHANNELS");
  });

  it("schedules, unschedules and auto-publishes when due", async () => {
    const { client: c } = await ownerWithWorkspace("sched");
    const release = await createRelease(c);
    await c.post(`/api/releases/${release.id}/submit`);
    await c.post(`/api/releases/${release.id}/approve`);
    const past = await c.post(`/api/releases/${release.id}/schedule`, { scheduledAt: new Date(Date.now() - 3600_000).toISOString() });
    expect(past.body.error.code).toBe("SCHEDULE_IN_PAST");

    const at = new Date(Date.now() + 3600_000).toISOString();
    expect((await c.post(`/api/releases/${release.id}/schedule`, { scheduledAt: at })).body.data.status).toBe("scheduled");
    expect((await c.post(`/api/releases/${release.id}/unschedule`)).body.data.status).toBe("approved");
    await c.post(`/api/releases/${release.id}/schedule`, { scheduledAt: at });

    await db.update(releases).set({ scheduledAt: new Date(Date.now() - 1000) }).where(eq(releases.id, release.id));
    expect(await publishDueReleases()).toBeGreaterThanOrEqual(1);
    const after = (await c.get(`/api/releases/${release.id}`)).body.data;
    expect(after.status).toBe("published");
    expect(after.publishedBy).toBe("Olivia Owner"); // attributed to whoever scheduled it
  });
});

describe("channel publishing", () => {
  it("records one publication per selected channel and exposes changelog + in-app separately", async () => {
    const { client: c, slug } = await ownerWithWorkspace("chan");
    const both = await createRelease(c, { title: "Everywhere", channels: ["changelog", "in_app"], channelVariants: { in_app: { channel: "in_app", format: "banner", title: "Short in-app title", summary: "s", body: "<p>in-app</p>" } } });
    const changelogOnly = await createRelease(c, { title: "Changelog only", channels: ["changelog"] });
    await publishRelease(c, both.id);
    await publishRelease(c, changelogOnly.id);

    const detail = (await c.get(`/api/releases/${both.id}`)).body.data;
    expect(detail.publications.map((p: { channel: string; status: string }) => `${p.channel}:${p.status}`).sort()).toEqual(["changelog:published", "in_app:published"]);

    const pub = (await client().get(`/api/public/workspaces/${slug}/releases`)).body.data.map((r: { title: string }) => r.title);
    expect(pub).toEqual(expect.arrayContaining(["Everywhere", "Changelog only"]));

    const widget = (await c.get("/api/widget")).body.data.projectId;
    const updates = (await client().get(`/api/public/widget/${widget}/updates`).set("X-Visitor-Id", "visitor-abc-123")).body.data;
    expect(updates.items.map((u: { title: string }) => u.title)).toEqual(["Short in-app title"]);
    expect(updates.unreadCount).toBe(1);
    await client().post(`/api/public/widget/${widget}/updates/${both.id}/read`).set("X-Visitor-Id", "visitor-abc-123");
    const after = (await client().get(`/api/public/widget/${widget}/updates`).set("X-Visitor-Id", "visitor-abc-123")).body.data;
    expect(after.unreadCount).toBe(0);
    expect(after.items[0].read).toBe(true);
  });

  it("email channel queues a campaign and delivers only to reachable contacts in the audience", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("email");
    await db.insert(contacts).values([
      { workspaceId, email: "pro1@example.com", plan: "pro" },
      { workspaceId, email: "pro2@example.com", plan: "pro", unsubscribedAt: new Date() },
      { workspaceId, email: "free1@example.com", plan: "free" },
    ]);
    const audience = (await c.post("/api/audiences", { name: "Pro", rules: { plans: ["pro"] } })).body.data;
    expect(audience.size).toBe(1);

    const release = await createRelease(c, { title: "Email launch", channels: ["email"], audienceId: audience.id });
    await publishRelease(c, release.id);
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.releaseId, release.id));
    expect(campaign!.status).toBe("scheduled");
    const [job] = await db.select().from(jobs).where(and(eq(jobs.type, "campaign.send"), sql`${jobs.payload}->>'campaignId' = ${campaign!.id}`));
    expect(job).toBeDefined();

    await sendCampaignJob({ campaignId: campaign!.id });
    const deliveries = await db.select().from(emailDeliveries).where(eq(emailDeliveries.campaignId, campaign!.id));
    expect(deliveries.map((d) => d.toEmail)).toEqual(["pro1@example.com"]);
    // The development provider records "logged" — it never claims an email was sent.
    expect(deliveries[0]!.status).toBe("logged");
    const [sent] = await db.select().from(campaigns).where(eq(campaigns.id, campaign!.id));
    expect(sent).toMatchObject({ status: "sent", recipientCount: 1, deliveredCount: 1 });
    const [publication] = await db.select().from(releasePublications).where(and(eq(releasePublications.releaseId, release.id), eq(releasePublications.channel, "email")));
    expect(publication!.status).toBe("published");

    // Idempotent: running the job again sends nothing new.
    await sendCampaignJob({ campaignId: campaign!.id });
    expect((await db.select().from(emailDeliveries).where(eq(emailDeliveries.campaignId, campaign!.id))).length).toBe(1);
  });
  it("links each email to the release's own changelog page, but only when it was published there", async () => {
    const { client: c, workspaceId, slug } = await ownerWithWorkspace("email-link");
    await db.insert(contacts).values({ workspaceId, email: `reader-${slug}@example.com` });
    const { devOutbox } = await import("../src/integrations/email/provider.js");
    const sentFor = async (title: string, channels: string[]) => {
      const release = await createRelease(c, { title, channels });
      await publishRelease(c, release.id);
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.releaseId, release.id));
      await sendCampaignJob({ campaignId: campaign!.id });
      return { release, message: [...devOutbox()].reverse().find((m) => m.to === `reader-${slug}@example.com` && m.subject === title)! };
    };

    const both = await sentFor("Changelog and email", ["changelog", "email"]);
    const pageUrl = `http://localhost:3000/c/${slug}/${both.release.slug}`;
    expect(both.message.html).toContain(`href="${pageUrl}"`);
    expect(both.message.text).toContain(`Read this update: ${pageUrl}`);

    const emailOnly = await sentFor("Email only", ["email"]);
    expect(emailOnly.message.text).not.toContain("Read this update");
    expect(emailOnly.message.text).toContain(`All updates: http://localhost:3000/c/${slug}`);
  });
});

describe("public engagement", () => {
  it("toggles reactions per visitor and accepts moderated comments", async () => {
    const { client: c, slug } = await ownerWithWorkspace("engage");
    const release = await createRelease(c, { title: "React to me" });
    await publishRelease(c, release.id);
    const visitor = client();
    const base = `/api/public/workspaces/${slug}/releases/${release.slug}`;
    expect((await visitor.post(`${base}/reaction`)).body.data).toMatchObject({ reactions: 1, hasReacted: true });
    expect((await visitor.post(`${base}/reaction`)).body.data).toMatchObject({ reactions: 0, hasReacted: false });

    const comment = await visitor.post(`${base}/comments`, { author: "Guest Person", body: "Love it" });
    expect(comment.status).toBe(201);
    expect((await visitor.post(`${base}/comments`, { body: "   " })).status).toBe(400);
    expect((await visitor.get(`${base}/comments`)).body.data).toHaveLength(1);
    expect((await c.post(`/api/releases/${release.id}/comments/${comment.body.data.id}/hide`)).status).toBe(200);
    expect((await visitor.get(`${base}/comments`)).body.data).toHaveLength(0);
  });

  it("accepts public feedback but rejects honeypot submissions", async () => {
    const { client: c, slug } = await ownerWithWorkspace("pubfb");
    const ok = await client().post(`/api/public/workspaces/${slug}/feedback`, { title: "Please add SSO", description: "Okta" });
    expect(ok.status).toBe(201);
    const bot = await client().post(`/api/public/workspaces/${slug}/feedback`, { title: "Buy cheap stuff", website: "http://spam" });
    expect(bot.status).toBe(400);
    const list = (await c.get("/api/feedback")).body.data as { title: string; source: string }[];
    expect(list.map((f) => f.title)).toEqual(["Please add SSO"]);
  });
});
