"use client";

import Link from "next/link";
import { CalendarClock, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/page-states";
import { VoteButton } from "./vote-button";
import type { FeedbackRequest } from "@/types";

export function FeedbackCard({
  request,
  onVote,
  voted,
}: {
  request: FeedbackRequest;
  onVote: () => Promise<void>;
  voted?: boolean;
}) {
  return (
    <article className="sb-panel flex gap-3 p-4 transition-colors hover:bg-surface-subtle/60">
      <VoteButton votes={request.votes} onVote={onVote} voted={voted} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/feedback/${request.id}`} className="font-medium leading-snug hover:text-primary hover:underline">
            {request.title}
          </Link>
          <StatusBadge status={request.status} />
          {request.priority && <Badge variant="secondary" className="capitalize">{request.priority} priority</Badge>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{request.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{request.comments} comments</span>
          {request.aiClusterId && <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5 text-primary" />AI grouped</span>}
          {request.createdAt && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(request.createdAt))}</span>}
          {request.source && <span className="capitalize">{request.source} request</span>}
        </div>
        {request.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{request.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>}
      </div>
    </article>
  );
}
