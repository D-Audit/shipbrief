"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** True once mounted on the client; the theme is unknown during server render. */
const useMounted = () => useSyncExternalStore(() => () => undefined, () => true, () => false);

/**
 * Light/dark switch for the marketing header: a small pill showing both a sun
 * and a moon, with a knob that slides under the active mode. Before mount the
 * knob sits on "light" (the server-rendered default) so nothing shifts during
 * hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-8 w-[60px] shrink-0 items-center rounded-full border border-border bg-surface-subtle p-[3px] transition-colors hover:border-foreground/20",
        className,
      )}
    >
      {/* Sliding knob under the active icon. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] size-6 rounded-full bg-background ring-1 ring-border transition-transform duration-200 ease-out",
          dark && "translate-x-7",
        )}
      />
      <span aria-hidden="true" className="relative z-10 grid w-full grid-cols-2">
        <Sun className={cn("mx-auto size-3.5 transition-colors", dark ? "text-muted-foreground" : "text-foreground")} />
        <Moon className={cn("mx-auto size-3.5 transition-colors", dark ? "text-primary" : "text-muted-foreground")} />
      </span>
    </button>
  );
}

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Light / Dark / System segmented control, for menus with room for all three. */
export function ThemeSegmented({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("grid grid-cols-3 gap-1 rounded-lg bg-surface-subtle p-1", className)}>
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && (theme ?? "light") === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
              active ? "bg-surface text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
