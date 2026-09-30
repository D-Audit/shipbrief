"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Plus, RefreshCw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { FeedbackCard, FeedbackClusterCard, FeedbackRequestDialog } from "@/components/feedback";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { feedbackService, roadmapService } from "@/lib/services";
import type { FeedbackRequest, FeedbackStatus } from "@/types";

const statusOptions: { value: "all" | FeedbackStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
  { value: "declined", label: "Declined" },
];

export function FeedbackPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | FeedbackStatus>("all");
  const [priority, setPriority] = useState<"all" | NonNullable<FeedbackRequest["priority"]>>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [runningCluster, setRunningCluster] = useState(false);
  const [creatingClusterId, setCreatingClusterId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const { state, reload } = useAsyncData(() => feedbackService.list(), []);
  const { state: clusterState, reload: reloadClusters } = useAsyncData(() => feedbackService.getClusters(), []);
  const { state: roadmapState, reload: reloadRoadmap } = useAsyncData(() => roadmapService.list(), []);

  const filtered = useMemo(() => {
    if (state.status !== "success") return [];
    const query = search.trim().toLowerCase();
    return state.data.filter((request) => {
      const searchable = [request.title, request.description, request.tags.join(" ")].join(" ").toLowerCase();
      return (!query || searchable.includes(query)) && (status === "all" || request.status === status) && (priority === "all" || request.priority === priority);
    });
  }, [priority, search, state, status]);

  const vote = async (id: string) => {
    try {
      await feedbackService.vote(id);
      setVotedIds((current) => new Set(current).add(id));
      await reload();
      toast.success("Vote added.");
    } catch {
      toast.error("We could not add that vote.");
    }
  };

  const createRequest = async (input: Pick<FeedbackRequest, "title" | "description"> & Partial<FeedbackRequest>) => {
    try {
      await feedbackService.create(input);
      await reload();
      toast.success("Feature request created.");
    } catch {
      toast.error("We could not create that request.");
    }
  };

  const runClustering = async () => {
    setRunningCluster(true);
    try {
      await feedbackService.cluster();
      await reloadClusters();
      toast.success("AI feedback clusters refreshed.");
    } catch {
      toast.error("We could not refresh AI clusters. Your feedback is safe.");
    } finally {
      setRunningCluster(false);
    }
  };

  const createFromCluster = async (clusterId: string) => {
    const cluster = clusterState.status === "success" ? clusterState.data.find((item) => item.id === clusterId) : undefined;
    if (!cluster) return;
    const existing = roadmapState.status === "success" ? roadmapState.data.find((item) => cluster.feedbackIds.some((id) => item.linkedFeedbackIds.includes(id))) : undefined;
    if (existing) {
      router.push("/app/roadmap");
      return;
    }
    setCreatingClusterId(clusterId);
    try {
      await roadmapService.createFromCluster(cluster);
      await Promise.all([reloadRoadmap(), reload()]);
      toast.success("Roadmap item created from AI cluster.");
      router.push("/app/roadmap");
    } catch {
      toast.error("We could not create a roadmap item.");
    } finally {
      setCreatingClusterId(null);
    }
  };

  const applySavedFilter = (kind: "high-demand" | "needs-review") => {
    if (kind === "high-demand") {
      setPriority("high");
      setStatus("all");
    } else {
      setStatus("reviewing");
      setPriority("all");
    }
    setSearch("");
  };

  const saveCurrentView = () => {
    if (!search && status === "all" && priority === "all") {
      toast.message("Choose a search or filter before saving a view.");
      return;
    }
    toast.message("Saved views aren't available yet. Your current filters stay applied while you work.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="What customers are asking for, ranked by votes."
        actions={<><Button type="button" variant="outline" onClick={() => void runClustering()} disabled={runningCluster}><RefreshCw className={runningCluster ? "animate-spin" : ""} />{runningCluster ? "Grouping…" : "Regroup themes"}</Button><Button type="button" onClick={() => setRequestOpen(true)}><Plus />New request</Button></>}
      />

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 space-y-4" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="sr-only">Requests</h2>
          <div aria-label="Feedback filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search feedback, tags, or customer needs..." className="pl-9" /></div>
            <div className="grid grid-cols-2 gap-2 sm:flex"><Select value={status} onValueChange={(value) => value && setStatus(value as "all" | FeedbackStatus)}><SelectTrigger className="w-full sm:w-40"><SelectValue>{(value) => statusOptions.find((option) => option.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Select value={priority} onValueChange={(value) => value && setPriority(value as typeof priority)}><SelectTrigger className="w-full sm:w-40"><SelectValue>{(value) => value === "all" ? "All priorities" : String(value) + " priority"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All priorities</SelectItem><SelectItem value="high">High priority</SelectItem><SelectItem value="medium">Medium priority</SelectItem><SelectItem value="low">Low priority</SelectItem></SelectContent></Select></div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1"><span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Filter className="size-3.5" />Views</span><Button type="button" size="sm" variant="ghost" onClick={() => applySavedFilter("high-demand")}>High-priority requests</Button><Button type="button" size="sm" variant="ghost" onClick={() => applySavedFilter("needs-review")}>Needs a decision</Button><Button type="button" size="sm" variant="ghost" onClick={saveCurrentView}><Save />Save current view</Button></div>
          </div>
          <p className="text-xs text-muted-foreground">{String(filtered.length) + " request" + (filtered.length === 1 ? "" : "s")}</p>
        {state.status === "loading" && <LoadingState rows={4} />}
          {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
          {state.status === "success" && filtered.length === 0 && <EmptyState title="No feedback matches this view" description="Adjust the search or filters, or capture a new customer request." action={<Button type="button" onClick={() => setRequestOpen(true)}><Plus />New request</Button>} />}
          {state.status === "success" && filtered.length > 0 && <div className="sb-panel divide-y divide-border px-4">{filtered.map((request) => <FeedbackCard key={request.id} request={request} voted={votedIds.has(request.id)} onVote={() => vote(request.id)} />)}</div>}
        </section>

        <aside className="sb-panel min-w-0 self-start p-4 xl:sticky xl:top-6" aria-labelledby="clusters-heading">
          <SectionHeader id="clusters-heading" title="Themes" description="Similar requests grouped by AI. You decide what happens next." />
        {clusterState.status === "loading" && <LoadingState rows={1} />}
          {clusterState.status === "error" && <ErrorState title="Clusters are unavailable" message={clusterState.error} onRetry={reloadClusters} />}
          {clusterState.status === "success" && <div className="mt-3 divide-y divide-border">{clusterState.data.map((cluster) => <FeedbackClusterCard key={cluster.id} cluster={cluster} hasRoadmap={roadmapState.status === "success" && cluster.feedbackIds.some((id) => roadmapState.data.some((item) => item.linkedFeedbackIds.includes(id)))} onCreateRoadmap={() => void createFromCluster(cluster.id)} creating={creatingClusterId === cluster.id} />)}</div>}
        </aside>
      </div>

      <FeedbackRequestDialog open={requestOpen} onOpenChange={setRequestOpen} onCreate={createRequest} />
    </div>
  );
}
