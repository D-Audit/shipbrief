"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, Code2, DatabaseBackup, GitBranch, GitMerge, Loader2, Lock, RefreshCw, Search, Unplug } from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader, StatusBadge } from "@/components/shared/page-states";
import { IconTile } from "@/components/shared/icon-tile";
import type { Tone } from "@/lib/tones";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncData } from "@/hooks/use-async-data";
import { integrationService } from "@/lib/services";
import { ApiError } from "@/lib/api/client";
import { MigrationDialog } from "@/components/operations";
import type { Integration, IntegrationTarget } from "@/types";
import { cn } from "@/lib/utils";

/** Each source keeps a distinct tile colour so connections are easy to scan. */
const providerMeta: Record<Integration["provider"], { icon: typeof Code2; tone: Tone }> = {
  github: { icon: Code2, tone: "ink" },
  linear: { icon: GitBranch, tone: "violet" },
  gitlab: { icon: GitMerge, tone: "amber" },
  jira: { icon: CheckCircle2, tone: "blue" },
};

export function IntegrationsPage() {
  const [selected, setSelected] = useState<Integration | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Integration | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { state, reload } = useAsyncData(() => integrationService.list(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Returning from OAuth is a fresh page load, so the provider that just connected is read once on arrival;
  // its scope picker opens as soon as the list shows it connected without a scope yet.
  const [justConnected, setJustConnected] = useState(() => (searchParams.get("connect") === "success" ? searchParams.get("provider") : null));
  const autoManage =
    justConnected && state.status === "success" ? (state.data.find((item) => item.id === justConnected && item.status === "connected" && !item.detail) ?? null) : null;
  const managing = selected ?? autoManage;

  useEffect(() => {
    // Returning from a provider's OAuth screen.
    const outcome = searchParams.get("connect");
    if (!outcome) return;
    const provider = searchParams.get("provider") ?? "The integration";
    const names: Record<string, string> = { github: "GitHub", gitlab: "GitLab", linear: "Linear", jira: "Jira" };
    const name = names[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
    if (outcome === "success") toast.success(`${name} connected. Choose what ShipBrief should watch.`);
    else if (outcome === "failed") toast.error(`${name} couldn't be connected. Please try again.`);
    router.replace(pathname);
  }, [searchParams, router, pathname]);

  const run = async (id: string, action: "connect" | "sync" | "disconnect", since?: string) => {
    setBusyId(id);
    try {
      if (action === "connect") {
        // Leaves for the provider's consent screen; we come back to this page afterwards.
        await integrationService.connect(id);
        return;
      }
      if (action === "sync") {
        const result = await integrationService.sync(id, since);
        await reload();
        const range = since ? `since ${format(new Date(`${since}T00:00:00`), "MMM d")}` : "since the last sync";
        toast.success(result.newItems ? `Sync complete — ${result.newItems} new item${result.newItems === 1 ? "" : "s"} drafted as a release.` : `Sync complete — nothing new ${range}.`);
        return;
      }
      await integrationService.disconnect(id);
      await reload();
      setDisconnectTarget(null);
      toast.success("Integration disconnected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not update this integration.");
    } finally {
      setBusyId(null);
    }
  };

  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;

  const connected = state.data.filter((item) => item.status === "connected");
  const available = state.data.filter((item) => item.status !== "connected");

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect where your team ships. Merged work becomes release drafts — ShipBrief never writes to your code." actions={<Button type="button" variant="outline" onClick={() => setMigrationOpen(true)}><DatabaseBackup />Import content</Button>} />
      <section aria-label="Source summary" className="grid gap-px overflow-hidden rounded-[var(--radius-xl)] sb-feature sm:grid-cols-3">
        {[
          { label: "Sources connected", value: `${connected.length} of ${state.data.length}`, dot: "bg-ink-foreground/50" },
          { label: "Access", value: "Read-only", dot: "bg-ink-foreground/50" },
          {
            label: "Last sync",
            value: connected.some((item) => item.lastSync)
              ? formatDistanceToNow(new Date(Math.max(...connected.filter((item) => item.lastSync).map((item) => new Date(item.lastSync!).getTime()))), { addSuffix: true })
              : "Not yet",
            dot: "bg-primary-strong",
          },
        ].map((stat) => (
          <div key={stat.label} className="px-5 py-4">
            <p className="flex items-center gap-2 text-xs text-ink-foreground/60"><span className={`size-1.5 rounded-full ${stat.dot}`} />{stat.label}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-[-0.01em]">{stat.value}</p>
          </div>
        ))}
      </section>
      <IntegrationSection title="Connected" description="Sources currently contributing product-work context." integrations={connected} empty="No source connections yet." busyId={busyId} onManage={setSelected} onConnect={(id) => void run(id, "connect")} onSync={(id) => void run(id, "sync")} />
      <IntegrationSection title="Available to connect" description="Add a source when its work should inform release drafts." integrations={available} empty="All available sources are connected." busyId={busyId} onManage={setSelected} onConnect={(id) => void run(id, "connect")} onSync={(id) => void run(id, "sync")} />
      <section className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"><div className="flex min-w-0 items-start gap-3"><IconTile icon={DatabaseBackup} tone="amber" /><div><h2 className="sb-title-section">Import & migration</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Bring historical changelog content from Headway, Featurebase, CSV, JSON, or another export. Preview counts, dates, formatting and conflicts, then import posts as drafts.</p></div></div><Button type="button" variant="outline" className="shrink-0" onClick={() => setMigrationOpen(true)}>Open import</Button></section>
      {managing && <IntegrationManager key={managing.id} integration={managing} open onOpenChange={(open) => { if (!open) { setSelected(null); setJustConnected(null); } }} onSaved={async (detail, track) => { await integrationService.update(managing.id, { detail, track }); await reload(); toast.success(watchingMessage(detail, track)); }} onSync={(since?: string) => void run(managing.id, "sync", since)} onDisconnect={() => { setDisconnectTarget(managing); setSelected(null); setJustConnected(null); }} syncing={busyId === managing.id} />}
      {disconnectTarget && <Dialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && setDisconnectTarget(null)}><DialogContent><DialogHeader><DialogTitle>Disconnect {disconnectTarget.name}?</DialogTitle><DialogDescription>ShipBrief will stop reading new work from this source. Existing release drafts and customer communication are unchanged.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setDisconnectTarget(null)}>Keep connected</Button><Button type="button" variant="destructive" onClick={() => void run(disconnectTarget.id, "disconnect")} disabled={busyId === disconnectTarget.id}>{busyId === disconnectTarget.id && <Loader2 className="animate-spin" />}Disconnect</Button></DialogFooter></DialogContent></Dialog>}
      <MigrationDialog open={migrationOpen} onOpenChange={setMigrationOpen} />
    </div>
  );
}

function IntegrationSection({ title, description, integrations, empty, busyId, onManage, onConnect, onSync }: { title: string; description: string; integrations: Integration[]; empty: string; busyId: string | null; onManage: (integration: Integration) => void; onConnect: (id: string) => void; onSync: (id: string) => void }) {
  return <section className="space-y-3"><SectionHeader title={title} description={description} />{integrations.length === 0 ? <EmptyState title={empty} description="Connect a source to turn completed work into release drafts." /> : <div className="grid gap-3 lg:grid-cols-2">{integrations.map((integration) => <IntegrationCard key={integration.id} integration={integration} busy={busyId === integration.id} onManage={() => onManage(integration)} onConnect={() => onConnect(integration.id)} onSync={() => onSync(integration.id)} />)}</div>}</section>;
}

function IntegrationCard({ integration, busy, onManage, onConnect, onSync }: { integration: Integration; busy: boolean; onManage: () => void; onConnect: () => void; onSync: () => void }) {
  const meta = providerMeta[integration.provider];
  return <article className="sb-panel p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><IconTile icon={meta.icon} tone={meta.tone} size="lg" /><div className="min-w-0"><h3 className="font-medium">{integration.name}</h3><p className="truncate text-sm text-muted-foreground">{integration.lastError ?? (integration.detail || integration.account || (integration.configured === false ? "Not set up for this installation yet" : "Not connected"))}</p></div></div><StatusBadge status={integration.status} /></div>{integration.lastSync ? <p className="mt-4 text-xs text-muted-foreground">Last sync {formatDistanceToNow(new Date(integration.lastSync), { addSuffix: true })}</p> : <p className="mt-4 text-xs text-muted-foreground">Permissions and repository filters are configured after connection.</p>}<div className="mt-4 flex flex-wrap gap-2">{integration.status === "connected" ? <><Button type="button" variant="outline" size="sm" onClick={onManage}>Manage</Button><Button type="button" variant="ghost" size="sm" onClick={onSync} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sync now</Button></> : <Button type="button" size="sm" onClick={onConnect} disabled={busy || integration.configured === false} title={integration.configured === false ? `An administrator needs to add ${integration.name} OAuth credentials first.` : undefined}>{busy && <Loader2 className="animate-spin" />}Connect</Button>}</div></article>;
}

function watchingMessage(detail: string, track?: Integration["track"]) {
  if (!detail) return "Now watching all teams.";
  if (track === "commits") return `Now watching every commit to ${detail}.`;
  if (track === "pull_requests") return `Now watching merged pull requests in ${detail}.`;
  return `Now watching ${detail}.`;
}

const scopeCopy: Record<Integration["provider"], { noun: string; plural: string; placeholder: string }> = {
  github: { noun: "repository", plural: "repositories", placeholder: "owner/repository" },
  gitlab: { noun: "project", plural: "projects", placeholder: "group/project" },
  linear: { noun: "team", plural: "teams", placeholder: "Team key, e.g. ENG" },
  jira: { noun: "project", plural: "projects", placeholder: "Project key, e.g. ACM" },
};

/**
 * Pick what a connected source watches: a searchable list of the account's
 * repositories / projects / teams, with manual entry as a fallback.
 */
function IntegrationManager({ integration, open, onOpenChange, onSaved, onSync, onDisconnect, syncing }: { integration: Integration; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (detail: string, track?: Integration["track"]) => Promise<void>; onSync: (since?: string) => void; onDisconnect: () => void; syncing: boolean }) {
  const copy = scopeCopy[integration.provider];
  const [detail, setDetail] = useState(integration.detail);
  const [track, setTrack] = useState(integration.track);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const { state: targets, reload } = useAsyncData<IntegrationTarget[]>(() => integrationService.targets(integration.id), [integration.id]);

  const filtered = useMemo(() => {
    if (targets.status !== "success") return [];
    const needle = query.trim().toLowerCase();
    const list = needle ? targets.data.filter((t) => `${t.label} ${t.value} ${t.description ?? ""}`.toLowerCase().includes(needle)) : targets.data;
    return list.slice(0, 200);
  }, [targets, query]);

  const [saveError, setSaveError] = useState<{ message: string; suggestion?: string } | null>(null);
  // "Include earlier work": a start date within the last 90 days (the API's limit).
  const today = format(new Date(), "yyyy-MM-dd");
  const earliest = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const [since, setSince] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSaved(detail.trim(), track);
      onOpenChange(false);
    } catch (error) {
      // Stay open and explain (e.g. a repo under the wrong owner), offering the suggested fix.
      const details = error instanceof ApiError ? (error.details as { suggestion?: string } | undefined) : undefined;
      setSaveError({ message: error instanceof Error ? error.message : "We couldn't save that choice. Please try again.", suggestion: details?.suggestion });
    } finally {
      setSaving(false);
    }
  };

  const option = (value: string, label: string, sub?: string, isPrivate?: boolean) => {
    const active = detail === value;
    return (
      <li key={value || "__all"}>
        <button
          type="button"
          onClick={() => setDetail(value)}
          aria-pressed={active}
          className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", active ? "bg-surface-subtle ring-1 ring-foreground/70" : "hover:bg-surface-subtle")}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="truncate">{label}</span>
              {isPrivate && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Private" />}
            </span>
            {sub && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sub}</span>}
          </span>
          {active && <Check className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />}
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a {copy.noun} to watch</DialogTitle>
          <DialogDescription>
            {integration.account ? `Connected as ${integration.account}. ` : ""}ShipBrief drafts releases from work completed in this {copy.noun}.
          </DialogDescription>
        </DialogHeader>

        {!manual ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${copy.plural}`} aria-label={`Search ${copy.plural}`} className="h-10 pl-9" autoFocus />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border p-1">
              {targets.status === "loading" || targets.status === "idle" ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading your {copy.plural}…</p>
              ) : targets.status === "error" ? (
                <div className="space-y-3 px-3 py-8 text-center text-sm">
                  <p className="text-muted-foreground">{targets.error}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void reload()}><RefreshCw />Try again</Button>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {integration.provider === "linear" && !query && option("", "All teams", "Watch completed issues across every team")}
                  {filtered.map((t) => option(t.value, t.label, [t.label !== t.value ? t.value : null, t.description, t.updatedAt ? `Active ${formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}` : null].filter(Boolean).join(" · "), t.private))}
                  {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">{query ? `No ${copy.plural} match “${query}”.` : `No ${copy.plural} found for this account.`}</li>}
                </ul>
              )}
            </div>
            <button type="button" onClick={() => setManual(true)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Can&apos;t find it? Type the {copy.noun} instead
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="integration-scope">{copy.noun.charAt(0).toUpperCase() + copy.noun.slice(1)}</Label>
            <Input id="integration-scope" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={copy.placeholder} className="h-10" autoFocus />
            <p className="text-xs text-muted-foreground">{integration.targetHint}</p>
            <button type="button" onClick={() => setManual(false)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Back to the list
            </button>
          </div>
        )}

        {track && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-foreground">What to track</p>
            <div role="radiogroup" aria-label="What to track" className="grid gap-2 sm:grid-cols-2">
              {([
                ["commits", "Every commit", "All work committed to the main branch, including small direct pushes."],
                ["pull_requests", "Merged pull requests", "Only work reviewed and merged through pull requests."],
              ] as const).map(([value, title, description]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={track === value}
                  onClick={() => setTrack(value)}
                  className={cn("rounded-lg border px-3 py-2.5 text-left transition-colors", track === value ? "border-foreground bg-surface-subtle" : "border-border hover:border-foreground/30")}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                    {title}
                    {track === value && <Check className="size-4 shrink-0" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">ShipBrief reads only titles — the first line of each commit message or pull request — never your code.</p>
          </div>
        )}

        {integration.detail && (
          <div className="rounded-lg border border-border p-3">
            <p className="text-[13px] font-medium text-foreground">Include earlier work</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sync normally picks up work since the last sync. Choose a date to pull in anything completed from then on (up to 90 days back). Items already imported are never duplicated.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Input type="date" value={since} min={earliest} max={today} onChange={(event) => setSince(event.target.value)} aria-label="Sync from date" className="h-9 w-auto" />
              <Button type="button" variant="outline" size="sm" className="h-9" disabled={syncing || !since || since < earliest || since > today} onClick={() => onSync(since)}>
                {syncing && <Loader2 className="animate-spin" />}Sync from this date
              </Button>
            </div>
          </div>
        )}

        {saveError && (
          <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[13px] leading-relaxed text-destructive">
            {saveError.message}
            {saveError.suggestion && (
              <button type="button" onClick={() => { setDetail(saveError.suggestion!); setManual(false); setQuery(""); setSaveError(null); }} className="ml-1 font-medium underline underline-offset-4">
                Use {saveError.suggestion}
              </button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onDisconnect}><Unplug />Disconnect</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onSync()} disabled={syncing || !integration.detail}>{syncing && <Loader2 className="animate-spin" />}Sync now</Button>
            <Button type="button" onClick={() => void save()} disabled={saving || (integration.provider !== "linear" && !detail.trim())}>
              {saving && <Loader2 className="animate-spin" />}Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
