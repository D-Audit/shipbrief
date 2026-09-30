import { beforeEach, describe, expect, it } from "vitest";
import { createRelease, memberOf, ownerWithWorkspace, publishRelease, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);

describe("feedback", () => {
  it("creates, votes once per member, comments and updates status", async () => {
    const owner = await ownerWithWorkspace("fb");
    const pm = await memberOf(owner.workspaceId, "product_manager");
    const created = await owner.client.post("/api/feedback", { title: "Bulk edit", description: "Edit many rows", tags: ["Productivity"] });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ votes: 1, hasVoted: true, tags: ["productivity"], status: "new" });

    const id = created.body.data.id;
    expect((await pm.client.post(`/api/feedback/${id}/vote`)).body.data).toMatchObject({ votes: 2, hasVoted: true });
    expect((await pm.client.post(`/api/feedback/${id}/vote`)).body.data.votes).toBe(2); // idempotent

    await pm.client.post(`/api/feedback/${id}/comments`, { body: "Internal thought", isInternal: true });
    const comments = (await owner.client.get(`/api/feedback/${id}/comments`)).body.data;
    expect(comments[0]).toMatchObject({ body: "Internal thought", isInternal: true, author: "Member product_manager" });

    const updated = await pm.client.patch(`/api/feedback/${id}`, { status: "reviewing", priority: "high", internalNotes: "Big accounts" });
    expect(updated.body.data).toMatchObject({ status: "reviewing", priority: "high", comments: 1 });
    expect((await owner.client.get("/api/feedback?status=reviewing")).body.data).toHaveLength(1);
    expect((await owner.client.get("/api/feedback?search=bulk")).body.data).toHaveLength(1);
  });

  it("merges duplicates, deduplicating voters", async () => {
    const owner = await ownerWithWorkspace("merge");
    const a = (await owner.client.post("/api/feedback", { title: "Dark mode" })).body.data;
    const b = (await owner.client.post("/api/feedback", { title: "Night theme", tags: ["ui"] })).body.data;
    const merged = await owner.client.post(`/api/feedback/${b.id}/merge`, { targetId: a.id });
    expect(merged.status).toBe(200);
    // The same person voted on both, so the merged request counts them once.
    expect(merged.body.data).toMatchObject({ id: a.id, votes: 1, tags: ["ui"] });
    const list = (await owner.client.get("/api/feedback")).body.data as { id: string }[];
    expect(list.map((item) => item.id)).toEqual([a.id]);
    expect((await owner.client.post(`/api/feedback/${a.id}/merge`, { targetId: a.id })).status).toBe(400);
  });

  it("groups feedback into clusters with the AI service", async () => {
    const owner = await ownerWithWorkspace("cluster");
    await owner.client.post("/api/feedback", { title: "SSO", tags: ["security"] });
    await owner.client.post("/api/feedback", { title: "SAML", tags: ["security"] });
    await owner.client.post("/api/feedback", { title: "Export", tags: ["export"] });
    const res = await owner.client.post("/api/feedback/clusters/regenerate");
    expect(res.status).toBe(200);
    const clusters = res.body.data as { title: string; feedbackIds: string[] }[];
    expect(clusters.find((cluster) => cluster.title === "Security")?.feedbackIds).toHaveLength(2);
    expect((await owner.client.get("/api/feedback/clusters")).body.data).toHaveLength(clusters.length);
  });
});

describe("roadmap", () => {
  it("links feedback transactionally and derives votes from it", async () => {
    const owner = await ownerWithWorkspace("rm");
    const f1 = (await owner.client.post("/api/feedback", { title: "Saved filters" })).body.data;
    const f2 = (await owner.client.post("/api/feedback", { title: "Filter presets" })).body.data;
    const item = (await owner.client.post("/api/roadmap", { title: "Saved Filters", status: "next", linkedFeedbackIds: [f1.id, f2.id] })).body.data;
    expect(item).toMatchObject({ votes: 2, status: "next" });
    expect(item.linkedFeedbackIds.sort()).toEqual([f1.id, f2.id].sort());
    expect((await owner.client.get(`/api/feedback/${f1.id}`)).body.data.status).toBe("planned");

    const other = (await owner.client.post("/api/roadmap", { title: "Other" })).body.data;
    const conflict = await owner.client.patch(`/api/roadmap/${other.id}`, { linkedFeedbackIds: [f1.id] });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("FEEDBACK_ALREADY_LINKED");

    const unlinked = await owner.client.patch(`/api/roadmap/${item.id}`, { linkedFeedbackIds: [f2.id] });
    expect(unlinked.body.data.linkedFeedbackIds).toEqual([f2.id]);
    expect((await owner.client.get(`/api/feedback/${f1.id}`)).body.data.roadmapItemId).toBeUndefined();
  });

  it("only links published releases and closes the loop when a linked release ships", async () => {
    const owner = await ownerWithWorkspace("loop");
    const request = (await owner.client.post("/api/feedback", { title: "Dark mode" })).body.data;
    const item = (await owner.client.post("/api/roadmap", { title: "Dark Mode", status: "now", linkedFeedbackIds: [request.id] })).body.data;
    const draft = await createRelease(owner.client, { title: "Dark mode" });
    expect((await owner.client.patch(`/api/roadmap/${item.id}`, { linkedReleaseId: draft.id })).body.error.code).toBe("RELEASE_NOT_PUBLISHED");

    await owner.client.patch(`/api/feedback/${request.id}`, { linkedReleaseId: draft.id });
    await publishRelease(owner.client, draft.id);
    expect((await owner.client.get(`/api/feedback/${request.id}`)).body.data.status).toBe("shipped");
    expect((await owner.client.patch(`/api/roadmap/${item.id}`, { linkedReleaseId: draft.id })).status).toBe(200);
  });

  it("creates roadmap items from clusters and reorders columns", async () => {
    const owner = await ownerWithWorkspace("rmcl");
    await owner.client.post("/api/feedback", { title: "SSO", tags: ["security"] });
    const clusters = (await owner.client.post("/api/feedback/clusters/regenerate")).body.data;
    const created = await owner.client.post("/api/roadmap/from-cluster", { clusterId: clusters[0].id });
    expect(created.status).toBe(201);
    expect(created.body.data.linkedFeedbackIds).toHaveLength(1);
    const second = (await owner.client.post("/api/roadmap", { title: "Second", status: "later" })).body.data;
    const ordered = await owner.client.post("/api/roadmap/reorder", { status: "later", ids: [second.id, created.body.data.id] });
    expect(ordered.body.data.filter((i: { status: string }) => i.status === "later").map((i: { id: string }) => i.id)).toEqual([second.id, created.body.data.id]);
  });
});
