import { beforeEach, describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "../src/services/permissions.js";
import { createRelease, memberOf, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

describe("role permissions", () => {
  it("matches the team page's role descriptions", () => {
    expect(can("viewer", "release:write")).toBe(false);
    expect(can("developer", "release:write")).toBe(true);
    expect(can("developer", "release:approve")).toBe(false);
    expect(can("marketer", "release:schedule")).toBe(true);
    expect(can("marketer", "release:publish")).toBe(false);
    expect(can("product_manager", "release:publish")).toBe(true);
    expect(can("admin", "workspace:delete")).toBe(false);
    expect(Object.keys(PERMISSIONS).every((permission) => can("owner", permission as keyof typeof PERMISSIONS))).toBe(true);
  });

  it("enforces roles on the API, not just in the UI", async () => {
    const owner = await ownerWithWorkspace("roles");
    const viewer = await memberOf(owner.workspaceId, "viewer");
    const developer = await memberOf(owner.workspaceId, "developer");
    const admin = await memberOf(owner.workspaceId, "admin");

    expect((await viewer.client.get("/api/releases")).status).toBe(200);
    const denied = await viewer.client.post("/api/releases", { title: "Nope" });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const release = await createRelease(developer.client);
    expect((await developer.client.post(`/api/releases/${release.id}/submit`)).status).toBe(200);
    expect((await developer.client.post(`/api/releases/${release.id}/approve`)).status).toBe(403);
    expect((await owner.client.post(`/api/releases/${release.id}/approve`)).status).toBe(200);
    expect((await developer.client.post(`/api/releases/${release.id}/publish`)).status).toBe(403);
    // Approved content is locked for non-approvers.
    const locked = await developer.client.patch(`/api/releases/${release.id}`, { title: "Sneaky edit after approval" });
    expect(locked.status).toBe(403);
    expect(locked.body.error.code).toBe("RELEASE_LOCKED");

    expect((await admin.client.post("/api/settings/delete", { confirmation: "anything" })).status).toBe(403);
    expect((await developer.client.post("/api/team/invitations", { name: "X", email: "x@example.com", role: "viewer" })).status).toBe(403);
  });

  it("never lets a role change grant ownership", async () => {
    const owner = await ownerWithWorkspace("own");
    await memberOf(owner.workspaceId, "developer");
    const team = (await owner.client.get("/api/team")).body.data as { id: string; role: string }[];
    const dev = team.find((member) => member.role === "developer")!;
    const res = await owner.client.patch(`/api/team/${dev.id}`, { role: "owner" });
    expect(res.status).toBe(403);
    const ownerRow = team.find((member) => member.role === "owner")!;
    expect((await owner.client.delete(`/api/team/${ownerRow.id}`)).status).toBe(409);
  });
});

describe("organization isolation (IDOR)", () => {
  it("user B cannot read or modify workspace A's data by id", async () => {
    const a = await ownerWithWorkspace("tenant-a");
    const b = await ownerWithWorkspace("tenant-b");
    const release = await createRelease(a.client, { title: "A secret roadmap item" });
    const feedback = (await a.client.post("/api/feedback", { title: "A's customer request", description: "private" })).body.data;
    const roadmapItem = (await a.client.post("/api/roadmap", { title: "A's plan" })).body.data;

    for (const res of [
      await b.client.get(`/api/releases/${release.id}`),
      await b.client.patch(`/api/releases/${release.id}`, { title: "hijacked" }),
      await b.client.delete(`/api/releases/${release.id}`),
      await b.client.post(`/api/releases/${release.id}/submit`),
      await b.client.get(`/api/releases/${release.id}/versions`),
      await b.client.get(`/api/feedback/${feedback.id}`),
      await b.client.post(`/api/feedback/${feedback.id}/vote`),
      await b.client.patch(`/api/roadmap/${roadmapItem.id}`, { title: "hijacked" }),
    ]) {
      expect(res.status).toBe(404);
    }

    // Referencing another tenant's ids inside a payload is rejected too.
    const bItem = (await b.client.post("/api/roadmap", { title: "B's item" })).body.data;
    const link = await b.client.patch(`/api/roadmap/${bItem.id}`, { linkedFeedbackIds: [feedback.id] });
    expect(link.status).toBe(400);
    const aAudience = ((await a.client.get("/api/audiences")).body.data as { id: string }[])[0]!;
    const crossAudience = await b.client.post("/api/releases", { title: "x", audienceId: aAudience.id });
    expect(crossAudience.status).toBe(400);

    const bList = (await b.client.get("/api/releases")).body.data as { id: string }[];
    expect(bList.find((item) => item.id === release.id)).toBeUndefined();
    expect((await a.client.get(`/api/releases/${release.id}`)).body.data.title).toBe("A secret roadmap item");
  });

  it("removing a member ends their access immediately", async () => {
    const owner = await ownerWithWorkspace("removal");
    const member = await memberOf(owner.workspaceId, "developer");
    await createRelease(owner.client);
    expect((await member.client.get("/api/releases")).status).toBe(200);
    const team = (await owner.client.get("/api/team")).body.data as { id: string; email: string }[];
    const row = team.find((entry) => entry.email === member.email)!;
    expect((await owner.client.delete(`/api/team/${row.id}`)).status).toBe(200);
    const after = await member.client.get("/api/releases");
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe("WORKSPACE_REQUIRED");
  });

  it("public endpoints never expose drafts or internal fields", async () => {
    const owner = await ownerWithWorkspace("public-iso");
    const draft = await createRelease(owner.client, { title: "Unreleased secret" });
    const live = await createRelease(owner.client, { title: "Live update" });
    await publishRelease(owner.client, live.id);

    const list = await owner.client.get(`/api/public/workspaces/${owner.slug}/releases`);
    const titles = (list.body.data as { title: string }[]).map((item) => item.title);
    expect(titles).toContain("Live update");
    expect(titles).not.toContain("Unreleased secret");
    const item = list.body.data[0];
    expect(item).not.toHaveProperty("createdBy");
    expect(item).not.toHaveProperty("status");
    expect(item).not.toHaveProperty("views");
    expect((await owner.client.get(`/api/public/workspaces/${owner.slug}/releases/${draft.slug}`)).status).toBe(404);
  });
});

describe("URL injection", () => {
  it("rejects javascript: URLs in links that the UI renders", async () => {
    const { client: c } = await ownerWithWorkspace("urls");
    for (const body of [
      { title: "x", sourceRefs: [{ id: "1", type: "manual", label: "PR", url: "javascript:alert(1)" }] },
      { title: "x", cta: { label: "Go", url: "javascript:alert(1)" } },
      { title: "x", media: [{ id: "m", type: "image", url: "javascript:alert(1)" }] },
    ]) {
      const res = await c.post("/api/releases", body);
      expect(res.status).toBe(400);
    }
    expect((await c.patch("/api/branding", { logoUrl: "javascript:alert(1)" })).status).toBe(400);
  });
});
