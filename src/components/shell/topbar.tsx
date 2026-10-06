"use client";

import Link from "next/link";
import { ROLE_LABELS, useSession } from "@/components/session/session-provider";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import { Bell, ChevronRight, CircleHelp, Menu, Search } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ProductUpdatesButton } from "./product-updates-button";
import { useAsyncData } from "@/hooks/use-async-data";
import { activityService } from "@/lib/services";
import { routeTitles } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onOpenCommand: () => void;
  onOpenNavigation: () => void;
}

export function Topbar({ onOpenCommand, onOpenNavigation }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3 sm:px-5" aria-label="Workspace tools">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenNavigation} aria-label="Open navigation">
        <Menu />
      </Button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenCommand}
          aria-keyshortcuts="Control+K Meta+K"
          className="mr-1 flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Search or jump to…</span>
          <span className="sr-only sm:hidden">Search</span>
          <kbd className="ml-auto hidden rounded border border-border bg-surface-subtle px-1.5 py-px font-sans text-[10px] font-medium sm:inline" aria-hidden="true">
            Ctrl K
          </kbd>
        </button>
        {/* One-click light/dark on every workspace page; phones use Appearance in the account menu. */}
        <ThemeToggle className="mx-1 hidden sm:inline-flex" />
        <HelpMenu />
        <ProductUpdatesButton />
        <NotificationsPopover />
        <AccountMenu />
      </div>
    </header>
  );
}

function Breadcrumbs() {
  const { session } = useSession();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const crumbs = segments.map((segment, index) => {
    const href = `/app/${segments.slice(0, index + 1).join("/")}`;
    const known = routeTitles[segment];
    const label = known ?? (segments[0] === "releases" ? "Release" : segments[0] === "feedback" ? "Request" : segment);
    return { href, label };
  });

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <li className="hidden text-muted-foreground sm:block">{session.workspace?.name}</li>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className={cn("flex min-w-0 items-center gap-1.5", !last && "hidden sm:flex")}>
              <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground/60", index === 0 && "hidden sm:block")} aria-hidden="true" />
              {last ? (
                <span aria-current="page" className="truncate font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const { state } = useAsyncData(() => activityService.list(), [revision, open]);
  const events = state.status === "success" ? state.data : [];
  const unread = events.filter((event) => !event.read).length;

  const markAll = async () => {
    await activityService.markAllRead();
    setRevision((value) => value + 1);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}
      >
        <Bell />
        {unread > 0 && <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-primary-strong ring-2 ring-background" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button type="button" onClick={() => void markAll()} disabled={unread === 0} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {state.status === "loading" && <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>}
          {state.status === "empty" && <p className="px-4 py-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {events.slice(0, 6).map((event) => (
            <Link
              key={event.id}
              href={event.link ?? "/app/activity"}
              onClick={() => { void activityService.markRead(event.id); setOpen(false); }}
              className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-subtle/70"
            >
              <span aria-hidden="true" className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", event.read ? "bg-transparent" : "bg-primary-strong")} />
              <span className="min-w-0">
                <span className="block text-[13px] leading-snug">{event.message}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  {event.actor ? ` · ${event.actor}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
        <Link href="/app/activity" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground">
          View all activity
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Help and shortcuts" />}>
        <CircleHelp />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Keyboard shortcuts</DropdownMenuLabel>
          <ShortcutRow label="Search and jump" keys="Ctrl K" />
          <ShortcutRow label="New release" keys="Alt N" />
          <ShortcutRow label="Open AI Studio" keys="Alt A" />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/widget" />}>Install the in-app widget</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/integrations" />}>Connect a source</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 text-sm">
      <span>{label}</span>
      <kbd className="rounded border border-border bg-surface-subtle px-1.5 py-px text-[10px] text-muted-foreground">{keys}</kbd>
    </div>
  );
}

function AccountMenu() {
  const { theme, setTheme } = useTheme();
  const { session, signOut } = useSession();
  const initials = session.user.name.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="ml-1 rounded-full" aria-label="Account menu" />}>
        <Avatar className="size-7">
          <AvatarFallback className="bg-surface-subtle text-[11px] font-medium text-foreground ring-1 ring-border">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{session.user.email} · {ROLE_LABELS[session.workspace?.role ?? ""] ?? ""}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/settings?tab=account" />}>Account settings</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/settings?tab=notifications" />}>Notification preferences</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/billing" />}>Billing</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={(value) => setTheme(String(value))}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
