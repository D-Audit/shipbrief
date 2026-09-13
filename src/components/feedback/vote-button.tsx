"use client";

import { useState } from "react";
import { Loader2, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VoteButton({
  votes,
  onVote,
  voted = false,
  compact = false,
}: {
  votes: number;
  onVote: () => Promise<void>;
  voted?: boolean;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);

  const handleVote = async () => {
    if (pending || voted) return;
    setPending(true);
    try {
      await onVote();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={voted ? "secondary" : "outline"}
      size={compact ? "sm" : "default"}
      className={cn("shrink-0", !compact && "h-auto min-w-14 flex-col gap-1 py-2")}
      onClick={() => void handleVote()}
      disabled={pending || voted}
      aria-label={voted ? "You voted for this request" : "Vote for this request"}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className={cn("size-4", voted && "fill-current")} />}
      <span>{votes}</span>
    </Button>
  );
}
