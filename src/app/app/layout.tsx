import { SessionProvider } from "@/components/session/session-provider";
import { AppShell } from "@/components/shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
