"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { authService } from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";
import { AuthField, AuthNotice, PasswordField } from "./auth-fields";

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  confirmation: z.string(),
}).refine((values) => values.password === values.confirmation, {
  path: ["confirmation"],
  message: "The two passwords do not match.",
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ email: initialEmail = "", token }: { email?: string; token?: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: initialEmail, password: "", confirmation: "" },
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = async ({ password }: ResetPasswordValues) => {
    setSubmissionError(null);
    if (!token) return;
    try {
      await authService.resetPassword({ token, password });
      setComplete(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not update your password. Please try again.");
    }
  };

  if (complete) {
    return (
      <div className="space-y-5">
        <AuthNotice tone="success">Your password has been updated. For your security, you&apos;ve been signed out on every device.</AuthNotice>
        <div className="rounded-lg border border-border bg-surface-subtle p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <div><p className="text-sm font-medium">You can sign in now</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Return to the sign-in screen and continue into the ShipBrief workspace.</p></div>
          </div>
        </div>
        <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-10 w-full")}>Continue to sign in</Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-5">
        <AuthNotice>Open the reset link from the email we sent you. Each link works once and expires after an hour.</AuthNotice>
        <Link href="/forgot-password" className={cn(buttonVariants({ size: "lg" }), "h-10 w-full")}>Send a new reset link</Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}
      <AuthNotice tone="info"><ShieldCheck className="mr-1 inline size-3.5" />This local reset flow demonstrates the interface only. It does not update a real account.</AuthNotice>
      <AuthField id="reset-password-email" label="Work email" type="email" autoComplete="username" readOnly placeholder="you@company.com" error={errors.email?.message} {...register("email")} />
      <PasswordField id="reset-password" label="New password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register("password")} />
      <PasswordField id="reset-password-confirmation" label="Confirm new password" autoComplete="new-password" placeholder="Repeat your new password" error={errors.confirmation?.message} {...register("confirmation")} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{isSubmitting ? "Updating password..." : "Update password"}</Button>
    </form>
  );
}
