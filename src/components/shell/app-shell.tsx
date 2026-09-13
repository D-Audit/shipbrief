"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

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
        className="sr-only fixed top-3 left-3 z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm focus:not-sr-only"
      >
        Skip to workspace content
      </a>

      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} swipeDirection="left">
        <DrawerContent className="h-dvh max-h-dvh p-0 lg:hidden">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <span className="text-sm font-semibold">ShipBrief</span>
        </div>
        <Topbar onOpenCommand={() => setCommandOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          <div className="sb-page mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
