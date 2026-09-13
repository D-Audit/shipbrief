"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/services/auth-service";
import { AuthDivider, AuthField, AuthNotice, GoogleMark, PasswordField } from "./auth-fields";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter the name you would like teammates to see."),
  email: z.string().trim().email("Enter a valid work email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  terms: z.boolean().refine((value) => value, "Please agree before creating your workspace."),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type SignUpStage = "identity" | "details";

function getPasswordStrength(password: string) {
  if (!password) return { label: "Use 8+ characters", score: 0 };
  let score = password.length >= 8 ? 1 : 0;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d|[^A-Za-z\d]/.test(password)) score += 1;
  return {
    score,
    label: score <= 1 ? "Add a little more variety" : score === 2 ? "Good password" : "Strong password",
  };
}

export function SignUpForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setFocus,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", terms: false },
  });
  const [stage, setStage] = useState<SignUpStage>("identity");
  const [providerPending, setProviderPending] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const password = useWatch({ control, name: "password" }) ?? "";
  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (stage === "details") setFocus("name");
  }, [setFocus, stage]);

  const continueWithEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    if (await trigger("email")) setStage("details");
  };

  const changeEmail = () => {
    clearErrors(["name", "password", "terms"]);
    setSubmissionError(null);
    setStage("identity");
  };

  const continueWithGoogle = async () => {
    setSubmissionError(null);
    setProviderPending(true);
    try {
      const session = await authService.continueWithProvider({ provider: "google", intent: "signUp" });
      toast.success("Google demo identity connected. Set up your workspace next.");
      router.push(session.needsOnboarding ? "/onboarding" : "/app/overview");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not continue with Google. Please try again.");
    } finally {
      setProviderPending(false);
    }
  };

  const submit = async (values: SignUpValues) => {
    setSubmissionError(null);
    try {
      const result = await authService.signUp(values);
      toast.success("Verification message prepared for the demo.");
      const params = new URLSearchParams({ email: result.email, flow: result.flow, next: "/onboarding" });
      router.push(`/check-email?${params.toString()}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not create your account. Please try again.");
    }
  };

  if (stage === "identity") {
    return (
      <form noValidate onSubmit={continueWithEmail} className="space-y-4">
        {submissionError && <AuthNotice>{submissionError}</AuthNotice>}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 w-full border-border bg-background text-foreground hover:bg-muted"
          disabled={providerPending}
          onClick={continueWithGoogle}
        >
          {providerPending ? <Loader2 className="animate-spin" /> : <GoogleMark />}
          {providerPending ? "Connecting to Google..." : "Continue with Google"}
        </Button>
        <AuthDivider />
        <AuthField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" size="lg" className="h-11 w-full">
          Continue with email <ArrowRight />
        </Button>
        <p className="pt-1 text-center text-[11px] leading-5 text-muted-foreground">
          By continuing, you agree to ShipBrief&apos;s terms and privacy policy for this frontend preview.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}
      <div className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-[0.11em] text-muted-foreground uppercase">Creating with</p>
          <p className="truncate text-sm font-medium text-foreground">{getValues("email")}</p>
        </div>
        <button type="button" onClick={changeEmail} className="shrink-0 text-xs font-medium text-primary hover:underline">
          Change
        </button>
      </div>
      <AuthField id="signup-name" label="Your name" autoComplete="name" placeholder="Avery Morgan" error={errors.name?.message} {...register("name")} />
      <div>
        <PasswordField id="signup-password" label="Create a password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register("password")} />
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3].map((segment) => <span key={segment} className={`h-1 flex-1 rounded-full ${strength.score >= segment ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <span className="text-[11px] text-muted-foreground">{strength.label}</span>
        </div>
      </div>

      <div>
        <label htmlFor="signup-terms" className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <input id="signup-terms" type="checkbox" className="mt-0.5 size-3.5 rounded border-input text-primary accent-primary" aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "signup-terms-error" : undefined} {...register("terms")} />
          <span>I agree to the <a href="#terms" className="font-medium text-foreground underline-offset-2 hover:underline">terms</a> and <a href="#privacy" className="font-medium text-foreground underline-offset-2 hover:underline">privacy policy</a> for this frontend demo.</span>
        </label>
        {errors.terms && <p id="signup-terms-error" className="mt-2 text-xs text-destructive">{errors.terms.message}</p>}
      </div>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {isSubmitting ? "Creating your account..." : "Create your account"}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground"><Check className="size-3 text-success" />No card required to explore the workspace.</p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
