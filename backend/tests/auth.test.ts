import { eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/database/client.js";
import { sessions, users } from "../src/database/schema.js";
import { devOutbox } from "../src/integrations/email/provider.js";
import { app, client, ORIGIN, PASSWORD, registerVerified, resetRateLimits, uniqueEmail } from "./helpers.js";

function lastLinkFor(email: string, pattern: RegExp) {
  const message = [...devOutbox()].reverse().find((m) => m.to === email);
  return message?.text.match(pattern)?.[0];
}

beforeEach(resetRateLimits);

describe("registration", () => {
  it("creates an account, signs the user in and sends a verification email", async () => {
    const c = client();
    const email = uniqueEmail();
    const res = await c.post("/api/auth/register", { name: "Ada Lovelace", email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { email, flow: "verify" } });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/sb_session=.*HttpOnly.*SameSite=Lax/i);

    const session = await c.get("/api/auth/session");
    expect(session.body.data).toMatchObject({ user: { email }, emailVerified: false, needsOnboarding: true });
    expect(lastLinkFor(email, /verify-email\?token=\S+/)).toBeTruthy();

    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.email, email));
    expect(row!.hash).toMatch(/^scrypt\$/);
    expect(row!.hash).not.toContain(PASSWORD);
  });

  it("rejects weak passwords and duplicate emails", async () => {
    const email = uniqueEmail();
    const weak = await client().post("/api/auth/register", { name: "Weak", email, password: "short" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe("WEAK_PASSWORD");
    const common = await client().post("/api/auth/register", { name: "Common", email, password: "password123" });
    expect(common.body.error.code).toBe("WEAK_PASSWORD");

    await client().post("/api/auth/register", { name: "First", email, password: PASSWORD });
    const dup = await client().post("/api/auth/register", { name: "Second", email: email.toUpperCase(), password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("verifies email with a one-time link and then allows onboarding", async () => {
    const c = client();
    const email = uniqueEmail();
    await c.post("/api/auth/register", { name: "Grace Hopper", email, password: PASSWORD });

    const blocked = await c.post("/api/auth/onboarding", { workspaceName: "Grace Co", workspaceSlug: `grace-${Date.now()}`, role: "founder", goal: "release_updates", channels: ["changelog"] });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("EMAIL_NOT_VERIFIED");

    const link = lastLinkFor(email, /verify-email\?token=\S+/)!;
    const first = await c.agent.get(`/api/auth/${link}`);
    expect(first.status).toBe(303);
    expect(first.headers.location).toBe("http://localhost:3000/onboarding");
    const reused = await c.agent.get(`/api/auth/${link}`);
    expect(reused.headers.location).toContain("verification-link-invalid");

    const onboarded = await c.post("/api/auth/onboarding", { workspaceName: "Grace Co", workspaceSlug: `grace-${Date.now()}`, role: "founder", goal: "release_updates", channels: ["changelog"] });
    expect(onboarded.status).toBe(201);
    const session = await c.get("/api/auth/session");
    expect(session.body.data.workspace.role).toBe("owner");
    expect(session.body.data.permissions).toContain("release:publish");
  });

  it("rejects reserved and duplicate workspace slugs", async () => {
    const { client: c } = await registerVerified();
    const reserved = await c.post("/api/auth/onboarding", { workspaceName: "API", workspaceSlug: "api", role: "founder", goal: "release_updates", channels: ["changelog"] });
    expect(reserved.status).toBe(409);
    const invalid = await c.post("/api/auth/onboarding", { workspaceName: "Bad", workspaceSlug: "Not A Slug!", role: "founder", goal: "release_updates", channels: ["changelog"] });
    expect(invalid.status).toBe(400);
  });
});

describe("login and sessions", () => {
  it("logs in with correct credentials and rejects wrong ones with the same message", async () => {
    const { email } = await registerVerified();
    const wrong = await client().post("/api/auth/login", { email, password: "not-the-password" });
    const unknown = await client().post("/api/auth/login", { email: uniqueEmail("ghost"), password: "whatever-password" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);

    const c = client();
    const ok = await c.post("/api/auth/login", { email: email.toUpperCase(), password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe(email);
  });

  it("logout revokes the session server-side", async () => {
    const { client: c } = await registerVerified();
    const cookie = (await c.get("/api/auth/session")).request.cookies;
    expect(cookie).toBeDefined();
    const [before] = await db.select().from(sessions).orderBy(sessions.createdAt).limit(1);
    expect(before).toBeDefined();
    expect((await c.post("/api/auth/logout")).status).toBe(204);
    expect((await c.get("/api/auth/session")).body.data).toBeNull();
    expect((await c.get("/api/releases")).status).toBe(401);
  });

  it("treats expired and revoked sessions as signed out", async () => {
    const { client: c, email } = await registerVerified();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, user!.id));
    const res = await c.get("/api/auth/session");
    expect(res.body.data).toBeNull();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/sb_session=;/);
  });

  it("rate limits repeated login attempts", async () => {
    const email = uniqueEmail();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await client().post("/api/auth/login", { email, password: "wrong-password-x" })).status);
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("password reset", () => {
  it("resets with a one-time token and signs out every other session", async () => {
    const { client: c, email } = await registerVerified();
    const unknown = await client().post("/api/auth/forgot-password", { email: uniqueEmail("nobody") });
    expect(unknown.status).toBe(200); // never reveals whether an account exists

    await client().post("/api/auth/forgot-password", { email });
    const link = lastLinkFor(email, /reset-password\?token=[^&\s]+/)!;
    const token = decodeURIComponent(link.split("token=")[1]!);

    const reset = await client().post("/api/auth/reset-password", { token, password: "a-brand-new-password" });
    expect(reset.status).toBe(200);
    expect((await c.get("/api/auth/session")).body.data).toBeNull();
    const again = await client().post("/api/auth/reset-password", { token, password: "another-new-password" });
    expect(again.body.error.code).toBe("INVALID_RESET_TOKEN");
    expect((await client().post("/api/auth/login", { email, password: "a-brand-new-password" })).status).toBe(200);
  });
});

describe("CSRF protection", () => {
  it("rejects state-changing requests with a session cookie from an untrusted origin", async () => {
    const { client: c } = await registerVerified();
    const cookies = (await c.agent.get("/api/auth/session")).request.cookies;
    const res = await request(app).post("/api/auth/logout").set("Cookie", cookies).set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_REJECTED");
    const trusted = await request(app).post("/api/auth/logout").set("Cookie", cookies).set("Origin", ORIGIN);
    expect(trusted.status).toBe(204);
  });
});
