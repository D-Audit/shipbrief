"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authProviderNames, authService, type AuthProvider } from "@/lib/services/auth-service";
import { AuthField, AuthNotice, PasswordField } from "./auth-fields";
import { SocialSignIn } from "./social-sign-in";

const signInSchema = z.object({
  email: z.string().trim().email("Enter the email you use for ShipBrief."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});

type SignInValues = z.infer<typeof signInSchema>;

/** Messages for the `?notice=` values the API redirects back with. */
const NOTICES: Record<string, { tone: "success" | "error"; text: string }> = {
  "email-verified": { tone: "success", text: "Your email is confirmed. Sign in to continue." },
  "verification-link-invalid": { tone: "error", text: "That confirmation link has expired or was already used. Sign in to request a new one." },
  "oauth-failed": { tone: "error", text: "We couldn't sign you in with {provider}. Please try again." },
  "oauth-cancelled": { tone: "error", text: "{provider} sign-in was cancelled." },
  "oauth-email-unverified": { tone: "error", text: "Your {provider} account needs a verified email address. Verify it with {provider}, or sign up with email." },
};

export function SignInForm({ next, notice, provider }: { next?: string; notice?: string; provider?: string }) {
  const providerName = provider && provider in authProviderNames ? authProviderNames[provider as AuthProvider] : "that provider";
  const redirectNotice = notice && NOTICES[notice] ? { ...NOTICES[notice], text: NOTICES[notice].text.replaceAll("{provider}", providerName) } : undefined;
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const [providerPending, setProviderPending] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const busy = isSubmitting || providerPending;

  const submit = async (values: SignInValues) => {
    setSubmissionError(null);
    try {
      const session = await authService.signIn({ email: values.email, password: values.password });
      toast.success("Welcome back.");
      router.push(session.needsOnboarding ? "/onboarding" : next ?? "/app/overview");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We couldn't sign you in. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}
      {!submissionError && redirectNotice && <AuthNotice tone={redirectNotice.tone}>{redirectNotice.text}</AuthNotice>}

      <SocialSignIn intent="signIn" disabled={isSubmitting} onError={setSubmissionError} onPendingChange={setProviderPending} />

      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          id="login-password"
          label="Password"
          labelAction={
            <Link href="/forgot-password" className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          }
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" className="size-4 rounded accent-[var(--ink)]" {...register("remember")} />
          Keep me signed in
        </label>
        <Button type="submit" size="lg" className="mt-2 h-11 w-full rounded-lg text-[15px]" disabled={busy}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
