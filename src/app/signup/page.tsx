import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function SignupPage() {
  return (
    <AuthShell eyebrow="ShipBrief" title="Create your ShipBrief account" description="Start with Google or your work email, then make your next release clearer for customers.">
      <SignUpForm />
    </AuthShell>
  );
}
