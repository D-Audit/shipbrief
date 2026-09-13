import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ email?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : undefined;
  return (
    <AuthShell eyebrow="Set a new password" title="Choose a fresh sign-in for ShipBrief." description="This page is a complete frontend reset interface. No account credentials are sent to a server in the demo.">
      <ResetPasswordForm email={email} />
    </AuthShell>
  );
}
