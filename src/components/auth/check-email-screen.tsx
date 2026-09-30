"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Mail, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AuthEmailFlow } from "@/lib/services/auth-service";
import { authService } from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";
import { AuthNotice } from "./auth-fields";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email || "your inbox";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, Math.min(7, local.length - visible.length)))}@${domain}`;
}

export function CheckEmailScreen({
  email,
  flow,
  nextPath,
}: {
  email?: string;
  flow: AuthEmailFlow;
  nextPath?: string;
}) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validEmail = Boolean(email?.includes("@"));
  const verification = flow === "verify";
  const destination = nextPath?.startsWith("/") ? nextPath : "/onboarding";

  const resend = async () => {
    if (!email) return;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await authService.resendEmail(email, flow);
      setNotice(`Another ${verification ? "verification" : "reset"} message is ready for ${email}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not resend the message. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const continueAfterVerification = async () => {
    if (!email) return;
    setError(null);
    setConfirming(true);
    try {
      const activeSession = await authService.confirmEmail(email);
      if (!activeSession) {
        throw new Error("Sign in with this email to continue, or open the link in the verification email.");
      }
      router.push(destination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not confirm this email. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-subtle p-4">
        <p className="flex items-center gap-2 text-sm font-medium"><Mail className="size-4 text-muted-foreground" />Check {maskEmail(email ?? "")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {verification
            ? "Open the verification message to confirm your address, then return here to start your workspace."
            : "Open the reset link in that message to choose a new password. It works once and expires after an hour."}
        </p>
      </div>

      {!validEmail && <AuthNotice>We need an email address to prepare this step. Start again from the sign-in screen.</AuthNotice>}
      {error && <AuthNotice>{error}</AuthNotice>}
      {notice && <AuthNotice tone="success">{notice}</AuthNotice>}

      <div className="space-y-2.5">
        {verification ? (
          <Button type="button" size="lg" className="h-10 w-full" disabled={!validEmail || confirming} onClick={() => void continueAfterVerification()}>
            {confirming ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {confirming ? "Confirming…" : "I’ve verified my email"}
          </Button>
        ) : (
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-10 w-full")}>Back to sign in <ArrowRight /></Link>
        )}
        <Button type="button" variant="outline" size="lg" className="h-10 w-full" disabled={!validEmail || resending} onClick={() => void resend()}>
          {resending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {resending ? "Sending…" : "Resend email"}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground"><Link href={verification ? "/signup" : "/login"} className="font-medium text-foreground underline-offset-4 hover:underline">Use a different email</Link></p>
    </div>
  );
}
