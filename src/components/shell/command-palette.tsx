"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { accountNav, commandActions, workspaceNav } from "@/lib/navigation";
import { releaseService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { StatusBadge } from "@/components/shared/page-states";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { state: releasesState } = useAsyncData(() => releaseService.list(), [open]);
  const releases = releasesState.status === "success" ? releasesState.data.slice(0, 5) : [];

  const run = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      description="Search workspace pages, recent releases, and quick actions."
    >
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          {commandActions.map((action) => (
            <CommandItem
              key={action.href + action.label}
              keywords={action.keywords}
              onSelect={() => run(action.href)}
            >
              <span>{action.label}</span>
              {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Recent releases">
          {releases.map((r) => (
            <CommandItem key={r.id} keywords={[r.status, r.category]} onSelect={() => run(`/app/releases/${r.id}`)}>
              <span className="truncate">{r.title}</span>
              <StatusBadge status={r.status} className="ml-auto" />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          {[...workspaceNav, { items: accountNav }].flatMap((s) =>
            s.items.map((item) => (
              <CommandItem key={item.href} onSelect={() => run(item.href)}>
                {item.title}
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        ↑↓ navigate · ↵ select · Esc close
      </div>
    </CommandDialog>
  );
}
