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
    <AuthShell title="Check your email" description={verification ? "We sent a confirmation link. Open it to finish creating your workspace." : "We sent a link to reset your password. It expires in 30 minutes."}>
      <CheckEmailScreen email={email} flow={flow} nextPath={nextPath} />
    </AuthShell>
  );
}
