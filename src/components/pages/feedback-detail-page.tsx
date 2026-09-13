"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Combine, ExternalLink, GitBranch, Loader2, Plus, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CommentList, MergeDialog, VoteButton } from "@/components/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { useAsyncData } from "@/hooks/use-async-data";
import { feedbackService, releaseService, roadmapService } from "@/lib/services";
import type { FeedbackRequest, FeedbackStatus } from "@/types";

const statuses: FeedbackStatus[] = ["new", "reviewing", "planned", "in_progress", "shipped", "declined"];

export function FeedbackDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [voted, setVoted] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [roadmapPickerOpen, setRoadmapPickerOpen] = useState(false);
  const [roadmapChoice, setRoadmapChoice] = useState<string | null>(null);
  const [linkingRoadmap, setLinkingRoadmap] = useState(false);
  const { state, reload } = useAsyncData(() => feedbackService.get(id), [id]);
  const { state: commentsState, reload: reloadComments } = useAsyncData(() => feedbackService.listComments(id), [id]);
  const { state: feedbackState, reload: reloadFeedback } = useAsyncData(() => feedbackService.list(), []);
  const { state: clusterState } = useAsyncData(() => feedbackService.getClusters(), []);
  const { state: roadmapState, reload: reloadRoadmap } = useAsyncData(() => roadmapService.list(), []);
  const { state: releaseState } = useAsyncData(() => releaseService.list(), []);

  const item = state.status === "success" ? state.data : undefined;
  const cluster = useMemo(() => item && clusterState.status === "success" ? clusterState.data.find((entry) => entry.id === item.aiClusterId) : undefined, [clusterState, item]);
  const linkedRoadmap = item && roadmapState.status === "success" ? roadmapState.data.find((entry) => entry.id === item.roadmapItemId) : undefined;
  const linkedRelease = item && releaseState.status === "success" ? releaseState.data.find((entry) => entry.id === item.linkedReleaseId) : undefined;

  const update = async (input: Partial<FeedbackRequest>, message: string) => {
    if (!item) return;
    try {
      await feedbackService.update(item.id, input);
      await reload();
      toast.success(message + " (mock).");
    } catch {
      toast.error("We could not save that feedback change.");
    }
  };

  const vote = async () => {
    if (!item) return;
    try {
      await feedbackService.vote(item.id);
      setVoted(true);
      await reload();
      toast.success("Vote added (mock).");
    } catch {
      toast.error("We could not add that vote.");
    }
  };

  const addComment = async (input: { body: string; isInternal: boolean }) => {
    if (!item) return;
    try {
      await feedbackService.comment(item.id, input);
      await Promise.all([reload(), reloadComments()]);
      toast.success(input.isInternal ? "Internal note added (mock)." : "Comment added (mock).");
    } catch {
      toast.error("We could not add that comment.");
    }
  };

  const openRoadmapPicker = () => {
    if (!item) return;
    if (linkedRoadmap) {
      router.push("/app/roadmap");
      return;
    }

    setRoadmapChoice(null);
    setRoadmapPickerOpen(true);
  };

  const createRoadmapItem = async () => {
    if (!item || linkingRoadmap) return;
    setLinkingRoadmap(true);
    try {
      await roadmapService.create({ title: item.title, description: item.description, status: "later", votes: item.votes, linkedFeedbackIds: [item.id] });
      await Promise.all([reload(), reloadRoadmap(), reloadFeedback()]);
      setRoadmapPickerOpen(false);
      toast.success("New roadmap item linked (mock).");
    } catch {
      toast.error("We could not link this request to the roadmap.");
    } finally {
      setLinkingRoadmap(false);
    }
  };

  const linkToSelectedRoadmap = async () => {
    if (!item || !roadmapChoice || linkingRoadmap || roadmapState.status !== "success") return;
    const selectedRoadmap = roadmapState.data.find((roadmap) => roadmap.id === roadmapChoice);
    if (!selectedRoadmap) return;

    setLinkingRoadmap(true);
    try {
      await roadmapService.setLinks(selectedRoadmap.id, {
        linkedFeedbackIds: selectedRoadmap.linkedFeedbackIds.includes(item.id)
          ? selectedRoadmap.linkedFeedbackIds
          : [...selectedRoadmap.linkedFeedbackIds, item.id],
        linkedReleaseId: selectedRoadmap.linkedReleaseId,
      });
      await Promise.all([reload(), reloadRoadmap(), reloadFeedback()]);
      setRoadmapPickerOpen(false);
      toast.success("Feedback linked to the selected roadmap item (mock).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not link this request to the roadmap.");
    } finally {
      setLinkingRoadmap(false);
    }
  };

  const merge = async (targetId: string) => {
    if (!item) return;
    try {
      const target = await feedbackService.merge(item.id, targetId);
      toast.success("Duplicate request merged (mock).");
      router.replace("/app/feedback/" + target.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not merge this request.");
    }
  };

  const saveNotes = async (notes: string) => {
    setSavingNotes(true);
    await update({ internalNotes: notes }, "Internal notes saved");
    setSavingNotes(false);
  };

  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={3} />;
  if (state.status === "error" || !item) return <ErrorState title="Feedback request unavailable" message={state.status === "error" ? state.error : "The request could not be found."} onRetry={reload} />;

  const candidates = feedbackState.status === "success" ? feedbackState.data.filter((candidate) => candidate.id !== item.id) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={item.title} description={item.source === "internal" ? "Internal feature request" : "Customer feature request"} actions={<><StatusBadge status={item.status} /><Link href="/app/feedback" className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted">All feedback</Link></>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <main className="space-y-6">
          <article className="sb-panel p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>{item.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{item.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}</div>
              <VoteButton votes={item.votes} onVote={vote} voted={voted} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><span>{item.comments} total comments</span>{item.createdAt && <span>Submitted {new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(item.createdAt))}</span>}{item.aiClusterId && <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5 text-primary" />AI cluster attached</span>}</div>
          </article>
          {commentsState.status === "loading" && <LoadingState rows={2} />}
          {commentsState.status === "error" && <ErrorState title="Comments unavailable" message={commentsState.error} onRetry={reloadComments} />}
          {commentsState.status === "success" && <CommentList comments={commentsState.data} onCreate={addComment} />}
        </main>
        <aside className="space-y-4">
          <section className="sb-panel space-y-4 p-4">
            <div><h2 className="text-sm font-semibold">Triage</h2><p className="mt-1 text-xs text-muted-foreground">Keep decisions visible to the team.</p></div>
            <div className="space-y-2"><Label htmlFor="feedback-status">Status</Label><Select value={item.status} onValueChange={(value) => value && void update({ status: value as FeedbackStatus }, "Status updated")}><SelectTrigger id="feedback-status" className="w-full"><SelectValue>{(value) => value?.replace(/_/g, " ")}</SelectValue></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="feedback-priority">Priority</Label><Select value={item.priority ?? "medium"} onValueChange={(value) => value && void update({ priority: value as NonNullable<FeedbackRequest["priority"]> }, "Priority updated")}><SelectTrigger id="feedback-priority" className="w-full"><SelectValue>{(value) => String(value) + " priority"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="high">High priority</SelectItem><SelectItem value="medium">Medium priority</SelectItem><SelectItem value="low">Low priority</SelectItem></SelectContent></Select></div>
            <Button type="button" className="w-full" variant="outline" onClick={openRoadmapPicker}><GitBranch />{linkedRoadmap ? "Open roadmap item" : "Link to roadmap"}</Button>
            <Button type="button" className="w-full" variant="outline" onClick={() => setMergeOpen(true)}><Combine />Merge duplicate</Button>
          </section>
          {cluster && <section className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2"><Bot className="size-4 text-primary" /><h2 className="text-sm font-semibold">AI summary</h2></div><p className="mt-3 text-sm font-medium">{cluster.title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{cluster.topNeed}</p><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{cluster.votes} votes</span><span className="capitalize">{cluster.demand} demand</span></div><p className="mt-3 border-t border-primary/10 pt-3 text-xs italic leading-relaxed text-muted-foreground">&ldquo;{cluster.representativeQuotes[0]}&rdquo;</p></section>}
          {linkedRoadmap && <section className="sb-panel p-4"><h2 className="text-sm font-semibold">Roadmap link</h2><Link href="/app/roadmap" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">{linkedRoadmap.title}<ExternalLink className="size-3.5" /></Link><p className="mt-1 text-xs text-muted-foreground">{linkedRoadmap.status.replace(/_/g, " ")}</p></section>}
          {linkedRelease && <section className="sb-panel p-4"><h2 className="text-sm font-semibold">Shipped release</h2><Link href={"/app/releases/" + linkedRelease.id} className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">{linkedRelease.title}<ExternalLink className="size-3.5" /></Link><p className="mt-1 text-xs text-muted-foreground">Customer communication is linked.</p></section>}
          <InternalNotes initialValue={item.internalNotes ?? ""} onSave={saveNotes} saving={savingNotes} />
        </aside>
      </div>
      <Dialog open={roadmapPickerOpen} onOpenChange={(open) => {
        setRoadmapPickerOpen(open);
        if (!open) setRoadmapChoice(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to roadmap</DialogTitle>
            <DialogDescription>Choose an existing product decision for this customer request, or create a new one from the request.</DialogDescription>
          </DialogHeader>
          {roadmapState.status === "loading" && <p className="text-sm text-muted-foreground">Loading roadmap items...</p>}
          {roadmapState.status === "error" && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Roadmap items are unavailable. Try again from the roadmap workspace.</p>}
          {roadmapState.status === "success" && (roadmapState.data.length ? (
            <div className="space-y-2">
              <Label htmlFor="feedback-roadmap-picker">Existing roadmap item</Label>
              <Select value={roadmapChoice} onValueChange={(value) => setRoadmapChoice(value ? String(value) : null)}>
                <SelectTrigger id="feedback-roadmap-picker" className="w-full"><SelectValue placeholder="Choose a roadmap item" /></SelectTrigger>
                <SelectContent>{roadmapState.data.map((roadmap) => <SelectItem key={roadmap.id} value={roadmap.id}>{roadmap.title} · {roadmap.status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : <p className="text-sm text-muted-foreground">There are no roadmap items yet. Create one from this request to begin.</p>)}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoadmapPickerOpen(false)} disabled={linkingRoadmap}>Cancel</Button>
            <Button type="button" variant="outline" onClick={() => void createRoadmapItem()} disabled={linkingRoadmap}>
              {linkingRoadmap ? <Loader2 className="animate-spin" /> : <Plus />}{linkingRoadmap ? "Linking..." : "Create new"}
            </Button>
            <Button type="button" onClick={() => void linkToSelectedRoadmap()} disabled={!roadmapChoice || linkingRoadmap || roadmapState.status !== "success"}>
              {linkingRoadmap ? <Loader2 className="animate-spin" /> : <GitBranch />}{linkingRoadmap ? "Linking..." : "Link selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MergeDialog open={mergeOpen} request={item} candidates={candidates} onOpenChange={setMergeOpen} onMerge={merge} />
    </div>
  );
}

function InternalNotes({ initialValue, onSave, saving }: { initialValue: string; onSave: (value: string) => Promise<void>; saving: boolean }) {
  const [value, setValue] = useState(initialValue);
  return <section className="sb-panel p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Internal notes</h2><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">TEAM ONLY</span></div><Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} className="mt-3" placeholder="Decision context, research notes, or follow-up..." /><Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={() => void onSave(value)} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving..." : "Save notes"}</Button></section>;
}
