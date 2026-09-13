import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";

export const metadata: Metadata = {
  title: "Set up your workspace",
};

export default function OnboardingPage() {
  return (
    <AuthShell wide eyebrow="Workspace setup" title="Start with the release loop your team needs." description="A few focused decisions give ShipBrief useful local context without getting in the way of the work.">
      <OnboardingFlow />
    </AuthShell>
  );
}
