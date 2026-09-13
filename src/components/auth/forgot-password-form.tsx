"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/services/auth-service";
import { AuthField, AuthNotice } from "./auth-fields";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const submit = async ({ email }: ForgotPasswordValues) => {
    setSubmissionError(null);
    try {
      const result = await authService.requestPasswordReset(email);
      toast.success("Password reset message prepared for the demo.");
      const params = new URLSearchParams({ email: result.email, flow: result.flow });
      router.push(`/check-email?${params.toString()}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not prepare a reset link. Please try again.");
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}
      <AuthNotice tone="info">No email is sent in this frontend preview. We will show the reset step locally after you continue.</AuthNotice>
      <AuthField id="forgot-password-email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" error={errors.email?.message} {...register("email")} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {isSubmitting ? "Preparing reset..." : "Send reset instructions"}
      </Button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
    </form>
  );
}
