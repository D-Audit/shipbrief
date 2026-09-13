"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink, Globe2, Pin, PinOff, Search } from "lucide-react";
import { toast } from "sonner";
import { brandingService, changelogService, releaseService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChangelogSort, ReleaseStatus, WorkspaceBranding } from "@/types";
import { format } from "date-fns";

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
  const { state: brandingState, reload: reloadBranding } = useAsyncData(
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
      toast.success(featured ? "Update unfeatured (mock)." : "Update featured (mock).");
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
      const baseUrl = customDomain ? `https://${customDomain}` : `${window.location.origin}/c/acme`;
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
        actions={<Link href="/c/acme" target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted"><ExternalLink className="size-4" />Public preview</Link>}
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

      {brandingState.status === "success" && <ChangelogSeoPreview branding={brandingState.data} />}
      {(brandingState.status === "loading" || brandingState.status === "idle") && <ChangelogSeoPreviewSkeleton />}
      {brandingState.status === "error" && <section className="sb-panel flex flex-wrap items-center justify-between gap-3 p-4" aria-live="polite"><div><p className="font-medium">SEO and domain preview is unavailable</p><p className="mt-1 text-sm text-muted-foreground">Your changelog entries are still available while branding reloads.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void reloadBranding()}>Retry preview</Button></section>}

      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
      {state.status === "empty" && <EmptyState title="No changelog entries" description="Publish a release to the Changelog channel to build your update history." />}
      {state.status === "success" && (
        <div className="space-y-3">
          {state.data.map((entry) => (
            <article key={entry.id} className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.featured && <Pin className="size-3.5 text-primary" aria-label="Featured" />}
                  <h2 className="font-medium">{entry.title}</h2>
                  <StatusBadge status={entry.status} />
                  <Badge variant="secondary">{entry.category}</Badge>
                  {entry.tags.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {format(new Date(entry.publishedAt), "MMM d, yyyy")} / {entry.reactions} reactions / {entry.comments} comments
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => void copyLink(entry.slug)}><Copy />Copy link</Button>
                <Button type="button" variant="ghost" size="sm" disabled={updatingId === entry.id} onClick={() => void toggleFeatured(entry.id, entry.featured)}>
                  {entry.featured ? <PinOff /> : <Pin />}{entry.featured ? "Unfeature" : "Feature"}
                </Button>
                <Link href={`/c/acme/${entry.slug}`} target="_blank" className="inline-flex h-7 items-center rounded-md px-2.5 text-[0.8rem] font-medium text-primary transition-colors hover:bg-primary/5">Preview</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangelogSeoPreview({ branding }: { branding: WorkspaceBranding }) {
  const domain = branding.domain.trim();
  const hasCustomDomain = domain.length > 0;
  const isConnected = hasCustomDomain && branding.domainStatus === "connected";
  const titleDomain = hasCustomDomain ? domain : "your workspace";
  const domainLabel = isConnected ? "Live public URL" : hasCustomDomain ? "Custom domain preview" : "Current public route";
  const publicUrl = isConnected ? `https://${domain}` : hasCustomDomain ? `https://${domain}` : "/c/acme";

  return (
    <section className="sb-panel overflow-hidden" aria-labelledby="changelog-seo-title">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: branding.accentColor }}><Search className="size-4" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 id="changelog-seo-title" className="font-semibold">SEO &amp; custom-domain preview</h2><Badge variant="outline">{isConnected ? "Connected" : hasCustomDomain ? "Pending verification" : "ShipBrief route"}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">This is the search listing visitors will associate with your branded changelog.</p>
          </div>
        </div>
        <Link href="/app/branding" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted"><Globe2 className="size-4" />Manage branding</Link>
      </div>
      <div className="grid gap-4 border-t border-border bg-surface-subtle/40 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5">
        <div className="min-w-0" aria-label="Search result preview">
          <p className="truncate text-xs font-medium" style={{ color: branding.accentColor }}>{publicUrl}</p>
          <p className="mt-1 truncate text-base font-medium text-primary">What&apos;s New | {titleDomain}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Product updates, improvements, and launches in one searchable, customer-facing history.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full" style={{ backgroundColor: branding.accentColor }} aria-hidden="true" />{domainLabel}</div>
      </div>
    </section>
  );
}

function ChangelogSeoPreviewSkeleton() {
  return <section className="sb-panel p-4 sm:p-5" aria-label="Loading SEO and domain preview" aria-busy="true"><div className="h-4 w-48 animate-pulse rounded bg-muted" /><div className="mt-3 h-3 w-full max-w-lg animate-pulse rounded bg-muted" /><div className="mt-5 h-16 animate-pulse rounded-lg bg-muted/70" /></section>;
}
