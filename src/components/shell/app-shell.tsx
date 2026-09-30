"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

interface AppShellProps {
  children: React.ReactNode;
}

/** Routes that use the full width of the content area (editors, boards). */
const wideRoutes = [/^\/app\/releases\/[^/]+$/, /^\/app\/ai-studio/, /^\/app\/roadmap/];

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const wide = wideRoutes.some((pattern) => pattern.test(pathname));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
        return;
      }

      if (isEditing || event.metaKey || event.ctrlKey || !event.altKey) return;

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/app/releases/new");
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        router.push("/app/ai-studio");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-[60] rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background focus:not-sr-only"
      >
        Skip to content
      </a>

      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} swipeDirection="left">
        <DrawerContent className="h-dvh max-h-dvh w-[15.5rem] p-0 lg:hidden">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenCommand={() => setCommandOpen(true)} onOpenNavigation={() => setMobileOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          <div key={pathname} className={`sb-page mx-auto px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-10 ${wide ? "max-w-[88rem]" : "max-w-[72rem]"}`}>
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
