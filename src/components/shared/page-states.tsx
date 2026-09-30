"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Inbox, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small context line above the title, e.g. a parent section. */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && <div className="sb-eyebrow">{eyebrow}</div>}
        <h1 className="sb-title-page">{title}</h1>
        {description && <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Heading row used at the top of panels and page sections. */
export function SectionHeader({
  title,
  description,
  action,
  className,
  id,
  as: Heading = "h2",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
        <Heading id={id} className="sb-title-section">{title}</Heading>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Quiet text link with a trailing arrow, used for "View all" style actions. */
export function InlineLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground", className)}>
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong/80 bg-surface/60 px-6 text-center",
        compact ? "py-8" : "py-14",
        className
      )}
    >
      <span aria-hidden="true" className="mb-4 text-muted-foreground [&_svg]:size-6"><Icon /></span>
      <h3 className="sb-title-card">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card", className)} role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0" aria-hidden="true">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 rounded-sm" style={{ width: `${46 + ((i * 17) % 34)}%` }} />
            <Skeleton className="h-2.5 rounded-sm" style={{ width: `${24 + ((i * 11) % 22)}%` }} />
          </div>
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <section
      role="alert"
      className={cn("flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-border bg-card px-6 py-12 text-center", className)}
    >
      <AlertCircle className="mb-4 size-6 text-danger" strokeWidth={1.5} aria-hidden="true" />
      <h3 className="sb-title-card">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {message ? `${message.replace(/[.!\s]+$/, "")}. ` : ""}Your work is safe.
      </p>
      {onRetry && (
        <Button type="button" variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCcw />
          Try again
        </Button>
      )}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  href,
  suffix,
  hint,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  href?: string;
  suffix?: string;

  /** Supporting line under the value. */
  hint?: React.ReactNode;
  /** Signed percentage change against the previous period. */
  trend?: number;
  className?: string;
}) {
  const content = (
    <>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="sb-stat">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        {typeof trend === "number" && (
          <span className={cn("sb-numeric ml-1 text-xs font-medium", trend >= 0 ? "text-success" : "text-danger")}>
            {trend >= 0 ? "+" : "−"}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const base = cn("block bg-card p-5", className);

  if (href) {
    return (
      <Link href={href} className={cn(base, "transition-colors hover:bg-surface-subtle/60 focus-visible:ring-inset focus-visible:ring-offset-0")}>
        {content}
      </Link>
    );
  }
  return <div className={base}>{content}</div>;
}

const statusStyles: Record<string, { label?: string; tone: "neutral" | "warning" | "info" | "accent" | "success" | "danger" }> = {
  draft: { tone: "neutral" },
  in_review: { label: "In review", tone: "warning" },
  approved: { tone: "info" },
  scheduled: { tone: "accent" },
  published: { tone: "success" },
  archived: { tone: "neutral" },
  sent: { tone: "success" },
  connected: { tone: "success" },
  available: { label: "Not connected", tone: "neutral" },
  disconnected: { tone: "neutral" },
  active: { tone: "success" },
  inactive: { label: "Paused", tone: "neutral" },
  invited: { label: "Invitation sent", tone: "warning" },
  new: { tone: "accent" },
  reviewing: { tone: "warning" },
  planned: { tone: "info" },
  in_progress: { label: "In progress", tone: "accent" },
  shipped: { tone: "success" },
  declined: { tone: "neutral" },
  now: { tone: "accent" },
  next: { tone: "info" },
  later: { tone: "neutral" },
  success: { label: "Delivered", tone: "success" },
  failed: { tone: "danger" },
  paid: { tone: "success" },
  pending: { tone: "warning" },
};

/* Neutral pill; the small dot carries meaning. Rose marks scheduled/active, semantic colours only on the dot. */
const toneClasses = {
  neutral: "[--dot:var(--border-strong)]",
  warning: "[--dot:var(--warning)]",
  info: "[--dot:var(--foreground)]",
  accent: "[--dot:var(--primary-strong)]",
  success: "[--dot:var(--success)]",
  danger: "[--dot:var(--danger)] text-danger",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = statusStyles[status] ?? { tone: "neutral" as const };
  const label = style.label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2 text-xs font-medium whitespace-nowrap text-foreground/80",
        toneClasses[style.tone],
        className
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--dot)]" />
      {label}
    </span>
  );
}
