import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedbackCluster } from "@/types";

/** A compact AI theme: what customers want, how many asked, and the roadmap next step. */
export function FeedbackClusterCard({
  cluster,
  onCreateRoadmap,
  hasRoadmap,
  creating,
}: {
  cluster: FeedbackCluster;
  onCreateRoadmap: () => void;
  hasRoadmap: boolean;
  creating?: boolean;
}) {
  return (
    <article className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-sm font-medium">{cluster.title}</h3>
        <span className="sb-numeric shrink-0 text-xs text-muted-foreground">{cluster.votes} votes</span>
      </div>
      <p className="mt-0.5 truncate text-[13px] text-muted-foreground" title={`“${cluster.representativeQuotes[0]}”`}>
        {cluster.topNeed}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", cluster.demand === "high" ? "bg-primary-strong" : "bg-border-strong")} />
          <span className="capitalize">{cluster.demand} demand</span>
        </span>
        <button
          type="button"
          onClick={onCreateRoadmap}
          disabled={creating}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          {creating && <Loader2 className="size-3 animate-spin" />}
          {hasRoadmap ? "On roadmap" : creating ? "Adding…" : "Add to roadmap"}
          {!creating && <ArrowRight className="size-3" />}
        </button>
      </div>
    </article>
  );
}
