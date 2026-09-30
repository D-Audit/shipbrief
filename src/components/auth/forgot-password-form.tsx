"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/services/auth-service";
import { AuthField, AuthNotice } from "./auth-fields";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const submit = async ({ email }: ForgotPasswordValues) => {
    setSubmissionError(null);
    try {
      const result = await authService.requestPasswordReset(email);
            const params = new URLSearchParams({ email: result.email, flow: result.flow });
      router.push(`/check-email?${params.toString()}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not prepare a reset link. Please try again.");
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}
      <AuthField id="forgot-password-email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" error={errors.email?.message} {...register("email")} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
