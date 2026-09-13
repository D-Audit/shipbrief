"use client";

import { useState } from "react";
import { CheckCircle2, Code2, DatabaseBackup, GitBranch, Loader2, RefreshCw, Unplug } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncData } from "@/hooks/use-async-data";
import { integrationService } from "@/lib/services";
import { MigrationDialog } from "@/components/operations";
import type { Integration } from "@/types";

const providerIcons: Record<Integration["provider"], typeof Code2> = {
  github: Code2,
  linear: GitBranch,
  gitlab: GitBranch,
  jira: CheckCircle2,
};

export function IntegrationsPage() {
  const [selected, setSelected] = useState<Integration | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Integration | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { state, reload } = useAsyncData(() => integrationService.list(), []);

  const run = async (id: string, action: "connect" | "sync" | "disconnect") => {
    setBusyId(id);
    try {
      if (action === "connect") await integrationService.connect(id);
      if (action === "sync") await integrationService.sync(id);
      if (action === "disconnect") await integrationService.disconnect(id);
      await reload();
      if (action === "disconnect") setDisconnectTarget(null);
      toast.success((action === "sync" ? "Source sync completed" : action === "connect" ? "Integration connected" : "Integration disconnected") + " (mock).");
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
      <PageHeader title="Integrations" description="Bring in trusted work signals, then turn them into clear customer communication." actions={<Button type="button" variant="outline" onClick={() => setMigrationOpen(true)}><DatabaseBackup />Import content</Button>} />
      <section className="rounded-xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><GitBranch className="size-4" /></span><div><h2 className="text-sm font-semibold">How source signals become releases</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Source event → detected work → grouped changes → AI draft → human review → selected channels. Connections are simulated in this frontend phase.</p></div></div></section>
      <IntegrationSection title="Connected" description="Sources currently contributing product-work context." integrations={connected} empty="No source connections yet." busyId={busyId} onManage={setSelected} onConnect={(id) => void run(id, "connect")} onSync={(id) => void run(id, "sync")} />
      <IntegrationSection title="Available to connect" description="Add a source when its work should inform release drafts." integrations={available} empty="All available sources are connected." busyId={busyId} onManage={setSelected} onConnect={(id) => void run(id, "connect")} onSync={(id) => void run(id, "sync")} />
      <section className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"><div className="flex min-w-0 items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><DatabaseBackup className="size-4" /></span><div><h2 className="text-base font-semibold">Import & migration</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Bring historical changelog content from Headway, Featurebase, CSV, JSON, or another export. Preview counts, dates, formatting, media references, and conflicts before a future backend import.</p></div></div><Button type="button" variant="outline" className="shrink-0" onClick={() => setMigrationOpen(true)}>Open import</Button></section>
      {selected && <IntegrationManager integration={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} onSaved={async (detail) => { try { await integrationService.update(selected.id, { detail }); await reload(); toast.success("Connection filters saved (mock)."); } catch { toast.error("We could not save the source filters."); } }} onSync={() => void run(selected.id, "sync")} onDisconnect={() => { setSelected(null); setDisconnectTarget(selected); }} syncing={busyId === selected.id} />}
      {disconnectTarget && <Dialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && setDisconnectTarget(null)}><DialogContent><DialogHeader><DialogTitle>Disconnect {disconnectTarget.name}?</DialogTitle><DialogDescription>ShipBrief will stop reading new work from this source. Existing release drafts and customer communication are unchanged.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setDisconnectTarget(null)}>Keep connected</Button><Button type="button" variant="destructive" onClick={() => void run(disconnectTarget.id, "disconnect")} disabled={busyId === disconnectTarget.id}>{busyId === disconnectTarget.id && <Loader2 className="animate-spin" />}Disconnect</Button></DialogFooter></DialogContent></Dialog>}
      <MigrationDialog open={migrationOpen} onOpenChange={setMigrationOpen} />
    </div>
  );
}

function IntegrationSection({ title, description, integrations, empty, busyId, onManage, onConnect, onSync }: { title: string; description: string; integrations: Integration[]; empty: string; busyId: string | null; onManage: (integration: Integration) => void; onConnect: (id: string) => void; onSync: (id: string) => void }) {
  return <section className="space-y-3"><div><h2 className="text-base font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>{integrations.length === 0 ? <EmptyState title={empty} description="Connections can be added here without configuring a real provider." /> : <div className="grid gap-3 lg:grid-cols-2">{integrations.map((integration) => <IntegrationCard key={integration.id} integration={integration} busy={busyId === integration.id} onManage={() => onManage(integration)} onConnect={() => onConnect(integration.id)} onSync={() => onSync(integration.id)} />)}</div>}</section>;
}

function IntegrationCard({ integration, busy, onManage, onConnect, onSync }: { integration: Integration; busy: boolean; onManage: () => void; onConnect: () => void; onSync: () => void }) {
  const Icon = providerIcons[integration.provider];
  return <article className="sb-panel p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4 text-foreground" /></span><div className="min-w-0"><h3 className="font-medium">{integration.name}</h3><p className="truncate text-sm text-muted-foreground">{integration.detail || "No workspace connected"}</p></div></div><StatusBadge status={integration.status} /></div>{integration.lastSync ? <p className="mt-4 text-xs text-muted-foreground">Last sync {formatDistanceToNow(new Date(integration.lastSync), { addSuffix: true })}</p> : <p className="mt-4 text-xs text-muted-foreground">Permissions and repository filters are configured after connection.</p>}<div className="mt-4 flex flex-wrap gap-2">{integration.status === "connected" ? <><Button type="button" variant="outline" size="sm" onClick={onManage}>Manage</Button><Button type="button" variant="ghost" size="sm" onClick={onSync} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sync now</Button></> : <Button type="button" size="sm" onClick={onConnect} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Connect</Button>}</div></article>;
}

function IntegrationManager({ integration, open, onOpenChange, onSaved, onSync, onDisconnect, syncing }: { integration: Integration; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (detail: string) => Promise<void>; onSync: () => void; onDisconnect: () => void; syncing: boolean }) {
  const [detail, setDetail] = useState(integration.detail);
  const save = async () => { await onSaved(detail); onOpenChange(false); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Manage {integration.name}</DialogTitle><DialogDescription>Set the workspace, repository, project, or branch scope that ShipBrief should use when it drafts releases.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="integration-scope">Source scope</Label><Input id="integration-scope" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={integration.provider === "github" ? "acme / main" : "Workspace or project"} /></div><div className="rounded-lg border border-border bg-surface-subtle/60 p-3 text-xs leading-relaxed text-muted-foreground">ShipBrief requests read-only source context in this mock flow. Repository and branch filters are stored only in the local frontend service.</div></div><DialogFooter><Button type="button" variant="ghost" onClick={onDisconnect}><Unplug />Disconnect</Button><Button type="button" variant="outline" onClick={onSync} disabled={syncing}>{syncing && <Loader2 className="animate-spin" />}Sync</Button><Button type="button" onClick={() => void save()}>Save filters</Button></DialogFooter></DialogContent></Dialog>;
}
