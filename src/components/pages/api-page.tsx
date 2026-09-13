"use client";

import { useState } from "react";
import { Copy, KeyRound, Loader2, Plus, RotateCcw, ShieldAlert, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncData } from "@/hooks/use-async-data";
import { apiService } from "@/lib/services";
import type { ApiKey, Webhook, WebhookDelivery } from "@/types";

const eventOptions = ["release.published", "release.scheduled", "feedback.created", "feedback.voted"];

export function ApiPage() {
  const [keyDialog, setKeyDialog] = useState(false);
  const [webhookDialog, setWebhookDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Webhook | null>(null);
  const { state: keysState, reload: reloadKeys } = useAsyncData(() => apiService.getKeys(), []);
  const { state: webhookState, reload: reloadWebhooks } = useAsyncData(() => apiService.getWebhooks(), []);
  const { state: deliveryState, reload: reloadDeliveries } = useAsyncData(() => apiService.getDeliveries(), []);

  if (keysState.status === "loading" || webhookState.status === "loading" || deliveryState.status === "loading") return <LoadingState rows={5} />;
  if (keysState.status === "error") return <ErrorState title="API keys unavailable" message={keysState.error} onRetry={reloadKeys} />;
  if (webhookState.status === "error") return <ErrorState title="Webhooks unavailable" message={webhookState.error} onRetry={reloadWebhooks} />;
  if (deliveryState.status === "error") return <ErrorState title="Delivery history unavailable" message={deliveryState.error} onRetry={reloadDeliveries} />;
  if (keysState.status !== "success" || webhookState.status !== "success" || deliveryState.status !== "success") return null;

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await apiService.revokeKey(revokeTarget.id);
      await reloadKeys();
      setRevokeTarget(null);
      toast.success("API key revoked (mock).");
    } catch {
      toast.error("We could not revoke that API key.");
    }
  };

  const removeWebhook = async () => {
    if (!removeTarget) return;
    try {
      await apiService.removeWebhook(removeTarget.id);
      await Promise.all([reloadWebhooks(), reloadDeliveries()]);
      setRemoveTarget(null);
      toast.success("Webhook removed (mock).");
    } catch {
      toast.error("We could not remove that webhook.");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="API & Webhooks" description="Manage integration boundaries without exposing secrets in the frontend." />
      <section className="rounded-xl border border-warning/25 bg-warning-muted/30 p-4"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" /><div><h2 className="text-sm font-semibold">Keep secrets server-side</h2><p className="mt-1 text-sm text-muted-foreground">Keys are permanently masked in ShipBrief. This frontend creates mock records only and never stores a real secret.</p></div></div></section>
      <section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">API keys</h2><p className="text-sm text-muted-foreground">Use scoped server-side keys for trusted integrations.</p></div><Button type="button" size="sm" onClick={() => setKeyDialog(true)}><Plus />Create API key</Button></div><div className="space-y-2">{keysState.data.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No API keys are active.</p> : keysState.data.map((key) => <ApiKeyRow key={key.id} apiKey={key} onRevoke={() => setRevokeTarget(key)} />)}</div></section>
      <section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Webhooks</h2><p className="text-sm text-muted-foreground">Send selected workspace events to a trusted endpoint.</p></div><Button type="button" size="sm" onClick={() => setWebhookDialog(true)}><Plus />Add webhook</Button></div><div className="space-y-3">{webhookState.data.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No webhook endpoints are active.</p> : webhookState.data.map((webhook) => <WebhookRow key={webhook.id} webhook={webhook} onRemoved={() => setRemoveTarget(webhook)} onReload={async () => { await Promise.all([reloadWebhooks(), reloadDeliveries()]); }} />)}</div></section>
      <section className="sb-panel p-4 sm:p-5"><div className="flex items-center gap-2"><RotateCcw className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Delivery history</h2><p className="text-xs text-muted-foreground">Recent mock endpoint attempts and response codes.</p></div></div><div className="mt-4 divide-y divide-border">{deliveryState.data.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Delivery history will appear when webhooks send events.</p> : deliveryState.data.map((delivery) => <DeliveryRow key={delivery.id} delivery={delivery} onRetried={reloadDeliveries} />)}</div></section>
      <CreateKeyDialog open={keyDialog} onOpenChange={setKeyDialog} onCreated={async (name) => { try { await apiService.createKey(name); await reloadKeys(); toast.success("API key record created (mock). The secret remains masked."); } catch { toast.error("We could not create that API key."); } }} />
      <CreateWebhookDialog open={webhookDialog} onOpenChange={setWebhookDialog} onCreated={async (input) => { try { await apiService.createWebhook(input); await reloadWebhooks(); toast.success("Webhook added (mock)."); } catch { toast.error("We could not add that webhook."); } }} />
      {revokeTarget && <ConfirmationDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)} title={"Revoke " + revokeTarget.name + "?"} description="Any server integration using this mock key would stop working immediately." action="Revoke key" destructive onConfirm={revoke} />}
      {removeTarget && <ConfirmationDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)} title="Remove webhook?" description="The endpoint and its local delivery history will be removed from the frontend mock state." action="Remove webhook" destructive onConfirm={removeWebhook} />}
    </div>
  );
}

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: () => void }) {
  const copy = async () => { try { await navigator.clipboard.writeText(apiKey.prefix + "••••••••"); toast.success("Masked key prefix copied."); } catch { toast.error("Copy failed. The key remains masked for safety."); } };
  return <article className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h3 className="font-medium">{apiKey.name}</h3></div><p className="mt-2 font-mono text-sm text-muted-foreground">{apiKey.prefix}••••••••••••</p><p className="mt-1 text-xs text-muted-foreground">Created {format(new Date(apiKey.createdAt), "MMM d, yyyy")}{apiKey.lastUsed ? " · last used " + format(new Date(apiKey.lastUsed), "MMM d") : ""}</p></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void copy()}><Copy />Copy</Button><Button type="button" variant="destructive" size="sm" onClick={onRevoke}>Revoke</Button></div></article>;
}

function WebhookRow({ webhook, onRemoved, onReload }: { webhook: Webhook; onRemoved: () => void; onReload: () => Promise<void> }) {
  const [url, setUrl] = useState(webhook.url);
  const [events, setEvents] = useState(webhook.events);
  const [pending, setPending] = useState(false);
  const save = async (status?: Webhook["status"]) => { setPending(true); try { await apiService.updateWebhook(webhook.id, { url, events, status: status ?? webhook.status }); await onReload(); toast.success("Webhook saved (mock)."); } catch { toast.error("We could not save this webhook."); } finally { setPending(false); } };
  const toggleEvent = (event: string) => setEvents((current) => current.includes(event) ? current.filter((item) => item !== event) : [...current, event]);
  return <article className="sb-panel p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-2"><WebhookIcon className="size-4 text-primary" /><div><h3 className="font-medium">Webhook endpoint</h3><p className="text-xs text-muted-foreground">{webhook.lastDelivery ? "Last delivery " + format(new Date(webhook.lastDelivery), "MMM d, h:mm a") : "No delivery yet"}</p></div></div><span className={webhook.status === "active" ? "rounded-md bg-success-muted px-2 py-0.5 text-xs font-medium text-success" : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"}>{webhook.status}</span></div><div className="mt-4 space-y-3"><div className="space-y-2"><Label htmlFor={"webhook-url-" + webhook.id}>Endpoint URL</Label><Input id={"webhook-url-" + webhook.id} value={url} onChange={(event) => setUrl(event.target.value)} /></div><div><Label>Events</Label><div className="mt-2 flex flex-wrap gap-2">{eventOptions.map((event) => <label key={event} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs"><input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} className="size-3 accent-primary" />{event}</label>)}</div></div></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void save()} disabled={pending || !url.trim() || events.length === 0}>{pending && <Loader2 className="animate-spin" />}Save endpoint</Button><Button type="button" size="sm" variant="outline" onClick={() => void save(webhook.status === "active" ? "inactive" : "active")} disabled={pending}>{webhook.status === "active" ? "Pause" : "Activate"}</Button><Button type="button" size="sm" variant="ghost" onClick={onRemoved}><Trash2 />Remove</Button></div></article>;
}

function DeliveryRow({ delivery, onRetried }: { delivery: WebhookDelivery; onRetried: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const retry = async () => { setPending(true); try { await apiService.retryDelivery(delivery.id); await onRetried(); toast.success("Delivery retried (mock)."); } catch { toast.error("We could not retry this delivery."); } finally { setPending(false); } };
  return <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{delivery.event}</p><p className="text-xs text-muted-foreground">{format(new Date(delivery.deliveredAt), "MMM d, h:mm a")} · HTTP {delivery.responseCode}</p></div><div className="flex items-center gap-2"><span className={delivery.status === "success" ? "text-xs font-medium text-success" : "text-xs font-medium text-danger"}>{delivery.status}</span>{delivery.status === "failed" && <Button type="button" size="sm" variant="outline" onClick={() => void retry()} disabled={pending}>{pending && <Loader2 className="animate-spin" />}Retry</Button>}</div></div>;
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const create = async () => { if (!name.trim() || pending) return; setPending(true); try { await onCreated(name.trim()); setName(""); onOpenChange(false); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Create API key</DialogTitle><DialogDescription>Give the key a recognizable server-side use. A real secret is never generated or displayed in the frontend.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="api-key-name">Key name</Label><Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Production sync" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void create()} disabled={!name.trim() || pending}>{pending && <Loader2 className="animate-spin" />}Create key</Button></DialogFooter></DialogContent></Dialog>;
}

function CreateWebhookDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (input: Pick<Webhook, "url" | "events">) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["release.published"]);
  const [pending, setPending] = useState(false);
  const toggle = (event: string) => setEvents((current) => current.includes(event) ? current.filter((item) => item !== event) : [...current, event]);
  const create = async () => { if (!url.trim() || events.length === 0 || pending) return; setPending(true); try { await onCreated({ url: url.trim(), events }); setUrl(""); setEvents(["release.published"]); onOpenChange(false); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add webhook</DialogTitle><DialogDescription>Events are delivered only as a local frontend simulation until a secure backend endpoint is connected.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="new-webhook-url">Endpoint URL</Label><Input id="new-webhook-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com/hooks/shipbrief" /></div><div><Label>Events</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{eventOptions.map((event) => <label key={event} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={events.includes(event)} onChange={() => toggle(event)} className="size-3.5 accent-primary" />{event}</label>)}</div></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void create()} disabled={!url.trim() || events.length === 0 || pending}>{pending && <Loader2 className="animate-spin" />}Add webhook</Button></DialogFooter></DialogContent></Dialog>;
}

function ConfirmationDialog({ open, onOpenChange, title, description, action, destructive, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; action: string; destructive?: boolean; onConfirm: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const confirm = async () => { setPending(true); try { await onConfirm(); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant={destructive ? "destructive" : "default"} onClick={() => void confirm()} disabled={pending}>{pending && <Loader2 className="animate-spin" />}{action}</Button></DialogFooter></DialogContent></Dialog>;
}
