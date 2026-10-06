"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink, Heart, MessageSquare, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { brandingService, changelogService, releaseService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/components/session/session-provider";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChangelogSort, ReleaseStatus } from "@/types";
import { format } from "date-fns";
import { categoryMeta } from "@/components/shared/category-meta";
import { toneText } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ChangelogPublishingPanel } from "./changelog-publishing";

const statuses: { value: "all" | ReleaseStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

const sortOptions: { value: ChangelogSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "most_engaged", label: "Most engaged" },
  { value: "most_discussed", label: "Most discussed" },
];

export function ChangelogManagerPage() {
  const publicPath = `/c/${useSession().session.workspace?.slug ?? ""}`;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"all" | ReleaseStatus>("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<ChangelogSort>("newest");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { state, reload } = useAsyncData(
    () => changelogService.list({
      search: search || undefined,
      category: category === "all" ? undefined : category,
      status: status === "all" ? undefined : status,
      tag: tag === "all" ? undefined : tag,
      sort,
    }),
    [search, category, status, tag, sort]
  );
  const { state: filterOptionsState, reload: reloadFilterOptions } = useAsyncData(
    () => changelogService.getFilterOptions(),
    []
  );
  const { state: brandingState } = useAsyncData(
    () => brandingService.get(),
    []
  );

  const categories = filterOptionsState.status === "success"
    ? filterOptionsState.data.categories
    : ["Feature", "Improvement"];
  const tags = filterOptionsState.status === "success" ? filterOptionsState.data.tags : [];

  const toggleFeatured = async (id: string, featured: boolean) => {
    setUpdatingId(id);
    try {
      await releaseService.update(id, { featured: !featured });
      await reload();
      toast.success(featured ? "Update unfeatured." : "Update featured.");
    } catch {
      toast.error("We could not update this changelog entry.");
    } finally {
      setUpdatingId(null);
    }
  };

  const copyLink = async (slug: string) => {
    try {
      const customDomain = brandingState.status === "success" && brandingState.data.domainStatus === "connected"
        ? brandingState.data.domain.trim()
        : "";
      const baseUrl = customDomain ? `https://${customDomain}` : `${window.location.origin}${publicPath}`;
      await navigator.clipboard.writeText(`${baseUrl}/${slug}`);
      toast.success("Public link copied.");
    } catch {
      toast.error("Copy failed. You can copy the public URL from the preview.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Changelog"
        description="Manage the permanent, searchable history of customer-facing product updates."
        actions={<Link href={publicPath} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted"><ExternalLink className="size-4" />Public preview</Link>}
      />

      <section className="space-y-3" aria-label="Changelog filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input aria-label="Search changelog" placeholder="Search changelog..." value={search} onChange={(event) => setSearch(event.target.value)} className="lg:max-w-sm" />
          <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={(value) => value && setCategory(value)}>
            <SelectTrigger aria-label="Filter by category" className="w-36"><SelectValue>{(value) => value === "all" ? "All categories" : value}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => value && setStatus(value as "all" | ReleaseStatus)}>
            <SelectTrigger aria-label="Filter by status" className="w-36"><SelectValue>{(value) => statuses.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger>
            <SelectContent>{statuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={tag} onValueChange={(value) => value && setTag(value)} disabled={filterOptionsState.status === "loading" || filterOptionsState.status === "idle"}>
            <SelectTrigger aria-label="Filter by tag" className="w-36"><SelectValue>{(value) => value === "all" ? "All tags" : value}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => value && setSort(value as ChangelogSort)}>
            <SelectTrigger aria-label="Sort changelog entries" className="w-40"><SelectValue>{(value) => sortOptions.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger>
            <SelectContent>{sortOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          </div>
        </div>
        {filterOptionsState.status === "error" && <p className="text-xs text-destructive" role="alert">Tags could not load. <button type="button" onClick={() => void reloadFilterOptions()} className="font-medium underline underline-offset-2">Try again</button></p>}
      </section>

      <ChangelogPublishingPanel />

      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
      {state.status === "empty" && <EmptyState title="No changelog entries" description="Publish a release to the Changelog channel to build your update history." />}
      {state.status === "success" && (
        <div className="space-y-3">
          {state.data.map((entry) => (
            <article key={entry.id} className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="sb-title-card">{entry.title}</h2>
                    <StatusBadge status={entry.status} />
                    {entry.featured && <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-strong"><Pin className="size-3" />Featured</span>}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span className={cn("font-medium", toneText[categoryMeta(entry.category).tone])}>{entry.category}</span>
                    <span>{format(new Date(entry.publishedAt), "MMM d, yyyy")}</span>
                    <span className="inline-flex items-center gap-1"><Heart className="size-3" />{entry.reactions}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{entry.comments}</span>
                    {entry.tags.map((item) => <span key={item} className="rounded-full bg-surface-subtle px-2 py-0.5">#{item}</span>)}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => void copyLink(entry.slug)}><Copy />Copy link</Button>
                <Button type="button" variant="ghost" size="sm" disabled={updatingId === entry.id} onClick={() => void toggleFeatured(entry.id, entry.featured)}>
                  {entry.featured ? <PinOff /> : <Pin />}{entry.featured ? "Unfeature" : "Feature"}
                </Button>
                <Link href={`${publicPath}/${entry.slug}`} target="_blank" className="inline-flex h-7 items-center rounded-md px-2.5 text-[0.8rem] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-subtle">Preview</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
