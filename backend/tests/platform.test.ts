import { beforeEach, describe, expect, it } from "vitest";
import { rollupAnalytics } from "../src/services/analytics.service.js";
import { parseCsv } from "../src/services/migration.service.js";
import { client, createRelease, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c10000000049454e44ae426082", "hex");

describe("analytics", () => {
  it("rolls raw events into daily aggregates that the dashboard reads", async () => {
    const { client: c, slug } = await ownerWithWorkspace("stats");
    const release = await createRelease(c, { title: "Measured", cta: { label: "Try it", url: "/try" } });
    await publishRelease(c, release.id);
    for (const visitor of ["v-aaaaaaaa1", "v-aaaaaaaa2", "v-aaaaaaaa3"]) {
      await client().post(`/api/public/workspaces/${slug}/views`, { slug: release.slug }).set("X-Visitor-Id", visitor);
    }
    await client().post(`/api/public/workspaces/${slug}/views`, { slug: release.slug }).set("X-Visitor-Id", "v-aaaaaaaa1"); // repeat view, deduplicated
    await client().post(`/api/public/workspaces/${slug}/releases/${release.slug}/reaction`).set("X-Visitor-Id", "v-aaaaaaaa1");
    await client().post(`/api/public/workspaces/${slug}/releases/${release.slug}/click`).set("X-Visitor-Id", "v-aaaaaaaa2");

    await rollupAnalytics();
    const overview = (await c.get("/api/analytics?range=7d")).body.data;
    expect(overview).toMatchObject({ views: 3, reactions: 1, ctaClicks: 1, clicks: 1, engagement: 67 });
    expect(overview.topReleases[0]).toMatchObject({ id: release.id, views: 3 });
    expect((await c.get(`/api/releases/${release.id}`)).body.data.views).toBe(3);

    const csv = await c.get("/api/analytics/export?range=7d");
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("release.viewed");

    const summary = (await c.get("/api/overview")).body.data;
    expect(summary.metrics.published).toBe(1);
  });
});

describe("uploads and imports", () => {
  it("accepts real images, rejects disguised or scripted files", async () => {
    const { client: c } = await ownerWithWorkspace("uploads");
    const ok = await c.agent.post("/api/uploads").set("Origin", "http://localhost:3000").field("purpose", "logo").attach("file", PNG, "logo.png");
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ contentType: "image/png" });
    const served = await client().get(ok.body.data.url);
    expect(served.status).toBe(200);
    expect(served.headers["content-security-policy"]).toContain("sandbox");

    const fake = await c.agent.post("/api/uploads").set("Origin", "http://localhost:3000").field("purpose", "logo").attach("file", Buffer.from("MZ executable"), "logo.png");
    expect(fake.body.error.code).toBe("UNSUPPORTED_FILE");
    const svg = await c.agent.post("/api/uploads").set("Origin", "http://localhost:3000").field("purpose", "logo").attach("file", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "logo.svg");
    expect(svg.body.error.code).toBe("UNSAFE_FILE");
  });

  it("parses CSV exports and imports posts as drafts without overwriting", async () => {
    const { client: c } = await ownerWithWorkspace("import");
    await createRelease(c, { title: "Dark mode" });
    const csv = 'title,content,published_at,tags\n"Dark mode","We added a dark theme, finally.",2025-01-10,ui\nFaster search,"Search, now instant",2025-02-01,"search,performance"\n';
    expect(parseCsv(csv)).toHaveLength(2);

    const uploaded = await c.agent.post("/api/uploads").set("Origin", "http://localhost:3000").field("purpose", "import").attach("file", Buffer.from(csv), "export.csv");
    expect(uploaded.status).toBe(201);
    const preview = await c.post("/api/imports/preview", { source: "csv", uploadId: uploaded.body.data.id });
    expect(preview.body.data).toMatchObject({ posts: 2, tags: 3, conflicts: 1 });
    const imported = await c.post("/api/imports", { source: "csv", uploadId: uploaded.body.data.id, preserveDates: true, preserveFormatting: true });
    expect(imported.status).toBe(201);
    expect(imported.body.data.imported).toBe(2);
    const drafts = (await c.get("/api/releases?status=draft")).body.data as { slug: string }[];
    expect(drafts.map((r) => r.slug).sort()).toEqual(["dark-mode", "dark-mode-2", "faster-search"]);
  });
});

describe("validation and error envelope", () => {
  it("returns consistent, safe error responses", async () => {
    const { client: c } = await ownerWithWorkspace("errors");
    const invalidId = await c.get("/api/releases/not-a-uuid");
    expect(invalidId.status).toBe(400);
    expect(invalidId.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(invalidId.body.requestId).toBeTruthy();

    const badJson = await c.agent.post("/api/releases").set("Origin", "http://localhost:3000").set("Content-Type", "application/json").send("{bad json");
    expect(badJson.body.error.code).toBe("INVALID_JSON");

    const tooLong = await c.post("/api/releases", { title: "x".repeat(500) });
    expect(tooLong.body.error.details[0].path).toBe("title");

    const missing = await c.get("/api/nope");
    expect(missing.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect((await client().get("/api/releases")).body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("activity feed and team invitations", () => {
  it("tracks read state per user", async () => {
    const { client: c } = await ownerWithWorkspace("activity");
    await createRelease(c, { title: "Activity A" }).then((r) => c.post(`/api/releases/${r.id}/submit`));
    await createRelease(c, { title: "Activity B" }).then((r) => c.post(`/api/releases/${r.id}/submit`));
    const unread = (await c.get("/api/activity?unreadOnly=true")).body.data as { id: string }[];
    expect(unread.length).toBeGreaterThanOrEqual(2);
    await c.post(`/api/activity/${unread[0]!.id}/read`);
    expect((await c.get("/api/activity?unreadOnly=true")).body.data).toHaveLength(unread.length - 1);
    await c.post("/api/activity/read-all");
    expect((await c.get("/api/activity?unreadOnly=true")).body.data).toHaveLength(0);
  });

  it("an invited person joins with the invited role once their email is verified", async () => {
    const owner = await ownerWithWorkspace("invites");
    const email = `invitee-${Date.now()}@test.shipbrief.dev`;
    const invite = await owner.client.post("/api/team/invitations", { name: "Ivy Invitee", email, role: "marketer" });
    expect(invite.body.data).toMatchObject({ status: "invited", role: "marketer" });
    expect((await owner.client.post("/api/team/invitations", { name: "Again", email, role: "viewer" })).status).toBe(409);

    const invitee = client();
    await invitee.post("/api/auth/register", { name: "Ivy Invitee", email, password: "a-strong-test-password" });
    expect((await invitee.get("/api/auth/session")).body.data.workspace).toBeNull(); // unverified: not yet a member
    const { devOutbox } = await import("../src/integrations/email/provider.js");
    const link = [...devOutbox()].reverse().find((m) => m.to === email && m.text.includes("verify-email"))!.text.match(/verify-email\?token=\S+/)![0];
    await invitee.agent.get(`/api/auth/${link}`);
    const session = (await invitee.get("/api/auth/session")).body.data;
    expect(session.workspace).toMatchObject({ id: owner.workspaceId, role: "marketer" });
    const team = (await owner.client.get("/api/team")).body.data as { email: string; status: string }[];
    expect(team.find((member) => member.email === email)?.status).toBe("active");
  });
});
