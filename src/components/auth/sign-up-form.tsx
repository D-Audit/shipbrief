"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";
import { AuthField, AuthNotice, PasswordField } from "./auth-fields";
import { SocialSignIn } from "./social-sign-in";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter the name teammates will see."),
  email: z.string().trim().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  workspaceName: z.string().trim().min(2, "Name your workspace — your company or product name works well."),
  terms: z.boolean().refine((value) => value, "Please accept the terms to continue."),
});

type SignUpValues = z.infer<typeof signUpSchema>;

function getPasswordStrength(password: string) {
  if (!password) return { label: "At least 8 characters", score: 0 };
  let score = password.length >= 8 ? 1 : 0;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d|[^A-Za-z\d]/.test(password)) score += 1;
  return {
    score,
    label: score <= 1 ? (password.length < 8 ? "Too short" : "Could be stronger") : score === 2 ? "Good" : "Strong",
  };
}

export function SignUpForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", workspaceName: "", terms: false },
  });
  const [providerPending, setProviderPending] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const password = useWatch({ control, name: "password" }) ?? "";
  const strength = getPasswordStrength(password);
  const busy = isSubmitting || providerPending;

  const submit = async (values: SignUpValues) => {
    setSubmissionError(null);
    try {
      const result = await authService.signUp(values);
      const params = new URLSearchParams({ email: result.email, flow: result.flow, next: "/onboarding" });
      router.push(`/check-email?${params.toString()}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We couldn't create your account. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}

      <SocialSignIn intent="signUp" disabled={isSubmitting} onError={setSubmissionError} onPendingChange={setProviderPending} />

      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
        <AuthField id="signup-name" label="Name" autoComplete="name" placeholder="Avery Morgan" error={errors.name?.message} {...register("name")} />
        <AuthField id="signup-email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" error={errors.email?.message} {...register("email")} />
        <div>
          <PasswordField id="signup-password" label="Password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          {!errors.password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3].map((segment) => (
                  <span key={segment} className={cn("h-1 flex-1 rounded-full transition-colors", strength.score >= segment ? "bg-foreground/70" : "bg-muted")} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{strength.label}</span>
            </div>
          )}
        </div>
        <AuthField id="signup-workspace" label="Workspace name" autoComplete="organization" placeholder="Acme" hint="You can change this later" error={errors.workspaceName?.message} {...register("workspaceName")} />

        <div>
          <label htmlFor="signup-terms" className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
            <input id="signup-terms" type="checkbox" className="mt-[2px] size-4 rounded accent-[var(--ink)]" aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "signup-terms-error" : undefined} {...register("terms")} />
            <span>
              I agree to the <Link href="/terms" target="_blank" className="text-foreground underline-offset-4 hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" target="_blank" className="text-foreground underline-offset-4 hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          {errors.terms && <p id="signup-terms-error" className="mt-1.5 text-xs text-destructive">{errors.terms.message}</p>}
        </div>

        <Button type="submit" size="lg" className="mt-2 h-11 w-full rounded-lg text-[15px]" disabled={busy}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
