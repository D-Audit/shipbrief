"use client";

import { useState } from "react";
import { Combine, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedbackRequest } from "@/types";

export function MergeDialog({
  open,
  request,
  candidates,
  onOpenChange,
  onMerge,
}: {
  open: boolean;
  request: FeedbackRequest;
  candidates: FeedbackRequest[];
  onOpenChange: (open: boolean) => void;
  onMerge: (targetId: string) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);

  const activeTargetId = candidates.some((candidate) => candidate.id === targetId) ? targetId : candidates[0]?.id ?? "";

  const merge = async () => {
    if (!activeTargetId || pending) return;
    setPending(true);
    try {
      await onMerge(activeTargetId);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge duplicate request</DialogTitle>
          <DialogDescription>Move the votes, comments, and tags from &ldquo;{request.title}&rdquo; into the canonical request. This mock action is reversible only when a backend audit trail is connected.</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? <p className="text-sm text-muted-foreground">There are no other active requests to merge into.</p> : <div className="space-y-2"><Label htmlFor="merge-target">Canonical request</Label><Select value={activeTargetId} onValueChange={(value) => value && setTargetId(value)}><SelectTrigger id="merge-target" className="w-full"><SelectValue>{(value) => candidates.find((candidate) => candidate.id === value)?.title ?? "Choose a request"}</SelectValue></SelectTrigger><SelectContent>{candidates.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.title} · {candidate.votes} votes</SelectItem>)}</SelectContent></Select></div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => void merge()} disabled={!activeTargetId || pending}>{pending ? <Loader2 className="animate-spin" /> : <Combine />}{pending ? "Merging..." : "Merge request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
