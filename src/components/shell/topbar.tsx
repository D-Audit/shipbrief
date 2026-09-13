"use client";

import { Bell, HelpCircle, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

interface TopbarProps {
  onOpenCommand: () => void;
}

export function Topbar({ onOpenCommand }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4" aria-label="Workspace tools">
      <button
        type="button"
        onClick={onOpenCommand}
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-8 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-surface-subtle/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search or jump to…</span>
        <span className="truncate sm:hidden">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium sm:inline" aria-hidden="true">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Help">
          <HelpCircle />
        </Button>
        <Link
          href="/app/activity"
          aria-label="Notifications"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Account menu" />
            }
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">DJ</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href="/app/settings" />}>Settings</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/app/billing" />}>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/login" />}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
