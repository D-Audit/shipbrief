"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioDraft } from "./types";

function toPlainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function DiffView({
  before,
  after,
  className,
}: {
  before: StudioDraft;
  after: StudioDraft;
  className?: string;
}) {
  const changedTitle = before.title !== after.title;
  const changedSummary = before.summary !== after.summary;
  const beforeText = toPlainText(before.body);
  const afterText = toPlainText(after.body);

  return (
    <section className={cn("space-y-3", className)} aria-label="Suggested content changes">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Suggested changes
        </p>
        <span className="text-xs text-muted-foreground">
          {Math.abs(afterText.length - beforeText.length)} characters changed
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <DiffColumn label="Current" title={before.title} summary={before.summary} body={beforeText} />
        <ArrowRight className="m-auto hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
        <DiffColumn
          label="AI proposal"
          title={after.title}
          summary={after.summary}
          body={afterText}
          emphasized
          changed={changedTitle || changedSummary || beforeText !== afterText}
        />
      </div>
    </section>
  );
}

function DiffColumn({
  label,
  title,
  summary,
  body,
  emphasized = false,
  changed = false,
}: {
  label: string;
  title: string;
  summary: string;
  body: string;
  emphasized?: boolean;
  changed?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-3",
        emphasized ? "border-primary/30 bg-primary/5" : "border-border bg-surface-subtle/50"
      )}
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold", changed && "text-primary")}>{title || "Untitled"}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{summary || "No summary yet."}</p>
      <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-foreground/80">
        {body || "No description yet."}
      </p>
    </div>
  );
}
