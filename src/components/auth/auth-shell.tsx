import Link from "next/link";
import type { ReactNode } from "react";
import { ShipBriefLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  /** Kept for call sites that label a step (e.g. "Password reset"); shown quietly above the title. */
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional line under the form, e.g. "Don't have an account? Create one". */
  footer?: ReactNode;
  wide?: boolean;
};

/**
 * One calm, centred card for every account screen (onboarding uses the wide,
 * card-less variant). Entrance motion is CSS
 * only (`.sb-auth-step`), short, and disabled under reduced motion.
 */
export function AuthShell({ eyebrow, title, description, children, footer, wide = false }: AuthShellProps) {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between px-5 sm:px-8" aria-label="Account navigation">
        <Link href="/" aria-label="ShipBrief home" className="sb-auth-step rounded-md">
          <ShipBriefLogo iconSize={28} />
        </Link>
        <ThemeToggle className="sb-auth-step" />
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:px-5 sm:pt-0">
        <div className={cn("w-full", wide ? "max-w-xl" : "max-w-[420px]")}>
          <div className={cn(!wide && "rounded-2xl border border-border bg-surface px-6 py-8 sm:px-9 sm:py-10")}>
            <div className={cn("sb-auth-step [animation-delay:60ms]", !wide && "text-center")}>
              {eyebrow && <p className="mb-2 text-[13px] font-medium text-muted-foreground">{eyebrow}</p>}
              <h1 className="font-display text-[1.75rem] leading-[1.15] font-medium tracking-tighter text-foreground">{title}</h1>
              {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            <div className="sb-auth-step mt-8 [animation-delay:120ms]">{children}</div>
          </div>
          {footer && <div className="sb-auth-step mt-6 text-center text-sm text-muted-foreground [animation-delay:180ms]">{footer}</div>}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-5 pb-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} ShipBrief</span>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
      </footer>
    </main>
  );
}

/** "Question? Link" line used in the AuthShell footer. */
export function AuthSwitch({ prompt, href, label }: { prompt: string; href: string; label: string }) {
  return (
    <p>
      {prompt}{" "}
      <Link href={href} className="font-medium text-foreground underline-offset-4 hover:underline">
        {label}
      </Link>
    </p>
  );
}
