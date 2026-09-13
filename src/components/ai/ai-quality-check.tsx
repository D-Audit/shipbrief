"use client";

import { CheckCircle2, Loader2, ScanLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AIQualityReport } from "@/types";

type QualityState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AIQualityReport }
  | { status: "error"; error: string };

export function AIQualityCheck({
  state,
  onRun,
}: {
  state: QualityState;
  onRun: () => void;
}) {
  return (
    <section className="space-y-3" aria-labelledby="quality-check-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="quality-check-title" className="text-sm font-medium">Quality check</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Benefit, clarity, CTA, and channel fit.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onRun} disabled={state.status === "loading"}>
          {state.status === "loading" ? <Loader2 className="animate-spin" /> : <ScanLine />}
          {state.status === "success" ? "Run again" : "Run check"}
        </Button>
      </div>

      {state.status === "idle" && (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          Run a check when you are ready. AI will flag opportunities; you decide what to change.
        </div>
      )}
      {state.status === "loading" && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-4 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin text-primary" />
          Reviewing the selected draft...
        </div>
      )}
      {state.status === "error" && (
        <div className="rounded-lg border border-destructive/20 bg-danger-muted/40 px-3 py-4 text-xs text-muted-foreground" role="alert">
          {state.error} Your draft is safe.
        </div>
      )}
      {state.status === "success" && <QualityReport report={state.data} />}
    </section>
  );
}

function QualityReport({ report }: { report: AIQualityReport }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary text-sm font-semibold text-primary">
          {report.score}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {report.issues.length === 0
            ? "Looking clear and customer-focused. Keep the final human review."
            : `${report.issues.length} ${report.issues.length === 1 ? "opportunity" : "opportunities"} to review.`}
        </p>
      </div>
      {report.issues.map((issue) => (
        <div key={issue.id} className="rounded-lg border border-border p-3">
          <div className="flex gap-2">
            <TriangleAlert className={`mt-0.5 size-3.5 shrink-0 ${issue.severity === "warning" ? "text-warning" : "text-primary"}`} />
            <div>
              <p className="text-xs font-medium">{issue.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{issue.detail}</p>
              <p className="mt-2 text-xs text-primary">{issue.suggestion}</p>
            </div>
          </div>
        </div>
      ))}
      {report.strengths.map((strength) => (
        <p key={strength} className="flex gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
          {strength}
        </p>
      ))}
    </div>
  );
}

export type { QualityState };
