import type { ApiKeyScope, TeamRole } from "./domain.js";

export type SessionAuth = {
  kind: "session";
  sessionId: string;
  user: { id: string; name: string; email: string; emailVerified: boolean };
  /** Present once the user belongs to a workspace and one is active on the session. */
  workspace?: { id: string; slug: string; name: string; role: TeamRole };
};

export type ApiKeyAuth = {
  kind: "api_key";
  apiKeyId: string;
  workspace: { id: string; slug: string; name: string };
  scopes: ApiKeyScope[];
};

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: SessionAuth | ApiKeyAuth;
    }
  }
}

export {};
