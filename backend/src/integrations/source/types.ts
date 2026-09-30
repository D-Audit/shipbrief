import type { IntegrationProvider } from "../../types/domain.js";

export type CompletedWork = {
  externalId: string;
  kind: "pull_request" | "merge_request" | "issue" | "commit";
  title: string;
  url?: string;
  label: string;
  completedAt: Date;
};

/** For code hosts: read merged pull/merge requests, or every commit on the default branch. */
export type TrackMode = "pull_requests" | "commits";

export type TokenSet = { accessToken: string; refreshToken?: string | null; expiresAt?: Date | null; scopes?: string | null };

/** Something a workspace can choose to watch: a repository, project or team. */
export type SourceTarget = {
  /** What gets stored as the integration's scope ("owner/repo", "group/project", team or project key). */
  value: string;
  label: string;
  description?: string;
  private?: boolean;
  updatedAt?: string;
};

/**
 * A source-of-work integration (GitHub, GitLab, Linear, Jira). Each provider
 * describes its OAuth endpoints and how to list recently completed work; the
 * integration service handles state, token storage/refresh and syncing.
 */
export interface SourceProvider {
  readonly id: IntegrationProvider;
  readonly name: string;
  readonly clientId: string | undefined;
  readonly clientSecret: string | undefined;
  authorizeUrl(input: { state: string; redirectUri: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; redirectUri: string; codeVerifier: string }): Promise<TokenSet>;
  refresh?(refreshToken: string): Promise<TokenSet>;
  /** Returns a display label for the connected account and any provider config to store (e.g. Jira cloud id). */
  describeAccount(accessToken: string): Promise<{ label: string; config?: Record<string, unknown> }>;
  /** `target` is the user-entered scope (repo, project or team key) from the integration's detail field. */
  listCompletedWork(input: { accessToken: string; target: string; since: Date; config: Record<string, unknown>; track?: TrackMode }): Promise<CompletedWork[]>;
  /** Repositories / projects / teams the connected account can see, most recently active first. */
  listTargets(input: { accessToken: string; config: Record<string, unknown> }): Promise<SourceTarget[]>;
  /** Whether `target` exists and this connection can read it (false on "not found"). */
  targetExists(input: { accessToken: string; target: string; config: Record<string, unknown> }): Promise<boolean>;
  /** Explains what the detail field should contain, surfaced when it's missing. */
  readonly targetHint: string;
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export async function providerFetch<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { Accept: "application/json", "User-Agent": "ShipBrief", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new ProviderRequestError(`Provider responded with HTTP ${response.status}${detail ? `: ${detail}` : ""}`, response.status);
  }
  return (await response.json()) as T;
}

export function formBody(values: Record<string, string>) {
  return { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values).toString() };
}
