import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/database/client.js";
import { integrations, oauthAccounts, users } from "../src/database/schema.js";
import { encryptSecret } from "../src/utils/crypto.js";
import { devOutbox } from "../src/integrations/email/provider.js";
import { passwordChangedTemplate, releaseEmailTemplate, verifyEmailTemplate, welcomeTemplate } from "../src/integrations/email/templates.js";
import { client, memberOf, ownerWithWorkspace, PASSWORD, registerVerified, resetRateLimits, uniqueEmail } from "./helpers.js";

beforeEach(resetRateLimits);
afterEach(() => vi.restoreAllMocks());

const messagesTo = (email: string) => devOutbox().filter((m) => m.to === email);

type GitHubFake = { id: number; login: string; name?: string; emails: { email: string; primary: boolean; verified: boolean }[] };

/** Answers GitHub's token, user and emails endpoints; anything else is unexpected. */
function mockGitHub(profile: GitHubFake) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://github.com/login/oauth/access_token")) return Response.json({ access_token: "gho_test", token_type: "bearer" });
    if (url === "https://api.github.com/user") return Response.json({ id: profile.id, login: profile.login, name: profile.name ?? null, avatar_url: "https://avatars.test/u" });
    if (url === "https://api.github.com/user/emails") return Response.json(profile.emails);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
}

function mockGoogle(profile: { sub: string; email: string; email_verified: boolean; name?: string }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://oauth2.googleapis.com/token") {
      // PKCE: the verifier must be sent with the code.
      expect(String(init?.body)).toMatch(/code_verifier=[\w-]{40,}/);
      return Response.json({ access_token: "ya29.test" });
    }
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json(profile);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
}

async function startFlow(c: ReturnType<typeof client>, provider: "google" | "github", intent = "signUp") {
  const res = await c.get(`/api/auth/oauth/${provider}/start?intent=${intent}`);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.location ?? "");
  return { location, state: location.searchParams.get("state")! };
}

describe("social sign-in providers", () => {
  it("reports which providers are configured", async () => {
    const res = await client().get("/api/auth/providers");
    expect(res.body.data).toEqual({ google: true, github: true });
  });

  it("rejects unknown providers", async () => {
    const res = await client().get("/api/auth/oauth/twitter/start");
    expect(res.status).toBe(400);
  });

  it("sends Google users to Google with PKCE and a single-use state", async () => {
    const { location, state } = await startFlow(client(), "google");
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/google/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(state.length).toBeGreaterThan(20);
  });

  it("sends GitHub users to GitHub with minimal scopes", async () => {
    const { location } = await startFlow(client(), "github");
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-github-client");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/github/callback");
    expect(location.searchParams.get("scope")).toBe("read:user user:email");
  });
});

describe("GitHub sign-in", () => {
  it("creates a verified account, signs in, and sends one welcome email", async () => {
    const c = client();
    const email = uniqueEmail("gh");
    mockGitHub({ id: 900_001, login: "octo-ada", name: "Ada Octo", emails: [{ email: "other@test.dev", primary: false, verified: true }, { email, primary: true, verified: true }] });
    const { state } = await startFlow(c, "github");

    const callback = await c.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
    expect(callback.status).toBe(303);
    expect(callback.headers.location).toBe("http://localhost:3000/onboarding");
    expect(callback.headers["set-cookie"]?.[0]).toMatch(/sb_session=.*HttpOnly/i);

    const session = await c.get("/api/auth/session");
    expect(session.body.data).toMatchObject({ user: { email, name: "Ada Octo" }, emailVerified: true, needsOnboarding: true });
    const welcome = messagesTo(email).filter((m) => m.subject === "Welcome to ShipBrief");
    expect(welcome).toHaveLength(1);

    // The state is single-use: replaying the callback fails.
    const replay = await client().get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
    expect(replay.headers.location).toBe("http://localhost:3000/login?notice=oauth-failed&provider=github");
  });

  it("signs a returning GitHub user into the same account without a second welcome", async () => {
    const email = uniqueEmail("gh-return");
    const profile = { id: 900_002, login: "returning", emails: [{ email, primary: true, verified: true }] };
    for (let i = 0; i < 2; i++) {
      const c = client();
      mockGitHub(profile);
      const { state } = await startFlow(c, "github", "signIn");
      await c.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
      vi.restoreAllMocks();
    }
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(1);
    expect(messagesTo(email).filter((m) => m.subject === "Welcome to ShipBrief")).toHaveLength(1);
  });

  it("links to an existing password account with the same verified email", async () => {
    const { email } = await registerVerified("Existing Person");
    const c = client();
    mockGitHub({ id: 900_003, login: "existing", emails: [{ email, primary: true, verified: true }] });
    const { state } = await startFlow(c, "github", "signIn");
    await c.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    const links = await db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, user!.id));
    expect(links.map((link) => link.provider)).toEqual(["github"]);
    expect((await c.get("/api/auth/session")).body.data.user.email).toBe(email);
    expect(messagesTo(email).some((m) => m.subject === "Welcome to ShipBrief")).toBe(false);
  });

  it("refuses GitHub accounts without a verified primary email", async () => {
    const c = client();
    const email = uniqueEmail("gh-unverified");
    mockGitHub({ id: 900_004, login: "unverified", emails: [{ email, primary: true, verified: false }] });
    const { state } = await startFlow(c, "github");
    const callback = await c.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
    expect(callback.headers.location).toBe("http://localhost:3000/login?notice=oauth-email-unverified&provider=github");
    expect(await db.select().from(users).where(eq(users.email, email))).toHaveLength(0);
  });

  it("returns to sign-in when the user cancels at GitHub", async () => {
    const res = await client().get("/api/auth/oauth/github/callback?error=access_denied");
    expect(res.headers.location).toBe("http://localhost:3000/login?notice=oauth-cancelled&provider=github");
  });
});

describe("Google sign-in", () => {
  it("creates a verified account from a verified Google identity", async () => {
    const c = client();
    const email = uniqueEmail("google");
    mockGoogle({ sub: "google-sub-1", email, email_verified: true, name: "Grace G" });
    const { state } = await startFlow(c, "google");
    const callback = await c.get(`/api/auth/oauth/google/callback?code=xyz&state=${state}`);
    expect(callback.headers.location).toBe("http://localhost:3000/onboarding");
    expect((await c.get("/api/auth/session")).body.data).toMatchObject({ user: { email }, emailVerified: true });
  });

  it("refuses unverified Google emails", async () => {
    const c = client();
    mockGoogle({ sub: "google-sub-2", email: uniqueEmail("google-unverified"), email_verified: false });
    const { state } = await startFlow(c, "google");
    const callback = await c.get(`/api/auth/oauth/google/callback?code=xyz&state=${state}`);
    expect(callback.headers.location).toBe("http://localhost:3000/login?notice=oauth-email-unverified&provider=google");
  });
});

describe("account emails", () => {
  it("sends a welcome email once the address is verified", async () => {
    const c = client();
    const email = uniqueEmail("welcome");
    await c.post("/api/auth/register", { name: "Wendy Welcome", email, password: PASSWORD });
    expect(messagesTo(email).map((m) => m.subject)).toEqual(["Confirm your email for ShipBrief"]);
    const link = messagesTo(email)[0]!.text.match(/verify-email\?token=\S+/)![0];
    await c.agent.get(`/api/auth/${link}`);
    expect(messagesTo(email).map((m) => m.subject)).toEqual(["Confirm your email for ShipBrief", "Welcome to ShipBrief"]);
  });

  it("sends a security notice when the password is changed", async () => {
    const { client: c, email } = await registerVerified("Sec Person");
    const res = await c.post("/api/auth/password", { currentPassword: PASSWORD, newPassword: "another-strong-password" });
    expect(res.status).toBe(204);
    const notice = messagesTo(email).find((m) => m.subject === "Your ShipBrief password was changed");
    expect(notice).toBeTruthy();
    expect(notice!.text).toContain(`http://localhost:3000/forgot-password?email=${encodeURIComponent(email)}`);
  });

  it("sends a security notice after a password reset", async () => {
    const { email } = await registerVerified("Reset Person");
    await client().post("/api/auth/forgot-password", { email });
    const token = decodeURIComponent(messagesTo(email).at(-1)!.text.match(/token=([^&\s]+)/)![1]!);
    const res = await client().post("/api/auth/reset-password", { token, password: "a-brand-new-password" });
    expect(res.status).toBe(200);
    expect(messagesTo(email).at(-1)!.subject).toBe("Your ShipBrief password was changed");
  });
});

describe("email templates", () => {
  it("escape user-supplied names and use the ShipBrief accent", () => {
    const rendered = verifyEmailTemplate({ name: "<script>alert(1)</script>", url: "http://localhost:3000/api/auth/verify-email?token=t" });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("#C7F238");
    expect(rendered.html).toContain("http://localhost:3000/brand/email-mark.png");
    expect(rendered.text).toContain("verify-email?token=t");
  });

  it("include the time and IP in the password-changed notice", () => {
    const rendered = passwordChangedTemplate({ name: "Ann", when: new Date("2026-09-30T10:15:00Z"), ipAddress: "203.0.113.9", resetUrl: "http://localhost:3000/forgot-password" });
    expect(rendered.html).toContain("2026-09-30 10:15 UTC");
    expect(rendered.html).toContain("203.0.113.9");
    expect(welcomeTemplate({ name: "Ann", url: "http://localhost:3000/onboarding" }).subject).toBe("Welcome to ShipBrief");
  });

  it("brand release emails with the workspace, not ShipBrief, and keep buttons readable", () => {
    const light = releaseEmailTemplate({ workspaceName: "Acme", subject: "New", previewText: "p", bodyHtml: "<p>Hi</p>", cta: { label: "Try it", url: "https://acme.test" }, accent: "#C7F238", unsubscribeUrl: "u", changelogUrl: "c" });
    expect(light.html).toContain("Acme");
    expect(light.html).not.toContain("email-mark.png");
    expect(light.html).toMatch(/background:#C7F238;color:#171717/);
    const dark = releaseEmailTemplate({ workspaceName: "Acme", subject: "New", previewText: "p", bodyHtml: "<p>Hi</p>", cta: { label: "Try it", url: "https://acme.test" }, accent: "#1d4ed8", unsubscribeUrl: "u", changelogUrl: "c" });
    expect(dark.html).toMatch(/background:#1d4ed8;color:#ffffff/);
  });
});

describe("source integrations", () => {
  it("lists every provider with whether it's configured, and refuses to connect unconfigured ones", async () => {
    const { client: c } = await ownerWithWorkspace("integrations");
    const list = await c.get("/api/integrations");
    const byProvider = Object.fromEntries(list.body.data.map((item: { provider: string; configured: boolean }) => [item.provider, item.configured]));
    expect(byProvider).toEqual({ github: true, gitlab: false, linear: false, jira: false });

    const refused = await c.post("/api/integrations/gitlab/connect");
    expect(refused.status).toBe(503);
    expect(refused.body.error.code).toBe("INTEGRATION_NOT_CONFIGURED");

    const github = await c.post("/api/integrations/github/connect");
    const authorize = new URL(github.body.data.authorizeUrl);
    expect(authorize.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/integrations/github/callback");
    expect(authorize.searchParams.get("scope")).toBe("repo read:user");
  });
});

describe("choosing what a source watches", () => {
  async function connect(workspaceId: string, provider: "github" | "linear") {
    await db.insert(integrations).values({ workspaceId, provider, status: "connected", accountLabel: "octo", accessTokenEnc: encryptSecret("token-test"), config: {} });
  }

  it("lists the GitHub account's repositories across pages, private ones flagged", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("targets");
    await connect(workspaceId, "github");
    const page1 = Array.from({ length: 100 }, (_, i) => ({ full_name: `acme/repo-${i}`, description: i === 0 ? "Web app" : null, private: i % 2 === 0, pushed_at: "2026-09-29T10:00:00Z" }));
    const page2 = [{ full_name: "acme/last", description: null, private: false, pushed_at: null }];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-test");
      const page = new URL(url).searchParams.get("page");
      if (url.includes("/user/repos") && page === "1") return Response.json(page1);
      if (url.includes("/user/repos") && page === "2") return Response.json(page2);
      if (url === "https://api.github.com/repos/acme/repo-0") return Response.json({ full_name: "acme/repo-0" });
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await c.get("/api/integrations/github/targets");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(101);
    expect(res.body.data[0]).toEqual({ value: "acme/repo-0", label: "acme/repo-0", description: "Web app", private: true, updatedAt: "2026-09-29T10:00:00Z" });
    expect(res.body.data.at(-1)).toMatchObject({ value: "acme/last", private: false });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockClear();

    const saved = await c.patch("/api/integrations/github", { detail: "acme/repo-0" });
    expect(saved.body.data.detail).toBe("acme/repo-0");
  });

  it("lists Linear teams by key", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("targets-linear");
    await connect(workspaceId, "linear");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ data: { teams: { nodes: [{ key: "ENG", name: "Engineering", description: null }] } } }));
    const res = await c.get("/api/integrations/linear/targets");
    expect(res.body.data).toEqual([{ value: "ENG", label: "Engineering", description: "Team key ENG" }]);
  });

  it("refuses unconnected providers and roles without integration access", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("targets-guard");
    const notConnected = await c.get("/api/integrations/gitlab/targets");
    expect(notConnected.status).toBe(400);
    expect(notConnected.body.error.code).toBe("INTEGRATION_NOT_CONNECTED");

    const { client: marketer } = await memberOf(workspaceId, "marketer");
    const forbidden = await marketer.get("/api/integrations/github/targets");
    expect(forbidden.status).toBe(403);
  });

  it("explains a revoked GitHub connection instead of failing silently", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("targets-revoked");
    await connect(workspaceId, "github");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("Bad credentials", { status: 401 }));
    const res = await c.get("/api/integrations/github/targets");
    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe("GitHub rejected the connection. Reconnect it.");
  });
});

describe("checking the chosen scope", () => {
  async function connectGitHub(workspaceId: string, detail = "") {
    await db.insert(integrations).values({ workspaceId, provider: "github", status: "connected", accountLabel: "D-Audit", detail, accessTokenEnc: encryptSecret("token-test"), config: {} });
  }
  const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

  it("refuses a repository that doesn't exist and suggests the same name under the real owner", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("verify");
    await connectGitHub(workspaceId);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/repos/Ship/Ai-recruiter") return notFound();
      if (url.includes("/user/repos")) return Response.json([{ full_name: "D-Audit/Ai-recruiter", description: null, private: true, pushed_at: null }]);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const res = await c.patch("/api/integrations/github", { detail: "Ship/Ai-recruiter" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "INTEGRATION_TARGET_NOT_FOUND", details: { suggestion: "D-Audit/Ai-recruiter" } });
    expect(res.body.error.message).toBe("GitHub can't find the repository “Ship/Ai-recruiter”, or this connection can't access it. Did you mean “D-Audit/Ai-recruiter”?");
    const [row] = await db.select({ detail: integrations.detail }).from(integrations).where(eq(integrations.workspaceId, workspaceId));
    expect(row!.detail).toBe("");
  });

  it("turns a sync 404 into a plain explanation instead of the raw provider response", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("verify-sync");
    await connectGitHub(workspaceId, "Ship/Ai-recruiter");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => notFound());
    const res = await c.post("/api/integrations/github/sync");
    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe("GitHub can't find “Ship/Ai-recruiter”, or this connection can't access it. Choose it again in Manage.");
    expect(res.body.error.message).not.toContain("HTTP 404");
  });
});

describe("sync from a chosen date", () => {
  const day = 24 * 60 * 60 * 1000;
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
  const dateOnly = (msAgo: number) => iso(msAgo).slice(0, 10);

  async function connectedRepo(label: string, lastSyncAt: Date | null = new Date()) {
    const owner = await ownerWithWorkspace(label);
    await db.insert(integrations).values({ workspaceId: owner.workspaceId, provider: "github", status: "connected", accountLabel: "D-Audit", detail: "D-Audit/Ai-recruiter", accessTokenEnc: encryptSecret("token-test"), config: { track: "pull_requests" }, lastSyncAt });
    return owner;
  }

  it("rejects dates in the future or more than 90 days back", async () => {
    const { client: c } = await connectedRepo("since-range");
    const future = await c.post("/api/integrations/github/sync", { since: dateOnly(-2 * day) });
    expect(future.body.error.code).toBe("SYNC_DATE_IN_FUTURE");
    const tooOld = await c.post("/api/integrations/github/sync", { since: dateOnly(120 * day) });
    expect(tooOld.body.error.code).toBe("SYNC_DATE_TOO_OLD");
    const malformed = await c.post("/api/integrations/github/sync", { since: "last week" });
    expect(malformed.status).toBe(400);
  });

  it("pulls older merged PRs the last sync skipped, pages through GitHub, and never duplicates", async () => {
    const { client: c } = await connectedRepo("since-pull");
    const pagesRequested: string[] = [];
    // Page 1: 100 closed PRs updated today (one merged 3 days ago); page 2: one merged 20 days ago (before the chosen date).
    const page1 = Array.from({ length: 100 }, (_, i) => ({ number: 1000 + i, title: i === 0 ? "Add CSV export" : `Chore ${i}`, html_url: `https://github.com/D-Audit/Ai-recruiter/pull/${1000 + i}`, merged_at: i === 0 ? iso(3 * day) : null, updated_at: iso(1 * day) }));
    const page2 = [{ number: 900, title: "Old work", html_url: "https://github.com/D-Audit/Ai-recruiter/pull/900", merged_at: iso(20 * day), updated_at: iso(20 * day) }];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/repos/D-Audit/Ai-recruiter/pulls") {
        const page = url.searchParams.get("page")!;
        pagesRequested.push(page);
        return Response.json(page === "1" ? page1 : page === "2" ? page2 : []);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    // A plain sync right after the last one sees nothing new...
    const plain = await c.post("/api/integrations/github/sync");
    expect(plain.body.data.newItems).toBe(0);

    // ...but syncing from 7 days ago picks up the PR merged 3 days ago (and not the one from 20 days ago).
    pagesRequested.length = 0;
    const fromDate = await c.post("/api/integrations/github/sync", { since: dateOnly(7 * day) });
    expect(fromDate.status).toBe(200);
    expect(fromDate.body.data.newItems).toBe(1);
    expect(pagesRequested).toEqual(["1", "2"]);

    // Running it again imports nothing twice.
    const again = await c.post("/api/integrations/github/sync", { since: dateOnly(7 * day) });
    expect(again.body.data.newItems).toBe(0);
  });
});

describe("tracking commits", () => {
  const day = 24 * 60 * 60 * 1000;
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

  it("defaults GitHub to commits, skips merge commits, and uses the commit's first line as the title", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("commits");
    await db.insert(integrations).values({ workspaceId, provider: "github", status: "connected", accountLabel: "D-Audit", detail: "D-Audit/Ai-recruiter", accessTokenEnc: encryptSecret("token-test"), config: {}, lastSyncAt: null });

    const list = await c.get("/api/integrations");
    expect(list.body.data.find((i: { provider: string }) => i.provider === "github").track).toBe("commits");
    expect(list.body.data.find((i: { provider: string }) => i.provider === "linear").track).toBeUndefined();

    const commit = (sha: string, message: string, parents = 1) => ({ sha, html_url: `https://github.com/D-Audit/Ai-recruiter/commit/${sha}`, parents: Array.from({ length: parents }, () => ({})), commit: { message, committer: { date: iso(2 * day) }, author: null } });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/repos/D-Audit/Ai-recruiter/commits") {
        expect(url.searchParams.get("since")).toBeTruthy();
        return Response.json([
          commit("a1b2c3d4e5", "Add candidate search filters\n\nLonger body the draft never sees"),
          commit("f6e5d4c3b2", "fix typo"),
          commit("9988776655", "Merge branch 'feature' into main", 2),
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await c.post("/api/integrations/github/sync");
    expect(res.status).toBe(200);
    expect(res.body.data.newItems).toBe(2);
    const release = (await c.get("/api/releases")).body.data.items?.[0] ?? (await c.get("/api/releases")).body.data[0];
    const labels = (release.sourceRefs as { label: string }[]).map((ref) => ref.label).sort();
    expect(labels).toEqual(["D-Audit/Ai-recruiter@a1b2c3d", "D-Audit/Ai-recruiter@f6e5d4c"]);
  });

  it("lets a workspace switch to pull requests only", async () => {
    const { client: c, workspaceId } = await ownerWithWorkspace("commits-switch");
    await db.insert(integrations).values({ workspaceId, provider: "github", status: "connected", accountLabel: "D-Audit", detail: "", accessTokenEnc: encryptSecret("token-test"), config: {} });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ full_name: "D-Audit/Ai-recruiter" }));
    const res = await c.patch("/api/integrations/github", { detail: "D-Audit/Ai-recruiter", track: "pull_requests" });
    expect(res.body.data).toMatchObject({ detail: "D-Audit/Ai-recruiter", track: "pull_requests" });
  });
});
