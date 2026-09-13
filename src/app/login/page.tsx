import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell eyebrow="ShipBrief" title="Sign in or create an account" description="Choose the way you would like to continue into your release workspace.">
      <SignInForm />
    </AuthShell>
  );
}
