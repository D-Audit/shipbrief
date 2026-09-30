"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authService, type AuthSession } from "@/lib/services/auth-service";

type SessionContextValue = {
  session: AuthSession;
  /** Whether the signed-in role grants a backend permission (for hiding actions; the API still enforces it). */
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  product_manager: "Product Manager",
  marketer: "Marketer",
  developer: "Developer",
  viewer: "Viewer",
};

/**
 * Loads the signed-in user and active workspace once for the whole app shell.
 * Unauthenticated visitors go to sign-in; users without a workspace go to onboarding.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSession(await authService.getSession());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn't load your workspace.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    authService
      .getSession()
      .then((result) => active && setSession(result))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "We couldn't load your workspace."));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (session?.needsOnboarding) router.replace("/onboarding");
  }, [session, router, pathname]);

  const signOut = useCallback(async () => {
    await authService.signOut().catch(() => undefined);
    router.replace("/login");
  }, [router]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    await authService.switchWorkspace(workspaceId);
    // Every page's data is workspace-scoped, so reload fully into the new workspace.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/app/overview");
  }, []);

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button type="button" onClick={() => void load()} className="text-sm font-medium underline underline-offset-4">Try again</button>
      </div>
    );
  }

  if (!session || session.needsOnboarding || !session.workspace) {
    return (
      <div className="flex h-dvh items-center justify-center" role="status" aria-label="Loading workspace">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const value: SessionContextValue = {
    session,
    can: (permission) => session.permissions.includes(permission),
    refresh: load,
    signOut,
    switchWorkspace,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>");
  return context;
}
