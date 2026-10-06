"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * One appearance preference (light / dark / system) shared by the workspace,
 * the marketing site, the account pages and public changelogs: dark unless
 * the visitor picks otherwise. The embed widget keeps a fixed light surface;
 * it follows each workspace's own widget theme.
 *
 * The storage key is versioned so choices saved before dark became the
 * default (often an unintended "light" or "system") don't override it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="shipbrief-theme"
      enableSystem
      disableTransitionOnChange
      forcedTheme={pathname?.startsWith("/embed") ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
