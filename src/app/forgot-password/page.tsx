import type { Metadata } from "next";
import { AuthShell, AuthSwitch } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

type ForgotPasswordPageProps = { searchParams: Promise<{ email?: string | string[] }> };

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { email } = await searchParams;
  return (
    <AuthShell title="Reset your password" description="Enter your email and we'll send you a link to choose a new one." footer={<AuthSwitch prompt="Remembered it?" href="/login" label="Back to sign in" />}>
      <ForgotPasswordForm defaultEmail={typeof email === "string" ? email.slice(0, 254) : ""} />
    </AuthShell>
  );
}
