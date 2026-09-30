import type { Metadata } from "next";
import { AuthShell, AuthSwitch } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

type LoginPageProps = { searchParams: Promise<{ next?: string | string[]; notice?: string | string[]; provider?: string | string[] }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const notice = typeof params.notice === "string" ? params.notice : undefined;
  const provider = typeof params.provider === "string" ? params.provider : undefined;
  return (
    <AuthShell title="Welcome back" description="Sign in to your ShipBrief workspace." footer={<AuthSwitch prompt="Don't have an account?" href="/signup" label="Create account" />}>
      <SignInForm next={next} notice={notice} provider={provider} />
    </AuthShell>
  );
}
