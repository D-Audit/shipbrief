import { Bot, Quote, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedbackCluster } from "@/types";

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
    <article className="sb-panel flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span><h3 className="truncate text-sm font-semibold">{cluster.title}</h3></div>
        <Badge variant={cluster.demand === "high" ? "default" : "secondary"} className="capitalize">{cluster.demand} demand</Badge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{cluster.topNeed}</p>
      <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground"><div className="mb-1 flex items-center gap-1 font-medium text-foreground"><Quote className="size-3" />Representative signal</div>&ldquo;{cluster.representativeQuotes[0]}&rdquo;</div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{cluster.votes} votes</span><span>{cluster.comments} comments</span><span className="inline-flex items-center gap-1"><Bot className="size-3.5" />AI grouped</span></div>
      <Button type="button" variant={hasRoadmap ? "outline" : "secondary"} size="sm" className="mt-4 w-full" onClick={onCreateRoadmap} disabled={creating}>
        {hasRoadmap ? "View roadmap link" : creating ? "Creating item..." : "Create roadmap item"}
      </Button>
    </article>
  );
}
