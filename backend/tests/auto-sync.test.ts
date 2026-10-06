import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/database/client.js";
import { integrationItems, integrations, jobs, releases } from "../src/database/schema.js";
import { syncDueIntegrations } from "../src/services/integration.service.js";
import { encryptSecret } from "../src/utils/crypto.js";
import { ownerWithWorkspace, resetRateLimits } from "./helpers.js";

beforeEach(resetRateLimits);
afterEach(() => vi.restoreAllMocks());

const minute = 60 * 1000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

type FakePull = { number: number; title: string; mergedMsAgo: number };

/** Answers GitHub's pull request listing for one repo; every other repo in the shared test database gets a 404. */
function mockPulls(repo: string, pulls: () => FakePull[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === `/repos/${repo}/pulls`) {
      if (url.searchParams.get("page") !== "1") return Response.json([]);
      return Response.json(
        pulls().map((pull) => ({ number: pull.number, title: pull.title, html_url: `https://github.com/${repo}/pull/${pull.number}`, merged_at: iso(pull.mergedMsAgo), updated_at: iso(pull.mergedMsAgo) })),
      );
    }
    return Response.json({ message: "Not Found" }, { status: 404 });
  });
}

async function connectedRepo(label: string, lastSyncAt: Date | null = null) {
  const owner = await ownerWithWorkspace(label);
  const repo = `acme/${label}-${crypto.randomUUID().slice(0, 6)}`;
  const [row] = await db
    .insert(integrations)
    .values({ workspaceId: owner.workspaceId, provider: "github", status: "connected", accountLabel: "acme", detail: repo, accessTokenEnc: encryptSecret("token-test"), config: { track: "pull_requests" }, lastSyncAt })
    .returning();
  return { ...owner, repo, integrationId: row!.id };
}

const draftsIn = (workspaceId: string) => db.select().from(releases).where(eq(releases.workspaceId, workspaceId));
const makeDue = (integrationId: string) => db.update(integrations).set({ lastSyncAt: new Date(Date.now() - 60 * minute) }).where(eq(integrations.id, integrationId));

describe("automatic sync", () => {
  it("drafts newly merged work without anyone clicking Sync, and leaves recently synced sources alone", async () => {
    const due = await connectedRepo("auto-due");
    const fresh = await connectedRepo("auto-fresh", new Date());
    mockPulls(due.repo, () => [{ number: 1, title: "Add CSV export", mergedMsAgo: 2 * 60 * minute }]);

    await syncDueIntegrations(1000);

    const drafts = await draftsIn(due.workspaceId);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.status).toBe("draft");
    expect(drafts[0]!.sourceRefs).toEqual([expect.objectContaining({ id: "github:1", url: `https://github.com/${due.repo}/pull/1` })]);
    expect(await draftsIn(fresh.workspaceId)).toHaveLength(0);
  });

  it("keeps folding new work into one draft until a person edits it", async () => {
    const { client: c, workspaceId, repo, integrationId } = await connectedRepo("auto-rolling");
    let pulls: FakePull[] = [{ number: 1, title: "Add CSV export", mergedMsAgo: 3 * 60 * minute }];
    mockPulls(repo, () => pulls);
    await syncDueIntegrations(1000);

    // A second merged PR lands in the same untouched draft.
    pulls = [...pulls, { number: 2, title: "Faster search", mergedMsAgo: 30 * minute }];
    await makeDue(integrationId);
    await syncDueIntegrations(1000);
    let drafts = await draftsIn(workspaceId);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.sourceRefs.map((ref) => ref.id)).toEqual(["github:1", "github:2"]);
    const items = await db.select().from(integrationItems).where(and(eq(integrationItems.integrationId, integrationId), eq(integrationItems.releaseId, drafts[0]!.id)));
    expect(items).toHaveLength(2);

    // Once someone edits it, the draft is theirs: new work starts a fresh draft instead of overwriting the edit.
    expect((await c.patch(`/api/releases/${drafts[0]!.id}`, { title: "Our March update" })).status).toBe(200);
    pulls = [...pulls, { number: 3, title: "Dark mode", mergedMsAgo: 5 * minute }];
    await makeDue(integrationId);
    await syncDueIntegrations(1000);
    drafts = await draftsIn(workspaceId);
    expect(drafts).toHaveLength(2);
    expect(drafts.find((release) => release.title === "Our March update")!.sourceRefs).toHaveLength(2);
    expect(drafts.find((release) => release.title !== "Our March update")!.sourceRefs.map((ref) => ref.id)).toEqual(["github:3"]);
  });

  it("emails the team about a broken connection once, then waits a full interval before retrying", async () => {
    const { workspaceId, integrationId } = await connectedRepo("auto-broken");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ message: "Not Found" }, { status: 404 }));
    const failureEmails = async () =>
      (await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.type, "email.send"), sql`${jobs.payload}->>'workspaceId' = ${workspaceId}`))).length;

    await syncDueIntegrations(1000);
    expect(await failureEmails()).toBe(1);
    const [afterFirst] = await db.select().from(integrations).where(eq(integrations.id, integrationId));
    expect(afterFirst!.lastError).toContain("can't find");

    // Not retried straight away...
    await syncDueIntegrations(1000);
    const [afterSecond] = await db.select().from(integrations).where(eq(integrations.id, integrationId));
    expect(afterSecond!.updatedAt.getTime()).toBe(afterFirst!.updatedAt.getTime());

    // ...and when it is, the team isn't emailed again for the same ongoing problem.
    await db.update(integrations).set({ updatedAt: new Date(Date.now() - 60 * minute) }).where(eq(integrations.id, integrationId));
    await syncDueIntegrations(1000);
    expect(await failureEmails()).toBe(1);
  });
});
