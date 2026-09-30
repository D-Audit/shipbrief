import { api, ApiError } from "@/lib/api/client";

/**
 * Authentication against the ShipBrief API. Sessions are httpOnly cookies set
 * by the server; nothing sensitive is stored in the browser.
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type WorkspaceRole = "owner" | "admin" | "product_manager" | "marketer" | "developer" | "viewer";

export type AuthSession = {
  user: AuthUser;
  needsOnboarding: boolean;
  emailVerified: boolean;
  workspace: { id: string; slug: string; name: string; role: WorkspaceRole } | null;
  permissions: string[];
  workspaces: { id: string; name: string; slug: string; role: WorkspaceRole }[];
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  /** Optional; carried into onboarding so the workspace step is prefilled. */
  workspaceName?: string;
};

export type AuthProvider = "google" | "github";

export const authProviderNames: Record<AuthProvider, string> = { google: "Google", github: "GitHub" };

export type OAuthIntent = "signIn" | "signUp";

export type OAuthInput = {
  provider: AuthProvider;
  intent: OAuthIntent;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
};

export type AuthEmailFlow = "verify" | "reset";

export type OnboardingRole = "founder" | "product" | "engineering" | "marketing" | "customer_success" | "other";

export type OnboardingGoal = "release_updates" | "customer_feedback" | "product_adoption" | "all_of_the_above";

export type OnboardingChannel = "changelog" | "email" | "in_app";

export type OnboardingInput = {
  workspaceName: string;
  workspaceSlug: string;
  role: OnboardingRole;
  goal: OnboardingGoal;
  channels: OnboardingChannel[];
};

export type AuthEmailResult = {
  email: string;
  flow: AuthEmailFlow;
  sentAt: string;
};

export type OnboardedWorkspace = OnboardingInput & {
  id: string;
  createdAt: string;
};

const PENDING_WORKSPACE_KEY = "sb_pending_workspace_name";
const quiet = { allowUnauthenticated: true } as const;

function rememberWorkspaceName(name?: string) {
  try {
    if (name?.trim()) sessionStorage.setItem(PENDING_WORKSPACE_KEY, name.trim());
  } catch {
    // Storage can be unavailable (private mode); prefilling is only a convenience.
  }
}

export const authService = {
  /** Which social sign-in providers this installation has configured. */
  getProviders: () => api.get<Record<AuthProvider, boolean>>("/auth/providers", quiet),

  /**
   * Starts Google or GitHub sign-in. The browser goes to the provider and
   * returns through the API callback, so on success this promise never resolves.
   */
  async continueWithProvider(input: OAuthInput): Promise<AuthSession> {
    const providers = await authService.getProviders();
    if (!providers[input.provider]) {
      throw new ApiError(`${authProviderNames[input.provider]} sign-in isn't set up yet. Use your email and password instead.`, "OAUTH_NOT_CONFIGURED", 503);
    }
    // An API route that redirects to the provider, so this must be a real navigation.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/oauth/${input.provider}/start?intent=${input.intent}`);
    return new Promise<AuthSession>(() => undefined);
  },

  signIn: (input: SignInInput) => api.post<AuthSession>("/auth/login", input, quiet),

  async signUp(input: SignUpInput): Promise<AuthEmailResult> {
    const result = await api.post<AuthEmailResult>("/auth/register", { name: input.name, email: input.email, password: input.password }, quiet);
    rememberWorkspaceName(input.workspaceName);
    return result;
  },

  signOut: () => api.post<void>("/auth/logout", {}, quiet),

  requestPasswordReset: (email: string) => api.post<AuthEmailResult>("/auth/forgot-password", { email }, quiet),

  resendEmail: (email: string, flow: AuthEmailFlow) => api.post<AuthEmailResult>("/auth/resend-email", { email, flow }, quiet),

  /**
   * Called from "I've verified my email". Verification itself happens when the
   * emailed link is opened; this checks whether that has happened yet.
   */
  async confirmEmail(email: string): Promise<AuthSession | null> {
    const session = await authService.getSession();
    if (!session || session.user.email !== email.trim().toLowerCase()) return null;
    if (!session.emailVerified) {
      throw new ApiError("We haven't seen the confirmation yet. Open the link in the email we sent, then try again.", "EMAIL_NOT_VERIFIED", 409);
    }
    return session;
  },

  resetPassword: (input: ResetPasswordInput) => api.post<{ email: string }>("/auth/reset-password", input, quiet),

  async completeOnboarding(input: OnboardingInput): Promise<OnboardedWorkspace> {
    const workspace = await api.post<OnboardedWorkspace>("/auth/onboarding", input, quiet);
    try {
      sessionStorage.removeItem(PENDING_WORKSPACE_KEY);
    } catch {
      // ignore
    }
    return workspace;
  },

  getSession: () => api.get<AuthSession | null>("/auth/session", quiet),

  switchWorkspace: (workspaceId: string) => api.post<AuthSession>("/auth/workspace", { workspaceId }),

  updateProfile: (input: { name: string }) => api.patch<AuthUser>("/auth/profile", input),

  changePassword: (input: { currentPassword: string; newPassword: string }) => api.post<void>("/auth/password", input),

  /** Workspace name typed at sign-up, if any, to prefill onboarding. */
  getPendingWorkspaceName(): string {
    try {
      return sessionStorage.getItem(PENDING_WORKSPACE_KEY) ?? "";
    } catch {
      return "";
    }
  },
};
