"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * One appearance preference (light / dark / system) shared by the workspace,
 * the marketing site and the account pages. Public changelogs and the embed
 * widget keep a fixed light surface: they follow each workspace's own
 * branding theme, not the visitor's ShipBrief preference.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const branded = pathname?.startsWith("/c/") || pathname?.startsWith("/embed");

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      forcedTheme={branded ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
