import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ email?: string | string[]; token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  return (
    <AuthShell title="Choose a new password" description="Use at least 8 characters. You'll sign in with it afterwards.">
      <ResetPasswordForm email={email} token={token} />
    </AuthShell>
  );
}
