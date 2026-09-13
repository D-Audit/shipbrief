"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        <Typography variant="page-title">{title}</Typography>
        {description && (
          <Typography variant="metadata" className="text-muted-foreground">
            {description}
          </Typography>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section aria-label={`Empty state: ${title}`} className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle/50 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <Typography variant="section-title" className="mb-1">
        {title}
      </Typography>
      <Typography variant="metadata" className="mb-4 max-w-sm text-muted-foreground">
        {description}
      </Typography>
      {action}
    </section>
  );
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" aria-hidden="true" />
      ))}
      <span className="sr-only">
        <Loader2 className="animate-spin" />
        Loading…
      </span>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <section role="alert" aria-live="assertive" className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-danger-muted/30 px-6 py-12 text-center">
      <AlertCircle className="mb-3 size-8 text-destructive" />
      <Typography variant="section-title" className="mb-1">
        {title}
      </Typography>
      <Typography variant="metadata" className="mb-4 max-w-sm text-muted-foreground">
        {message ?? "Please try again. Your existing data is safe."}
      </Typography>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
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
}: {
  label: string;
  value: string | number;
  href?: string;
  suffix?: string;
}) {
  const content = (
    <div className="sb-panel p-4 transition-colors hover:bg-surface-subtle/80">
      <Typography variant="metadata" className="mb-1">
        {label}
      </Typography>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {suffix && (
          <Typography variant="metadata" className="text-muted-foreground">
            {suffix}
          </Typography>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block focus-visible:outline-none" aria-label={`${label}: ${value}${suffix ? ` ${suffix}` : ""}. View details`}>
        {content}
      </a>
    );
  }
  return content;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    in_review: "bg-warning-muted text-warning",
    approved: "bg-primary/10 text-primary",
    scheduled: "bg-accent text-accent-foreground",
    published: "bg-success-muted text-success",
    archived: "bg-muted text-muted-foreground",
    sent: "bg-success-muted text-success",
    connected: "bg-success-muted text-success",
    available: "bg-muted text-muted-foreground",
    active: "bg-success-muted text-success",
    invited: "bg-warning-muted text-warning",
    new: "bg-primary/10 text-primary",
    reviewing: "bg-warning-muted text-warning",
    planned: "bg-accent text-accent-foreground",
    in_progress: "bg-primary/10 text-primary",
    shipped: "bg-success-muted text-success",
    declined: "bg-danger-muted text-danger",
  };

  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}
