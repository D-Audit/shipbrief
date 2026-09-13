"use client";

import { CalendarDays, MessageSquareText, Rocket, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RoadmapItem } from "@/types";

export function RoadmapCard({ item, onOpen }: { item: RoadmapItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="sb-panel group w-full p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-medium leading-snug group-hover:text-primary">{item.title}</h3>{item.linkedReleaseId && <Rocket className="size-3.5 shrink-0 text-success" aria-label="Linked to a release" />}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" />{item.votes}</span>{item.linkedFeedbackIds.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquareText className="size-3.5" />{item.linkedFeedbackIds.length}</span>}{item.targetDate && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${item.targetDate}T12:00:00`))}</span>}</div>
      {item.linkedReleaseId && <Badge variant="secondary" className="mt-3">Shipped communication linked</Badge>}
    </button>
  );
}
