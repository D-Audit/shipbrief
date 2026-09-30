"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, useSession } from "@/components/session/session-provider";
import { accountNav, workspaceNav, type NavItem } from "@/lib/navigation";
import { ShipBriefIcon } from "@/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  onNavigate?: () => void;
}

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/app/overview" && pathname.startsWith(`${href}/`)) || (href !== "/app/overview" && pathname === href);
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { session } = useSession();

  return (
    <aside className="flex h-full w-[15.5rem] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center px-3">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4" aria-label="Workspace navigation">
        {workspaceNav.map((section, index) => (
          <div key={section.label ?? index} className={cn(index > 0 && "mt-6")}>
            {section.label && <p className="mb-1 px-2 text-xs text-muted-foreground">{section.label}</p>}
            <ul className="space-y-px">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isNavItemActive(pathname, item.href)} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <ul className="space-y-px">
          {accountNav.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} active={isNavItemActive(pathname, item.href)} onNavigate={onNavigate} />
            </li>
          ))}
          <li>
            <Link
              href={`/c/${session.workspace?.slug ?? ""}`}
              target="_blank"
              className="group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/80 group-hover:text-foreground" />
              Public changelog
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors",
        active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground")} />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function WorkspaceSwitcher() {
  const { session, switchWorkspace } = useSession();
  const current = session.workspace!;
  const initial = current.name.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-surface-subtle"
        aria-label="Switch workspace"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">{initial}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] leading-tight font-semibold">{current.name}</span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">{ROLE_LABELS[current.role] ?? current.role}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {session.workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onClick={() => workspace.id !== current.id && void switchWorkspace(workspace.id)}>
              <span className="flex size-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">{workspace.name.charAt(0).toUpperCase()}</span>
              <span className="truncate">{workspace.name}</span>
              {workspace.id === current.id && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/settings" />}>Workspace settings</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/team" />}>Invite teammates</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/" />}>
          <ShipBriefIcon size={14} />
          ShipBrief home
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
