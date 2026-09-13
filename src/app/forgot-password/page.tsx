import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="Password help" title="Get back to the work that matters." description="Enter your work email and we will prepare a secure reset step for this frontend preview.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
