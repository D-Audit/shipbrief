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
import { commandActions, workspaceNav } from "@/lib/navigation";
import { mockReleases } from "@/lib/mock-data";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

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
          {mockReleases.slice(0, 3).map((r) => (
            <CommandItem key={r.id} onSelect={() => run(`/app/releases/${r.id}`)}>
              {r.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          {workspaceNav.flatMap((s) =>
            s.items.map((item) => (
              <CommandItem key={item.href} onSelect={() => run(item.href)}>
                {item.title}
              </CommandItem>
            ))
          )}
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        ↑↓ navigate · ↵ select · Esc close
      </div>
    </CommandDialog>
  );
}
