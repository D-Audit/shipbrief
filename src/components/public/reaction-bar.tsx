"use client";

import { MessageCircle, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReactionBar({
  reactions,
  comments,
  hasReacted,
  onToggle,
  pending = false,
}: {
  reactions: number;
  comments: number;
  hasReacted: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={hasReacted}
        aria-label={hasReacted ? "Remove helpful reaction" : "Mark this update as helpful"}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-wait disabled:opacity-60",
          hasReacted ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted"
        )}
      >
        <ThumbsUp className="size-4" />
        {hasReacted ? "Helpful" : "Was this useful?"} ({reactions})
      </button>
      <a href="#comments" className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <MessageCircle className="size-4" />
        {comments} comments
      </a>
    </div>
  );
}
