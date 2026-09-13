"use client";

import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { aiGenerationSteps } from "@/lib/mock-data/ai-studio";
import { Button } from "@/components/ui/button";
import { DiffView } from "./diff-view";
import type { AIGeneration } from "./types";

export function GenerationState({
  generation,
  step,
  onApply,
  onTryAnother,
  onContinueManually,
}: {
  generation: AIGeneration;
  step: number;
  onApply: () => void;
  onTryAnother: () => void;
  onContinueManually: () => void;
}) {
  if (generation.status === "generating") {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-primary" />
          Creating a proposal
        </div>
        <div className="mt-4 space-y-2">
          {aiGenerationSteps.map((label, index) => (
            <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-border-strong"}`}
                aria-hidden="true"
              />
              <span className={index === step ? "font-medium text-foreground" : undefined}>{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Your existing draft will not change.</p>
      </div>
    );
  }

  if (generation.status === "error") {
    return (
      <div className="rounded-xl border border-destructive/20 bg-danger-muted/40 p-4" role="alert">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">We could not generate this draft.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {generation.error ?? "Your existing content is safe. Try again or continue editing manually."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onTryAnother}>
            <RotateCcw />
            Try again
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onContinueManually}>
            Continue manually
          </Button>
        </div>
      </div>
    );
  }

  if (!generation.proposal) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-surface p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium">{generation.summary ?? "Draft ready for review"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This is a proposal. Review it before it changes your release.
          </p>
          {generation.contextSummary && (
            <p className="mt-2 text-xs text-muted-foreground">{generation.contextSummary}</p>
          )}
        </div>
      </div>
      <DiffView before={generation.before} after={generation.proposal} className="mt-4" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApply}>Apply</Button>
        <Button type="button" size="sm" variant="outline" onClick={onTryAnother}>
          <RotateCcw />
          Try another
        </Button>
        {generation.kind === "channel_variant" && (
          <Button type="button" size="sm" variant="ghost" onClick={onContinueManually}>
            Continue manually
          </Button>
        )}
      </div>
    </div>
  );
}
