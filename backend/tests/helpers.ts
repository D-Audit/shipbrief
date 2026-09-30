import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../src/app/create-app.js";
import { db } from "../src/database/client.js";
import { memberships, users } from "../src/database/schema.js";
import type { TeamRole } from "../src/types/domain.js";

export const app = createApp();
export const ORIGIN = "http://localhost:3000";

/** A cookie-carrying client that sends the trusted Origin, like the web app does. */
export function client() {
  const agent = request.agent(app);
  const withOrigin = <T extends request.Test>(test: T) => test.set("Origin", ORIGIN);
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => withOrigin(agent.post(url)).send(body ?? {}),
    patch: (url: string, body?: object) => withOrigin(agent.patch(url)).send(body ?? {}),
    delete: (url: string) => withOrigin(agent.delete(url)),
  };
}
export type Client = ReturnType<typeof client>;

export const uniqueEmail = (label = "user") => `${label}-${crypto.randomUUID().slice(0, 8)}@test.shipbrief.dev`;
export const PASSWORD = "a-strong-test-password";

export async function resetRateLimits() {
  await db.execute(sql`delete from rate_limits`);
}

/** Registers a user and marks the email verified (the verification link itself is covered in auth tests). */
export async function registerVerified(name = "Test User", email = uniqueEmail()) {
  const c = client();
  const res = await c.post("/api/auth/register", { name, email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email));
  return { client: c, email };
}

/** A verified owner with a fresh workspace. */
export async function ownerWithWorkspace(label = "ws") {
  const { client: c, email } = await registerVerified("Olivia Owner");
  const slug = `${label}-${crypto.randomUUID().slice(0, 8)}`;
  const res = await c.post("/api/auth/onboarding", { workspaceName: `Workspace ${label}`, workspaceSlug: slug, role: "founder", goal: "all_of_the_above", channels: ["changelog", "email", "in_app"] });
  if (res.status !== 201) throw new Error(`onboarding failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client: c, email, workspaceId: res.body.data.id as string, slug };
}

/** Adds a new verified user to a workspace with the given role and returns their signed-in client. */
export async function memberOf(workspaceId: string, role: TeamRole) {
  const { client: c, email } = await registerVerified(`Member ${role}`);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  await db.insert(memberships).values({ workspaceId, userId: user!.id, role });
  // The session picks up the new membership on next resolution.
  const session = await c.get("/api/auth/session");
  if (session.body.data.workspace?.id !== workspaceId) throw new Error("membership not active on session");
  return { client: c, email, userId: user!.id };
}

export async function createRelease(c: Client, body: object = {}) {
  const res = await c.post("/api/releases", { title: "Test release", summary: "What changed for customers", body: "<p>Body</p>", channels: ["changelog"], ...body });
  if (res.status !== 201) throw new Error(`create release failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; slug: string; status: string } & Record<string, unknown>;
}

/** Walks a release through review and approval, then publishes it. */
export async function publishRelease(c: Client, id: string) {
  for (const step of ["submit", "approve", "publish"]) {
    const res = await c.post(`/api/releases/${id}/${step}`);
    if (res.status !== 200) throw new Error(`${step} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
}
