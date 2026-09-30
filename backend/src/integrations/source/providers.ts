import { config } from "../../config/env.js";
import type { IntegrationProvider } from "../../types/domain.js";
import { formBody, ProviderRequestError, providerFetch, type CompletedWork, type SourceProvider, type SourceTarget, type TokenSet } from "./types.js";

type OAuthTokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };

/** First line of a commit message, trimmed to a sensible title length. */
function commitTitle(message: string) {
  const line = message.split("\n")[0]!.trim();
  return line.length > 200 ? `${line.slice(0, 197)}…` : line;
}

/** Resolves true when the URL answers, false on 404 (not found / not visible to this token). */
async function exists(url: string, accessToken: string, headers?: Record<string, string>) {
  try {
    await providerFetch<unknown>(url, { token: accessToken, headers });
    return true;
  } catch (error) {
    if (error instanceof ProviderRequestError && error.status === 404) return false;
    throw error;
  }
}

function toTokenSet(response: OAuthTokenResponse): TokenSet {
  if (!response.access_token) throw new Error(response.error_description ?? response.error ?? "No access token returned");
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    expiresAt: response.expires_in ? new Date(Date.now() + response.expires_in * 1000) : null,
    scopes: response.scope ?? null,
  };
}

// ---------------------------------------------------------------------------
// GitHub — merged pull requests in one repository ("owner/repo").
// ---------------------------------------------------------------------------

const github: SourceProvider = {
  id: "github",
  name: "GitHub",
  clientId: config.GITHUB_CLIENT_ID,
  clientSecret: config.GITHUB_CLIENT_SECRET,
  targetHint: "Enter the repository to watch, e.g. acme/app.",
  authorizeUrl: ({ state, redirectUri }) =>
    `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: config.GITHUB_CLIENT_ID ?? "", redirect_uri: redirectUri, scope: "repo read:user", state, allow_signup: "false" })}`,
  async exchangeCode({ code, redirectUri }) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>("https://github.com/login/oauth/access_token", {
        ...formBody({ client_id: config.GITHUB_CLIENT_ID ?? "", client_secret: config.GITHUB_CLIENT_SECRET ?? "", code, redirect_uri: redirectUri }),
      }),
    );
  },
  async describeAccount(accessToken) {
    const user = await providerFetch<{ login: string }>("https://api.github.com/user", { token: accessToken });
    return { label: user.login };
  },
  targetExists: ({ accessToken, target }) =>
    /^[\w.-]+\/[\w.-]+$/.test(target) ? exists(`https://api.github.com/repos/${target}`, accessToken, { "X-GitHub-Api-Version": "2022-11-28" }) : Promise.resolve(false),
  async listTargets({ accessToken }) {
    // Up to 300 repos the user owns, collaborates on or reaches through an org, most recently pushed first.
    const repos: SourceTarget[] = [];
    for (let page = 1; page <= 3; page++) {
      const batch = await providerFetch<{ full_name: string; description: string | null; private: boolean; pushed_at: string | null }[]>(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`,
        { token: accessToken, headers: { "X-GitHub-Api-Version": "2022-11-28" } },
      );
      repos.push(...batch.map((repo) => ({ value: repo.full_name, label: repo.full_name, description: repo.description ?? undefined, private: repo.private, updatedAt: repo.pushed_at ?? undefined })));
      if (batch.length < 100) break;
    }
    return repos;
  },
  async listCompletedWork({ accessToken, target, since, track }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(target)) throw new Error(github.targetHint);
    if (track === "commits") {
      // Every commit on the default branch since `since`, newest first (max 1,000). Merge commits are
      // skipped: the work they bring in is already listed as its own commits.
      const commits: CompletedWork[] = [];
      for (let page = 1; page <= 10; page++) {
        const batch = await providerFetch<{ sha: string; html_url: string; parents: unknown[]; commit: { message: string; committer: { date: string } | null; author: { date: string } | null } }[]>(
          `https://api.github.com/repos/${target}/commits?since=${since.toISOString()}&per_page=100&page=${page}`,
          { token: accessToken, headers: { "X-GitHub-Api-Version": "2022-11-28" } },
        );
        for (const c of batch) {
          if (c.parents.length > 1) continue;
          const title = commitTitle(c.commit.message);
          if (!title) continue;
          commits.push({ externalId: `commit:${c.sha}`, kind: "commit", title, url: c.html_url, label: `${target}@${c.sha.slice(0, 7)}`, completedAt: new Date(c.commit.committer?.date ?? c.commit.author?.date ?? Date.now()) });
        }
        if (batch.length < 100) break;
      }
      return commits;
    }
    // Closed PRs, most recently updated first; page until we're past `since` (max 1,000 PRs).
    const merged: CompletedWork[] = [];
    for (let page = 1; page <= 10; page++) {
      const pulls = await providerFetch<{ number: number; title: string; html_url: string; merged_at: string | null; updated_at: string }[]>(
        `https://api.github.com/repos/${target}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
        { token: accessToken, headers: { "X-GitHub-Api-Version": "2022-11-28" } },
      );
      for (const pull of pulls) {
        if (pull.merged_at && new Date(pull.merged_at) > since) {
          merged.push({ externalId: String(pull.number), kind: "pull_request", title: pull.title, url: pull.html_url, label: `${target}#${pull.number}`, completedAt: new Date(pull.merged_at) });
        }
      }
      const oldest = pulls.at(-1);
      if (pulls.length < 100 || !oldest || new Date(oldest.updated_at) < since) break;
    }
    return merged;
  },
};

// ---------------------------------------------------------------------------
// GitLab — merged merge requests in one project ("group/project").
// ---------------------------------------------------------------------------

const gitlabBase = config.GITLAB_BASE_URL.replace(/\/$/, "");
const gitlab: SourceProvider = {
  id: "gitlab",
  name: "GitLab",
  clientId: config.GITLAB_CLIENT_ID,
  clientSecret: config.GITLAB_CLIENT_SECRET,
  targetHint: "Enter the project path to watch, e.g. acme/app.",
  authorizeUrl: ({ state, redirectUri, codeChallenge }) =>
    `${gitlabBase}/oauth/authorize?${new URLSearchParams({ client_id: config.GITLAB_CLIENT_ID ?? "", redirect_uri: redirectUri, response_type: "code", scope: "read_api read_user", state, code_challenge: codeChallenge, code_challenge_method: "S256" })}`,
  async exchangeCode({ code, redirectUri, codeVerifier }) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>(`${gitlabBase}/oauth/token`, {
        ...formBody({ client_id: config.GITLAB_CLIENT_ID ?? "", client_secret: config.GITLAB_CLIENT_SECRET ?? "", code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier }),
      }),
    );
  },
  async refresh(refreshToken) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>(`${gitlabBase}/oauth/token`, {
        ...formBody({ client_id: config.GITLAB_CLIENT_ID ?? "", client_secret: config.GITLAB_CLIENT_SECRET ?? "", refresh_token: refreshToken, grant_type: "refresh_token" }),
      }),
    );
  },
  async describeAccount(accessToken) {
    const user = await providerFetch<{ username: string }>(`${gitlabBase}/api/v4/user`, { token: accessToken });
    return { label: user.username };
  },
  targetExists: ({ accessToken, target }) =>
    /^[\w.-]+(\/[\w.-]+)+$/.test(target) ? exists(`${gitlabBase}/api/v4/projects/${encodeURIComponent(target)}`, accessToken) : Promise.resolve(false),
  async listTargets({ accessToken }) {
    const projects = await providerFetch<{ path_with_namespace: string; name_with_namespace: string; description: string | null; visibility: string; last_activity_at: string }[]>(
      `${gitlabBase}/api/v4/projects?membership=true&simple=true&order_by=last_activity_at&per_page=100`,
      { token: accessToken },
    );
    return projects.map((project) => ({ value: project.path_with_namespace, label: project.name_with_namespace, description: project.description ?? undefined, private: project.visibility !== "public", updatedAt: project.last_activity_at }));
  },
  async listCompletedWork({ accessToken, target, since, track }) {
    if (!/^[\w.-]+(\/[\w.-]+)+$/.test(target)) throw new Error(gitlab.targetHint);
    if (track === "commits") {
      const commits: CompletedWork[] = [];
      for (let page = 1; page <= 10; page++) {
        const batch = await providerFetch<{ id: string; short_id: string; title: string; message: string; web_url: string; parent_ids: string[]; committed_date: string }[]>(
          `${gitlabBase}/api/v4/projects/${encodeURIComponent(target)}/repository/commits?since=${since.toISOString()}&per_page=100&page=${page}`,
          { token: accessToken },
        );
        for (const c of batch) {
          if (c.parent_ids.length > 1) continue;
          const title = commitTitle(c.title || c.message);
          if (!title) continue;
          commits.push({ externalId: `commit:${c.id}`, kind: "commit", title, url: c.web_url, label: `${target}@${c.short_id}`, completedAt: new Date(c.committed_date) });
        }
        if (batch.length < 100) break;
      }
      return commits;
    }
    const merged: CompletedWork[] = [];
    for (let page = 1; page <= 10; page++) {
      const requests = await providerFetch<{ iid: number; title: string; web_url: string; merged_at: string | null }[]>(
        `${gitlabBase}/api/v4/projects/${encodeURIComponent(target)}/merge_requests?state=merged&updated_after=${since.toISOString()}&per_page=100&page=${page}`,
        { token: accessToken },
      );
      for (const mr of requests) {
        if (mr.merged_at && new Date(mr.merged_at) > since) {
          merged.push({ externalId: String(mr.iid), kind: "merge_request", title: mr.title, url: mr.web_url, label: `${target}!${mr.iid}`, completedAt: new Date(mr.merged_at) });
        }
      }
      if (requests.length < 100) break;
    }
    return merged;
  },
};

// ---------------------------------------------------------------------------
// Linear — issues completed in a team (team key, e.g. "ACM"), or all teams if empty.
// ---------------------------------------------------------------------------

async function linearQuery<T>(accessToken: string, query: string, variables: Record<string, unknown> = {}) {
  const result = await providerFetch<{ data?: T; errors?: { message: string }[] }>("https://api.linear.app/graphql", {
    method: "POST",
    token: accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (result.errors?.length || !result.data) throw new Error(result.errors?.[0]?.message ?? "Linear query failed");
  return result.data;
}

const linear: SourceProvider = {
  id: "linear",
  name: "Linear",
  clientId: config.LINEAR_CLIENT_ID,
  clientSecret: config.LINEAR_CLIENT_SECRET,
  targetHint: "Optionally enter a team key (e.g. ACM) to limit syncing to one team.",
  authorizeUrl: ({ state, redirectUri, codeChallenge }) =>
    `https://linear.app/oauth/authorize?${new URLSearchParams({ client_id: config.LINEAR_CLIENT_ID ?? "", redirect_uri: redirectUri, response_type: "code", scope: "read", state, code_challenge: codeChallenge, code_challenge_method: "S256", prompt: "consent" })}`,
  async exchangeCode({ code, redirectUri, codeVerifier }) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>("https://api.linear.app/oauth/token", {
        ...formBody({ client_id: config.LINEAR_CLIENT_ID ?? "", client_secret: config.LINEAR_CLIENT_SECRET ?? "", code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: codeVerifier }),
      }),
    );
  },
  async refresh(refreshToken) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>("https://api.linear.app/oauth/token", {
        ...formBody({ client_id: config.LINEAR_CLIENT_ID ?? "", client_secret: config.LINEAR_CLIENT_SECRET ?? "", refresh_token: refreshToken, grant_type: "refresh_token" }),
      }),
    );
  },
  async describeAccount(accessToken) {
    const data = await linearQuery<{ viewer: { name: string }; organization: { name: string } }>(accessToken, "query { viewer { name } organization { name } }");
    return { label: `${data.organization.name} (${data.viewer.name})` };
  },
  async targetExists({ accessToken, target, config }) {
    // Empty = all teams, always valid.
    return !target.trim() || (await linear.listTargets({ accessToken, config })).some((team) => team.value === target.trim().toUpperCase());
  },
  async listTargets({ accessToken }) {
    const data = await linearQuery<{ teams: { nodes: { key: string; name: string; description: string | null }[] } }>(accessToken, "query { teams(first: 100) { nodes { key name description } } }");
    return data.teams.nodes.map((team) => ({ value: team.key, label: team.name, description: team.description ?? `Team key ${team.key}` }));
  },
  async listCompletedWork({ accessToken, target, since }) {
    const filter: Record<string, unknown> = { completedAt: { gt: since.toISOString() } };
    if (target.trim()) filter.team = { key: { eq: target.trim().toUpperCase() } };
    const data = await linearQuery<{ issues: { nodes: { id: string; identifier: string; title: string; url: string; completedAt: string }[] } }>(
      accessToken,
      "query Completed($filter: IssueFilter) { issues(filter: $filter, first: 250, orderBy: updatedAt) { nodes { id identifier title url completedAt } } }",
      { filter },
    );
    return data.issues.nodes.map((issue): CompletedWork => ({ externalId: issue.id, kind: "issue", title: issue.title, url: issue.url, label: issue.identifier, completedAt: new Date(issue.completedAt) }));
  },
};

// ---------------------------------------------------------------------------
// Jira Cloud — issues resolved in a project (project key, e.g. "ACM").
// ---------------------------------------------------------------------------

const jira: SourceProvider = {
  id: "jira",
  name: "Jira",
  clientId: config.JIRA_CLIENT_ID,
  clientSecret: config.JIRA_CLIENT_SECRET,
  targetHint: "Enter the Jira project key to watch, e.g. ACM.",
  authorizeUrl: ({ state, redirectUri }) =>
    `https://auth.atlassian.com/authorize?${new URLSearchParams({ audience: "api.atlassian.com", client_id: config.JIRA_CLIENT_ID ?? "", scope: "read:jira-work read:me offline_access", redirect_uri: redirectUri, state, response_type: "code", prompt: "consent" })}`,
  async exchangeCode({ code, redirectUri }) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>("https://auth.atlassian.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "authorization_code", client_id: config.JIRA_CLIENT_ID, client_secret: config.JIRA_CLIENT_SECRET, code, redirect_uri: redirectUri }),
      }),
    );
  },
  async refresh(refreshToken) {
    return toTokenSet(
      await providerFetch<OAuthTokenResponse>("https://auth.atlassian.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "refresh_token", client_id: config.JIRA_CLIENT_ID, client_secret: config.JIRA_CLIENT_SECRET, refresh_token: refreshToken }),
      }),
    );
  },
  async describeAccount(accessToken) {
    const sites = await providerFetch<{ id: string; name: string; url: string }[]>("https://api.atlassian.com/oauth/token/accessible-resources", { token: accessToken });
    const site = sites[0];
    if (!site) throw new Error("No Jira site is available to this account");
    return { label: site.name, config: { cloudId: site.id, siteUrl: site.url } };
  },
  async targetExists({ accessToken, target, config }) {
    return (await jira.listTargets({ accessToken, config })).some((project) => project.value === target.trim().toUpperCase());
  },
  async listTargets({ accessToken, config: providerConfig }) {
    const cloudId = String(providerConfig.cloudId ?? "");
    const result = await providerFetch<{ values: { key: string; name: string }[] }>(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/project/search?maxResults=100&orderBy=-lastIssueUpdatedTime`,
      { token: accessToken },
    );
    return result.values.map((project) => ({ value: project.key, label: project.name, description: `Project key ${project.key}` }));
  },
  async listCompletedWork({ accessToken, target, since, config: providerConfig }) {
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(target.trim().toUpperCase())) throw new Error(jira.targetHint);
    const cloudId = String(providerConfig.cloudId ?? "");
    const jql = `project = "${target.trim().toUpperCase()}" AND statusCategory = Done AND resolved >= "${since.toISOString().slice(0, 16).replace("T", " ")}" ORDER BY resolved DESC`;
    const result = await providerFetch<{ issues: { id: string; key: string; fields: { summary: string; resolutiondate: string } }[] }>(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/search/jql?${new URLSearchParams({ jql, fields: "summary,resolutiondate", maxResults: "100" })}`,
      { token: accessToken },
    );
    return result.issues.map((issue): CompletedWork => ({
      externalId: issue.id,
      kind: "issue",
      title: issue.fields.summary,
      url: providerConfig.siteUrl ? `${providerConfig.siteUrl}/browse/${issue.key}` : undefined,
      label: issue.key,
      completedAt: new Date(issue.fields.resolutiondate),
    }));
  },
};

export const sourceProviders: Record<IntegrationProvider, SourceProvider> = { github, gitlab, linear, jira };
