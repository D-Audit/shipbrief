import { desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AIError, aiProvider, setAIProvider, type AIProvider } from "../src/ai/index.js";
import { db } from "../src/database/client.js";
import { aiGenerations, usageCounters } from "../src/database/schema.js";
import { currentPeriod } from "../src/services/billing.service.js";
import { createRelease, memberOf, ownerWithWorkspace, resetRateLimits } from "./helpers.js";

const original = aiProvider;
beforeEach(resetRateLimits);
afterEach(() => setAIProvider(original));

function failingProvider(error: AIError): AIProvider {
  return { name: "fake", model: "fake-model", generate: async () => { throw error; } };
}

describe("AI service", () => {
  it("rewrites content, sanitizes output and records generation history and usage", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("ai");
    const release = await createRelease(c);
    const res = await c.post("/api/ai/rewrite", { text: "<p>In order to configure dashboards you can utilize filters.</p>", instruction: "Simplify the wording", releaseId: release.id });
    expect(res.status).toBe(200);
    expect(res.body.data.content).toContain("to configure dashboards you can use filters");
    expect(res.body.data.contextSummary).toMatch(/^Context attached/);

    const [generation] = await db.select().from(aiGenerations).where(eq(aiGenerations.workspaceId, workspaceId)).orderBy(desc(aiGenerations.createdAt));
    expect(generation).toMatchObject({ operation: "rewrite", status: "succeeded", provider: "dev", releaseId: release.id });
    const [usage] = await db.select().from(usageCounters).where(eq(usageCounters.workspaceId, workspaceId));
    expect(usage).toMatchObject({ metric: "ai_generations", period: currentPeriod(), count: 1 });
  });

  it("generates channel variants and quality reports from a stored release", async () => {
    const { client: c } = await ownerWithWorkspace("ai2");
    const release = await createRelease(c, { title: "Faster search", summary: "Results as you type" });
    const email = await c.post("/api/ai/channel-variant", { channel: "email", releaseId: release.id });
    expect(email.body.data.variant).toMatchObject({ channel: "email", subject: expect.any(String), previewText: expect.any(String) });
    const quality = await c.post("/api/ai/quality-check", { title: "t", summary: "", body: "<p>New endpoint configuration</p>" });
    expect(quality.body.data.score).toBeLessThan(100);
    expect(quality.body.data.issues.map((i: { id: string }) => i.id)).toEqual(expect.arrayContaining(["jargon", "benefit"]));
  });

  it("maps provider failures to clean errors and records the failed generation", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("aifail");
    setAIProvider(failingProvider(new AIError("AI_TIMEOUT", "The AI took too long to respond. Please try again.", 504)));
    const res = await c.post("/api/ai/rewrite", { text: "Hello there", instruction: "Shorter" });
    expect(res.status).toBe(504);
    expect(res.body.error).toEqual({ code: "AI_TIMEOUT", message: "The AI took too long to respond. Please try again." });
    const [generation] = await db.select().from(aiGenerations).where(eq(aiGenerations.workspaceId, workspaceId));
    expect(generation).toMatchObject({ status: "failed", errorCode: "AI_TIMEOUT" });
    // Failures don't consume the plan quota.
    expect(await db.select().from(usageCounters).where(eq(usageCounters.workspaceId, workspaceId))).toHaveLength(0);

    setAIProvider(failingProvider(new AIError("AI_NOT_CONFIGURED", "AI features aren't configured.", 503)));
    expect((await c.post("/api/ai/rewrite", { text: "Hello", instruction: "Shorter" })).status).toBe(503);

    setAIProvider({ name: "broken", model: "x", generate: async () => { throw new Error("socket hang up"); } });
    const unknown = await c.post("/api/ai/rewrite", { text: "Hello", instruction: "Shorter" });
    expect(unknown.status).toBe(502);
    expect(unknown.body.error.message).not.toContain("socket");
  });

  it("enforces the plan's monthly AI limit and blocks viewers", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("ailimit");
    await db.insert(usageCounters).values({ workspaceId, metric: "ai_generations", period: currentPeriod(), count: 1000 });
    const res = await c.post("/api/ai/rewrite", { text: "Hello", instruction: "Shorter" });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("PLAN_LIMIT_REACHED");

    const viewer = await memberOf(workspaceId, "viewer");
    expect((await viewer.client.post("/api/ai/rewrite", { text: "Hello", instruction: "Shorter" })).status).toBe(403);
  });

  it("validates AI input", async () => {
    const { client: c } = await ownerWithWorkspace("aival");
    expect((await c.post("/api/ai/rewrite", { text: "   ", instruction: "Shorter" })).body.error.code).toBe("EMPTY_INPUT");
    expect((await c.post("/api/ai/rewrite", { text: "Hi" })).body.error.code).toBe("VALIDATION_ERROR");
    expect((await c.post("/api/ai/channel-variant", { channel: "sms" })).status).toBe(400);
  });
});
