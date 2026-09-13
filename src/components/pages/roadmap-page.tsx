"use client";

import { useState } from "react";
import { CalendarPlus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RoadmapBoard, RoadmapDetail } from "@/components/roadmap";
import { EmptyState, ErrorState, LoadingState, MetricCard, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { feedbackService, releaseService, roadmapService } from "@/lib/services";
import type { RoadmapItem, RoadmapStatus } from "@/types";

export function RoadmapPage() {
  const [selected, setSelected] = useState<RoadmapItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { state, reload } = useAsyncData(() => roadmapService.list(), []);
  const { state: feedbackState, reload: reloadFeedback } = useAsyncData(() => feedbackService.list(), []);
  const { state: releaseState } = useAsyncData(() => releaseService.list(), []);

  const saveItem = async (id: string, input: Partial<RoadmapItem>) => {
    try {
      const updated = await roadmapService.update(id, input);
      setSelected(updated);
      await Promise.all([reload(), reloadFeedback()]);
      toast.success("Roadmap item saved (mock).");
      return true;
    } catch {
      toast.error("We could not save this roadmap item.");
      return false;
    }
  };

  const createItem = async (input: Partial<RoadmapItem>) => {
    try {
      await roadmapService.create(input);
      await Promise.all([reload(), reloadFeedback()]);
      toast.success("Roadmap item created (mock).");
    } catch {
      toast.error("We could not create a roadmap item.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Roadmap" description="A human-owned view of demand, intent, and shipped customer value." actions={<Button type="button" onClick={() => setCreateOpen(true)}><Plus />New roadmap item</Button>} />
      {state.status === "success" && <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Customer demand" value={state.data.reduce((total, item) => total + item.votes, 0)} suffix="linked votes" /><MetricCard label="In progress now" value={state.data.filter((item) => item.status === "now").length} suffix="items" /><MetricCard label="Shipped" value={state.data.filter((item) => item.status === "shipped").length} suffix="items" /></div>}
      <section className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-4" /></span><div><h2 className="text-sm font-semibold">Evidence informs the roadmap</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Votes and AI clusters help surface demand. Product teams choose the column, timing, and final outcome.</p></div></section>
      {state.status === "loading" && <LoadingState rows={4} />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
      {state.status === "empty" && <EmptyState title="Your roadmap is ready for its first signal" description="Create an item manually or turn an AI feedback cluster into a roadmap decision." action={<Button type="button" onClick={() => setCreateOpen(true)}><Plus />New roadmap item</Button>} />}
      {state.status === "success" && <RoadmapBoard items={state.data} onOpen={setSelected} />}
      {selected && <RoadmapDetail key={selected.id} item={selected} feedback={feedbackState.status === "success" ? feedbackState.data : []} releases={releaseState.status === "success" ? releaseState.data : []} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} onSave={(input) => saveItem(selected.id, input)} />}
      <CreateRoadmapDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={createItem} />
    </div>
  );
}

function CreateRoadmapDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (input: Partial<RoadmapItem>) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<RoadmapStatus>("later");
  const [targetDate, setTargetDate] = useState("");
  const [pending, setPending] = useState(false);

  const create = async () => {
    if (!title.trim() || pending) return;
    setPending(true);
    try {
      await onCreated({ title: title.trim(), description: description.trim(), status, targetDate: targetDate || undefined });
      setTitle("");
      setDescription("");
      setStatus("later");
      setTargetDate("");
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New roadmap item</DialogTitle><DialogDescription>Create a product decision manually. You can link feedback and a released announcement as they become available.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="new-roadmap-title">Title</Label><Input id="new-roadmap-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What outcome are you planning?" /></div>
          <div className="space-y-2"><Label htmlFor="new-roadmap-description">Outcome</Label><Textarea id="new-roadmap-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the customer value..." /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="new-roadmap-status">Column</Label><Select value={status} onValueChange={(value) => value && setStatus(value as RoadmapStatus)}><SelectTrigger id="new-roadmap-status" className="w-full"><SelectValue>{(value) => value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="now">Now</SelectItem><SelectItem value="next">Next</SelectItem><SelectItem value="later">Later</SelectItem><SelectItem value="shipped">Shipped</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="new-roadmap-date">Target date</Label><Input id="new-roadmap-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void create()} disabled={!title.trim() || pending}><CalendarPlus />{pending ? "Creating..." : "Create item"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
