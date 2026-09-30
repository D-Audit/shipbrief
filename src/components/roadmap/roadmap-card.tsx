"use client";

import { CalendarDays, MessageSquareText, Rocket, ThumbsUp } from "lucide-react";
import type { RoadmapItem } from "@/types";

export function RoadmapCard({ item, onOpen }: { item: RoadmapItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="sb-panel group w-full p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-4">{item.title}</h3></div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" />{item.votes}</span>{item.linkedFeedbackIds.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquareText className="size-3.5" />{item.linkedFeedbackIds.length}</span>}{item.targetDate && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${item.targetDate}T12:00:00`))}</span>}</div>
      {item.linkedReleaseId && <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Rocket className="size-3.5" aria-hidden="true" />Release announced</p>}
    </button>
  );
}
