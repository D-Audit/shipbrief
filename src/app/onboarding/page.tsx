import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";

export const metadata: Metadata = {
  title: "Set up your workspace",
};

export default function OnboardingPage() {
  return (
    <AuthShell wide title="Set up your workspace" description="Three quick steps. You can change any of this later in settings.">
      <OnboardingFlow />
    </AuthShell>
  );
}
