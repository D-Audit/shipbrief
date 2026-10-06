"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authProviderNames, authService, type AuthProvider, type OAuthIntent } from "@/lib/services/auth-service";
import { AuthDivider, GitHubMark, GoogleMark } from "./auth-fields";

const ORDER: AuthProvider[] = ["google", "github"];
const MARKS: Record<AuthProvider, () => React.ReactElement> = { google: GoogleMark, github: GitHubMark };

/**
 * "Continue with Google / GitHub" buttons plus the divider. Both render
 * immediately (the API can be slow to wake up), and a provider is hidden only
 * once the API confirms it isn't configured, so there's never a dead button.
 */
export function SocialSignIn({
  intent,
  disabled,
  onError,
  onPendingChange,
}: {
  intent: OAuthIntent;
  disabled?: boolean;
  onError: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [configured, setConfigured] = useState<Partial<Record<AuthProvider, boolean>>>();
  const [pending, setPending] = useState<AuthProvider | null>(null);

  useEffect(() => {
    let active = true;
    authService
      .getProviders()
      .then((providers) => active && providers && setConfigured(providers))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const available = configured ? ORDER.filter((provider) => configured[provider]) : ORDER;
  if (available.length === 0) return null;

  const start = async (provider: AuthProvider) => {
    setPending(provider);
    onPendingChange?.(true);
    try {
      await authService.continueWithProvider({ provider, intent }, configured);
    } catch (error) {
      onError(error instanceof Error ? error.message : `We couldn't continue with ${authProviderNames[provider]}. Please try again.`);
      setPending(null);
      onPendingChange?.(false);
    }
  };

  const verb = intent === "signUp" ? "Sign up with" : "Continue with";
  return (
    <>
      <div className="space-y-2.5">
        {available.map((provider) => {
          const Mark = MARKS[provider];
          return (
            <Button key={provider} type="button" variant="outline" size="lg" className="h-11 w-full gap-2.5 rounded-lg border-border-strong bg-surface text-[15px] hover:bg-background" disabled={disabled || pending !== null} onClick={() => start(provider)}>
              {pending === provider ? <Loader2 className="animate-spin" /> : <Mark />}
              {pending === provider ? `Connecting to ${authProviderNames[provider]}…` : `${verb} ${authProviderNames[provider]}`}
            </Button>
          );
        })}
      </div>
      <AuthDivider />
    </>
  );
}
