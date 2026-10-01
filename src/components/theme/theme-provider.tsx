"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * One appearance preference (light / dark / system) shared by the workspace,
 * the marketing site, the account pages and public changelogs: dark unless
 * the visitor picks otherwise. The embed widget keeps a fixed light surface;
 * it follows each workspace's own widget theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      forcedTheme={pathname?.startsWith("/embed") ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
