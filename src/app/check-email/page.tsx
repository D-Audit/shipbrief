import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailScreen } from "@/components/auth/check-email-screen";
import type { AuthEmailFlow } from "@/lib/services/auth-service";

export const metadata: Metadata = {
  title: "Check your email",
};

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string | string[]; flow?: string | string[]; next?: string | string[] }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : undefined;
  const flow: AuthEmailFlow = params.flow === "reset" ? "reset" : "verify";
  const nextPath = typeof params.next === "string" ? params.next : undefined;
  const verification = flow === "verify";

  return (
    <AuthShell eyebrow={verification ? "One quick check" : "Password reset"} title={verification ? "Confirm your email, then make the workspace yours." : "Your reset instructions are ready."} description={verification ? "We have prepared a local verification message so the sign-up flow feels complete before your first setup step." : "We have prepared a local reset message. Use the next step to update your demo password."}>
      <CheckEmailScreen email={email} flow={flow} nextPath={nextPath} />
    </AuthShell>
  );
}
