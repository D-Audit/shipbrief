"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/shared/page-states";
import { VoteButton } from "./vote-button";
import type { FeedbackRequest } from "@/types";

/** One request: votes, what was asked, status and conversation. Everything else lives on the detail page. */
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
    <article className="flex items-start gap-4 py-4">
      <VoteButton votes={request.votes} onVote={onVote} voted={voted} />
      <div className="min-w-0 flex-1">
        <Link href={`/app/feedback/${request.id}`} className="font-medium leading-snug underline-offset-4 hover:underline">
          {request.title}
        </Link>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{request.description}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <StatusBadge status={request.status} />
          <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{request.comments}</span>
          {request.priority === "high" && <span>High priority</span>}
        </div>
      </div>
    </article>
  );
}
