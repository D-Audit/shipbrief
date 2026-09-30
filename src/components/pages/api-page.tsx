"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plus, ShieldCheck, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ErrorState, LoadingState, PageHeader, SectionHeader, StatusBadge } from "@/components/shared/page-states";
import { IconTile } from "@/components/shared/icon-tile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listData, useAsyncData } from "@/hooks/use-async-data";
import { apiService } from "@/lib/services";
import type { ApiKey, Webhook, WebhookDelivery } from "@/types";

const eventOptions = ["release.published", "release.scheduled", "release.approved", "feedback.created", "feedback.updated", "roadmap.updated", "campaign.sent"];

export function ApiPage() {
  const [keyDialog, setKeyDialog] = useState(false);
  const [webhookDialog, setWebhookDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Webhook | null>(null);
  const [revealed, setRevealed] = useState<{ title: string; description: string; secret: string } | null>(null);
  const { state: keysState, reload: reloadKeys } = useAsyncData(() => apiService.getKeys(), []);
  const { state: webhookState, reload: reloadWebhooks } = useAsyncData(() => apiService.getWebhooks(), []);
  const { state: deliveryState, reload: reloadDeliveries } = useAsyncData(() => apiService.getDeliveries(), []);

  if (keysState.status === "loading" || webhookState.status === "loading" || deliveryState.status === "loading") return <LoadingState rows={5} />;
  if (keysState.status === "error") return <ErrorState title="API keys unavailable" message={keysState.error} onRetry={reloadKeys} />;
  if (webhookState.status === "error") return <ErrorState title="Webhooks unavailable" message={webhookState.error} onRetry={reloadWebhooks} />;
  if (deliveryState.status === "error") return <ErrorState title="Delivery history unavailable" message={deliveryState.error} onRetry={reloadDeliveries} />;
  // An empty list is a normal state here (no keys or webhooks yet), not a reason to render nothing.
  const keys = listData(keysState);
  const webhooks = listData(webhookState);
  const deliveries = listData(deliveryState);
  if (!keys || !webhooks || !deliveries) return null;

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await apiService.revokeKey(revokeTarget.id);
      await reloadKeys();
      setRevokeTarget(null);
      toast.success("API key revoked.");
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
      toast.success("Webhook removed.");
    } catch {
      toast.error("We could not remove that webhook.");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="API & Webhooks" description="Build on ShipBrief with scoped keys and real-time event webhooks." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="sb-panel min-w-0 p-5" aria-labelledby="keys-heading">
          <SectionHeader id="keys-heading" title="API keys" description="Scoped, server-side keys for trusted integrations." action={<Button type="button" size="sm" onClick={() => setKeyDialog(true)}><Plus />Create key</Button>} />
          <div className="mt-3 divide-y divide-border">{keys.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No API keys are active.</p> : keys.map((key) => <ApiKeyRow key={key.id} apiKey={key} onRevoke={() => setRevokeTarget(key)} />)}</div>
        </section>
        <QuickStart prefix={keys[0]?.prefix ?? "sb_live_"} />
      </div>
      <section className="space-y-4" aria-labelledby="webhooks-heading"><SectionHeader id="webhooks-heading" title="Webhooks" description="Send selected workspace events to a trusted endpoint." action={<Button type="button" size="sm" onClick={() => setWebhookDialog(true)}><Plus />Add webhook</Button>} /><div className="grid gap-3 lg:grid-cols-2">{webhooks.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No webhook endpoints are active.</p> : webhooks.map((webhook) => <WebhookRow key={webhook.id} webhook={webhook} onRemoved={() => setRemoveTarget(webhook)} onReload={async () => { await Promise.all([reloadWebhooks(), reloadDeliveries()]); }} />)}</div></section>
      <section className="sb-panel p-5"><SectionHeader title="Delivery history" description="Recent endpoint attempts and response codes." /><div className="mt-4 divide-y divide-border">{deliveries.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Delivery history will appear when webhooks send events.</p> : deliveries.map((delivery) => <DeliveryRow key={delivery.id} delivery={delivery} onRetried={reloadDeliveries} />)}</div></section>
      <CreateKeyDialog open={keyDialog} onOpenChange={setKeyDialog} onCreated={async (name) => { try { const created = await apiService.createKey(name); await reloadKeys(); setRevealed({ title: `${created.name} key created`, description: "Copy this key now and store it in your server's secrets. For your security it won't be shown again.", secret: created.secret }); } catch (error) { toast.error(error instanceof Error ? error.message : "We could not create that API key."); } }} />
      <CreateWebhookDialog open={webhookDialog} onOpenChange={setWebhookDialog} onCreated={async (input) => { try { const created = await apiService.createWebhook(input); await reloadWebhooks(); setRevealed({ title: "Webhook signing secret", description: "Use this secret to verify the ShipBrief-Signature header on each delivery (HMAC-SHA256 of `timestamp.body`). It won't be shown again.", secret: created.secret }); } catch (error) { toast.error(error instanceof Error ? error.message : "We could not add that webhook."); } }} />
      {revealed && <SecretDialog {...revealed} onClose={() => setRevealed(null)} />}
      {revokeTarget && <ConfirmationDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)} title={"Revoke " + revokeTarget.name + "?"} description="Any integration using this key will stop working immediately." action="Revoke key" destructive onConfirm={revoke} />}
      {removeTarget && <ConfirmationDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)} title="Remove webhook?" description="The endpoint will stop receiving events and its delivery history will be removed." action="Remove webhook" destructive onConfirm={removeWebhook} />}
    </div>
  );
}

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: () => void }) {
  const copy = async () => { try { await navigator.clipboard.writeText(apiKey.prefix); toast.success("Key prefix copied. The full key is only shown once, when it is created."); } catch { toast.error("Copy failed. The key remains masked for safety."); } };
  return <article className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-medium">{apiKey.name}</h3><p className="mt-1.5 inline-flex rounded-md bg-surface-subtle px-2 py-1 font-mono text-[13px]">{apiKey.prefix}••••••••••••</p><p className="mt-1 text-xs text-muted-foreground">Created {format(new Date(apiKey.createdAt), "MMM d, yyyy")}{apiKey.lastUsed ? " · last used " + format(new Date(apiKey.lastUsed), "MMM d") : ""}</p></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void copy()}><Copy />Copy</Button><Button type="button" variant="destructive" size="sm" onClick={onRevoke}>Revoke</Button></div></article>;
}

function WebhookRow({ webhook, onRemoved, onReload }: { webhook: Webhook; onRemoved: () => void; onReload: () => Promise<void> }) {
  const [url, setUrl] = useState(webhook.url);
  const [events, setEvents] = useState(webhook.events);
  const [pending, setPending] = useState(false);
  const save = async (status?: Webhook["status"]) => { setPending(true); try { await apiService.updateWebhook(webhook.id, { url, events, status: status ?? webhook.status }); await onReload(); toast.success("Webhook saved."); } catch { toast.error("We could not save this webhook."); } finally { setPending(false); } };
  const toggleEvent = (event: string) => setEvents((current) => current.includes(event) ? current.filter((item) => item !== event) : [...current, event]);
  return <article className="sb-panel p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-3"><IconTile icon={WebhookIcon} size="sm" /><div><h3 className="font-medium">Webhook endpoint</h3><p className="text-xs text-muted-foreground">{webhook.lastDelivery ? "Last delivery " + format(new Date(webhook.lastDelivery), "MMM d, h:mm a") : "No delivery yet"}</p></div></div><StatusBadge status={webhook.status} /></div><div className="mt-4 space-y-3"><div className="space-y-2"><Label htmlFor={"webhook-url-" + webhook.id}>Endpoint URL</Label><Input id={"webhook-url-" + webhook.id} value={url} onChange={(event) => setUrl(event.target.value)} /></div><div><Label>Events</Label><div className="mt-2 flex flex-wrap gap-2">{eventOptions.map((event) => <label key={event} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", events.includes(event) ? "bg-ink text-ink-foreground" : "bg-surface-subtle text-muted-foreground hover:text-foreground")}><input type="checkbox" checked={events.includes(event)} onChange={() => toggleEvent(event)} className="sr-only" />{events.includes(event) && <Check className="size-3" />}{event}</label>)}</div></div></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void save()} disabled={pending || !url.trim() || events.length === 0}>{pending && <Loader2 className="animate-spin" />}Save endpoint</Button><Button type="button" size="sm" variant="outline" onClick={() => void save(webhook.status === "active" ? "inactive" : "active")} disabled={pending}>{webhook.status === "active" ? "Pause" : "Activate"}</Button><Button type="button" size="sm" variant="ghost" onClick={onRemoved}><Trash2 />Remove</Button></div></article>;
}

function DeliveryRow({ delivery, onRetried }: { delivery: WebhookDelivery; onRetried: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const retry = async () => { setPending(true); try { await apiService.retryDelivery(delivery.id); await onRetried(); toast.success("Retry queued. The result will appear in the delivery history."); } catch { toast.error("We could not retry this delivery."); } finally { setPending(false); } };
  return <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className={cn("sb-numeric rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", delivery.responseCode < 300 ? "bg-surface-subtle text-foreground/80" : "bg-surface-subtle text-danger")}>{delivery.responseCode}</span><div><p className="font-mono text-[13px] font-medium">{delivery.event}</p><p className="text-xs text-muted-foreground">{format(new Date(delivery.deliveredAt), "MMM d, h:mm a")}</p></div></div><div className="flex items-center gap-2"><StatusBadge status={delivery.status} />{delivery.status === "failed" && <Button type="button" size="sm" variant="outline" onClick={() => void retry()} disabled={pending}>{pending && <Loader2 className="animate-spin" />}Retry</Button>}</div></div>;
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const create = async () => { if (!name.trim() || pending) return; setPending(true); try { await onCreated(name.trim()); setName(""); onOpenChange(false); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Create API key</DialogTitle><DialogDescription>Give the key a recognizable server-side use. The full key is shown once, right after it is created.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="api-key-name">Key name</Label><Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Production sync" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void create()} disabled={!name.trim() || pending}>{pending && <Loader2 className="animate-spin" />}Create key</Button></DialogFooter></DialogContent></Dialog>;
}

function CreateWebhookDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (input: Pick<Webhook, "url" | "events">) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["release.published"]);
  const [pending, setPending] = useState(false);
  const toggle = (event: string) => setEvents((current) => current.includes(event) ? current.filter((item) => item !== event) : [...current, event]);
  const create = async () => { if (!url.trim() || events.length === 0 || pending) return; setPending(true); try { await onCreated({ url: url.trim(), events }); setUrl(""); setEvents(["release.published"]); onOpenChange(false); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add webhook</DialogTitle><DialogDescription>ShipBrief signs every delivery and retries failed ones with backoff. The endpoint must be publicly reachable over HTTPS.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="new-webhook-url">Endpoint URL</Label><Input id="new-webhook-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com/hooks/shipbrief" /></div><div><Label>Events</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{eventOptions.map((event) => <label key={event} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={events.includes(event)} onChange={() => toggle(event)} className="size-3.5 accent-primary" />{event}</label>)}</div></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void create()} disabled={!url.trim() || events.length === 0 || pending}>{pending && <Loader2 className="animate-spin" />}Add webhook</Button></DialogFooter></DialogContent></Dialog>;
}

function SecretDialog({ title, description, secret, onClose }: { title: string; description: string; secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(secret); setCopied(true); } catch { toast.error("Copy failed. Select the text and copy it manually."); } };
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle p-3"><code className="min-w-0 flex-1 break-all font-mono text-[13px]">{secret}</code><Button type="button" size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button></div><DialogFooter><Button type="button" onClick={onClose}>I&apos;ve stored it</Button></DialogFooter></DialogContent></Dialog>;
}

function ConfirmationDialog({ open, onOpenChange, title, description, action, destructive, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; action: string; destructive?: boolean; onConfirm: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const confirm = async () => { setPending(true); try { await onConfirm(); } finally { setPending(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant={destructive ? "destructive" : "default"} onClick={() => void confirm()} disabled={pending}>{pending && <Loader2 className="animate-spin" />}{action}</Button></DialogFooter></DialogContent></Dialog>;
}

/** Dark snippet panel, matching the widget install page: the fastest way to see the API work. */
function QuickStart({ prefix }: { prefix: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const snippet = `curl ${origin}/api/v1/releases \\
  -H "Authorization: Bearer ${prefix}••••"`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Request copied.");
    } catch {
      toast.error("Copy isn't available in this browser.");
    }
  };
  return (
    <section aria-labelledby="quickstart-heading" className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-xl)] sb-feature">
      <div className="flex items-center justify-between gap-3 border-b border-ink-foreground/10 px-5 py-3.5">
        <h2 id="quickstart-heading" className="sb-title-card text-ink-foreground">Quick start</h2>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-ink-foreground/10 px-2 py-0.5 font-mono text-[11px] text-ink-foreground/80">GET /v1/releases</span>
          <button type="button" onClick={() => void copy()} aria-label="Copy request" className="inline-flex items-center gap-1 rounded-md bg-ink-foreground/10 px-2 py-1 text-xs text-ink-foreground/80 transition-colors hover:bg-ink-foreground/20 hover:text-ink-foreground">
            <Copy className="size-3" />Copy
          </button>
        </span>
      </div>
      <div className="flex-1 px-5 py-4">
        <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed whitespace-pre text-ink-foreground/85"><span className="text-primary-strong">curl</span>{snippet.slice(4)}</pre>
      </div>
      <p className="flex items-start gap-2 border-t border-ink-foreground/10 px-5 py-3.5 text-xs leading-relaxed text-ink-foreground/65">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink-foreground/50" />
        Keys stay masked after creation. Use them only from your servers, never in browser code.
      </p>
    </section>
  );
}
