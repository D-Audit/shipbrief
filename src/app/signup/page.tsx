import type { Metadata } from "next";
import { AuthShell, AuthSwitch } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function SignupPage() {
  return (
    <AuthShell title="Create your ShipBrief workspace" description="Free for 14 days. No card required." footer={<AuthSwitch prompt="Already have an account?" href="/login" label="Sign in" />}>
      <SignUpForm />
    </AuthShell>
  );
}
