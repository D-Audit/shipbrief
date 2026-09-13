import { withMockDelay } from "./utils";

/**
 * Authentication remains a client-side mock boundary until an identity provider
 * is connected. Pages consume this service rather than carrying auth logic in
 * their UI, so it can be replaced without changing the flow.
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  user: AuthUser;
  needsOnboarding: boolean;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

export type AuthProvider = "google";

export type OAuthIntent = "signIn" | "signUp";

export type OAuthInput = {
  provider: AuthProvider;
  intent: OAuthIntent;
};

export type ResetPasswordInput = {
  email: string;
  password: string;
};

export type AuthEmailFlow = "verify" | "reset";

export type OnboardingRole =
  | "founder"
  | "product"
  | "engineering"
  | "marketing"
  | "customer_success"
  | "other";

export type OnboardingGoal =
  | "release_updates"
  | "customer_feedback"
  | "product_adoption"
  | "all_of_the_above";

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

let session: AuthSession | null = null;
let lastEmail: AuthEmailResult | null = null;
let workspace: OnboardedWorkspace | null = null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function ensureEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!emailPattern.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
}

function simulateProviderFailure(email: string) {
  if (email === "offline@shipbrief.test") {
    throw new Error("The demo identity provider is unavailable. Try a different email address.");
  }
}

function userFromInput(input: Pick<SignUpInput, "name" | "email">): AuthUser {
  const email = normalizeEmail(input.email);
  const fallbackName = email.split("@")[0]?.replace(/[._-]+/g, " ") || "ShipBrief user";
  return {
    id: `user_${Date.now()}`,
    name: input.name.trim() || fallbackName.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    email,
  };
}

export const authService = {
  async continueWithProvider(input: OAuthInput): Promise<AuthSession> {
    return withMockDelay(() => {
      if (input.provider !== "google") {
        throw new Error("That sign-in provider is not available in this preview.");
      }

      // This is a typed frontend boundary. Replace it with the real OAuth callback later.
      session = {
        user: {
          id: `google_${Date.now()}`,
          name: "Taylor Morgan",
          email: "taylor@shipbrief.demo",
        },
        needsOnboarding: input.intent === "signUp",
      };
      return session;
    }, 520);
  },

  async signIn(input: SignInInput): Promise<AuthSession> {
    return withMockDelay(() => {
      const email = ensureEmail(input.email);
      simulateProviderFailure(email);
      if (input.password.trim().length < 8) {
        throw new Error("Use at least 8 characters for your password.");
      }

      session = {
        user: userFromInput({ name: "", email }),
        needsOnboarding: false,
      };
      return session;
    }, 520);
  },

  async signUp(input: SignUpInput): Promise<AuthEmailResult> {
    return withMockDelay(() => {
      const email = ensureEmail(input.email);
      simulateProviderFailure(email);
      if (input.name.trim().length < 2) {
        throw new Error("Tell us the name you would like to use in ShipBrief.");
      }
      if (input.password.trim().length < 8) {
        throw new Error("Use at least 8 characters for your password.");
      }

      session = {
        user: userFromInput(input),
        needsOnboarding: true,
      };
      lastEmail = { email, flow: "verify", sentAt: new Date().toISOString() };
      return lastEmail;
    }, 620);
  },

  async requestPasswordReset(email: string): Promise<AuthEmailResult> {
    return withMockDelay(() => {
      const normalizedEmail = ensureEmail(email);
      simulateProviderFailure(normalizedEmail);
      lastEmail = { email: normalizedEmail, flow: "reset", sentAt: new Date().toISOString() };
      return lastEmail;
    }, 520);
  },

  async resendEmail(email: string, flow: AuthEmailFlow): Promise<AuthEmailResult> {
    return withMockDelay(() => {
      const normalizedEmail = ensureEmail(email);
      simulateProviderFailure(normalizedEmail);
      lastEmail = { email: normalizedEmail, flow, sentAt: new Date().toISOString() };
      return lastEmail;
    }, 460);
  },

  async confirmEmail(email: string): Promise<AuthSession | null> {
    return withMockDelay(() => {
      const normalizedEmail = ensureEmail(email);
      simulateProviderFailure(normalizedEmail);
      if (session?.user.email === normalizedEmail) return session;
      return null;
    }, 360);
  },

  async resetPassword(input: ResetPasswordInput): Promise<{ email: string }> {
    return withMockDelay(() => {
      const email = ensureEmail(input.email);
      simulateProviderFailure(email);
      if (input.password.trim().length < 8) {
        throw new Error("Use at least 8 characters for your new password.");
      }
      return { email };
    }, 520);
  },

  async completeOnboarding(input: OnboardingInput): Promise<OnboardedWorkspace> {
    return withMockDelay(() => {
      const workspaceName = input.workspaceName.trim();
      const workspaceSlug = input.workspaceSlug.trim().toLowerCase();
      if (workspaceName.length < 2) {
        throw new Error("Give your workspace a name with at least 2 characters.");
      }
      if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(workspaceSlug)) {
        throw new Error("Use a URL-safe workspace address between 3 and 50 characters.");
      }
      if (input.channels.length === 0) {
        throw new Error("Choose at least one channel to start with.");
      }

      workspace = {
        ...input,
        workspaceName,
        workspaceSlug,
        id: `workspace_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      if (session) session = { ...session, needsOnboarding: false };
      return workspace;
    }, 640);
  },

  async getSession(): Promise<AuthSession | null> {
    return withMockDelay(() => session, 160);
  },

  async getLastEmail(): Promise<AuthEmailResult | null> {
    return withMockDelay(() => lastEmail, 120);
  },

  async getWorkspace(): Promise<OnboardedWorkspace | null> {
    return withMockDelay(() => workspace, 120);
  },
};
