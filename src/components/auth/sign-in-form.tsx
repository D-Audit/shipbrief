"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/services/auth-service";
import { AuthDivider, AuthField, AuthNotice, GoogleMark, PasswordField } from "./auth-fields";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  remember: z.boolean(),
});

type SignInValues = z.infer<typeof signInSchema>;
type SignInStage = "identity" | "password";

export function SignInForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setFocus,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const [stage, setStage] = useState<SignInStage>("identity");
  const [providerPending, setProviderPending] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (stage === "password") setFocus("password");
  }, [setFocus, stage]);

  const continueWithEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    if (await trigger("email")) setStage("password");
  };

  const changeEmail = () => {
    clearErrors("password");
    setSubmissionError(null);
    setStage("identity");
  };

  const continueWithGoogle = async () => {
    setSubmissionError(null);
    setProviderPending(true);
    try {
      const session = await authService.continueWithProvider({ provider: "google", intent: "signIn" });
      toast.success("Google demo session ready. Opening your workspace.");
      router.push(session.needsOnboarding ? "/onboarding" : "/app/overview");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not continue with Google. Please try again.");
    } finally {
      setProviderPending(false);
    }
  };

  const submit = async (values: SignInValues) => {
    setSubmissionError(null);
    try {
      await authService.signIn({ email: values.email, password: values.password });
      toast.success("Demo session ready. Opening your workspace.");
      router.push("/app/overview");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not sign you in. Please try again.");
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
          id="login-email"
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
          Use your work email to continue into the ShipBrief frontend preview.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          New to ShipBrief?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
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
          <p className="text-[10px] font-medium tracking-[0.11em] text-muted-foreground uppercase">Continue as</p>
          <p className="truncate text-sm font-medium text-foreground">{getValues("email")}</p>
        </div>
        <button type="button" onClick={changeEmail} className="shrink-0 text-xs font-medium text-primary hover:underline">
          Change
        </button>
      </div>
      <PasswordField
        id="login-password"
        label="Password"
        labelAction={<Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>}
        autoComplete="current-password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register("password")}
      />

      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="size-3.5 accent-primary" {...register("remember")} />
        Remember this device
      </label>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {isSubmitting ? "Signing in..." : "Continue"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to ShipBrief?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
