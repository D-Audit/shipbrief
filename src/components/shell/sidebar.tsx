"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { workspaceNav } from "@/lib/navigation";
import { ShipBriefLogo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-border px-3", collapsed && "justify-center")}>
        <Link href="/app/overview" onClick={onNavigate} aria-label="ShipBrief overview">
          <ShipBriefLogo showWordmark={!collapsed} iconSize={collapsed ? 20 : 22} />
        </Link>
      </div>

      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-4 px-2" aria-label="Workspace navigation">
          {workspaceNav.map((section, i) => (
            <div key={i}>
              {section.label && !collapsed && (
                <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/app/overview" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.title}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                {item.badge}
                              </Badge>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
