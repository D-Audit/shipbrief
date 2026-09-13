"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Link2, Loader2, MessageSquareText, Rocket, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackRequest, Release, RoadmapItem, RoadmapStatus } from "@/types";

const statuses: { value: RoadmapStatus; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "next", label: "Next" },
  { value: "later", label: "Later" },
  { value: "shipped", label: "Shipped" },
];

const noReleaseValue = "__no-linked-release__";

export function RoadmapDetail({
  item,
  feedback,
  releases,
  open,
  onOpenChange,
  onSave,
}: {
  item: RoadmapItem;
  feedback: FeedbackRequest[];
  releases: Release[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: Partial<RoadmapItem>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [status, setStatus] = useState<RoadmapStatus>(item.status);
  const [targetDate, setTargetDate] = useState(item.targetDate ?? "");
  const [linkedFeedbackIds, setLinkedFeedbackIds] = useState(item.linkedFeedbackIds);
  const [linkedReleaseId, setLinkedReleaseId] = useState(item.linkedReleaseId);
  const [feedbackToAdd, setFeedbackToAdd] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const linkedFeedback = useMemo(
    () => feedback.filter((request) => linkedFeedbackIds.includes(request.id)),
    [feedback, linkedFeedbackIds]
  );
  const availableFeedback = useMemo(
    () =>
      feedback.filter(
        (request) =>
          !linkedFeedbackIds.includes(request.id) &&
          (!request.roadmapItemId || request.roadmapItemId === item.id)
      ),
    [feedback, item.id, linkedFeedbackIds]
  );
  const releaseOptions = useMemo(
    () => releases.filter((release) => release.status === "published" || release.id === linkedReleaseId),
    [linkedReleaseId, releases]
  );
  const linkedRelease = useMemo(
    () => releases.find((release) => release.id === linkedReleaseId),
    [linkedReleaseId, releases]
  );

  const addFeedback = (feedbackId: string | null) => {
    if (!feedbackId) return;
    setLinkedFeedbackIds((current) => current.includes(feedbackId) ? current : [...current, feedbackId]);
    setFeedbackToAdd(null);
  };

  const removeFeedback = (feedbackId: string) => {
    setLinkedFeedbackIds((current) => current.filter((id) => id !== feedbackId));
  };

  const save = async () => {
    if (!title.trim() || pending) return;
    setPending(true);
    try {
      const saved = await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        targetDate: targetDate || undefined,
        linkedFeedbackIds,
        linkedReleaseId,
      });
      if (saved) onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Roadmap item</DialogTitle>
          <DialogDescription>Connect planned work to the feedback signal and eventual customer communication.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roadmap-title">Title</Label>
            <Input id="roadmap-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roadmap-description">Outcome</Label>
            <Textarea id="roadmap-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roadmap-status">Column</Label>
              <Select value={status} onValueChange={(value) => value && setStatus(value as RoadmapStatus)}>
                <SelectTrigger id="roadmap-status" className="w-full"><SelectValue>{(value) => statuses.find((option) => option.value === value)?.label ?? value}</SelectValue></SelectTrigger>
                <SelectContent>{statuses.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roadmap-date">Target date</Label>
              <Input id="roadmap-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </div>
          </div>

          <section className="space-y-3 rounded-lg border border-border bg-surface-subtle/60 p-3" aria-labelledby="roadmap-feedback-heading">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-primary" />
              <h3 id="roadmap-feedback-heading" className="text-sm font-medium">Linked feedback</h3>
              <span className="text-xs text-muted-foreground">{linkedFeedback.length}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roadmap-feedback-picker" className="text-xs text-muted-foreground">Add a customer request</Label>
              <Select value={feedbackToAdd} onValueChange={(value) => addFeedback(value as string | null)}>
                <SelectTrigger id="roadmap-feedback-picker" className="w-full" disabled={!availableFeedback.length}>
                  <SelectValue placeholder={availableFeedback.length ? "Choose feedback to link" : "No unlinked feedback available"} />
                </SelectTrigger>
                <SelectContent>
                  {availableFeedback.map((request) => (
                    <SelectItem key={request.id} value={request.id}>{request.title} · {request.votes} votes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Feedback already tied to another roadmap item stays with that decision.</p>
            </div>
            {linkedFeedback.length ? (
              <ul className="space-y-2">
                {linkedFeedback.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3 rounded-md bg-background/70 px-2.5 py-2">
                    <Link href={`/app/feedback/${request.id}`} onClick={() => onOpenChange(false)} className="min-w-0 truncate text-sm text-primary hover:underline">
                      {request.title} <span className="text-muted-foreground">· {request.votes} votes</span>
                    </Link>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeFeedback(request.id)} aria-label={`Remove ${request.title} from this roadmap item`}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No requests are linked yet.</p>}
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-surface-subtle/60 p-3" aria-labelledby="roadmap-release-heading">
            <div className="flex items-center gap-2">
              <Rocket className="size-4 text-success" />
              <h3 id="roadmap-release-heading" className="text-sm font-medium">Customer communication</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roadmap-release-picker" className="text-xs text-muted-foreground">Linked shipped release</Label>
              <Select value={linkedReleaseId ?? noReleaseValue} onValueChange={(value) => setLinkedReleaseId(value === noReleaseValue ? undefined : String(value))}>
                <SelectTrigger id="roadmap-release-picker" className="w-full">
                  <SelectValue>{(value) => {
                    if (value === noReleaseValue) return "No release linked";
                    return releases.find((release) => release.id === value)?.title ?? "Linked release";
                  }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noReleaseValue}>No release linked</SelectItem>
                  {releaseOptions.map((release) => <SelectItem key={release.id} value={release.id}>{release.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only published releases can be newly connected to this roadmap outcome.</p>
            </div>
            {linkedRelease && (
              <div className="rounded-md bg-success-muted/30 px-3 py-2">
                <Link href={`/app/releases/${linkedRelease.id}`} onClick={() => onOpenChange(false)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  <Link2 className="size-3.5" />{linkedRelease.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">The customer-facing announcement is linked to this work.</p>
              </div>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" onClick={() => void save()} disabled={!title.trim() || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}{pending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
