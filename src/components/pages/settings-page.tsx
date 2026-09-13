"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Download, Globe2, KeyRound, Laptop, Loader2, Save, ShieldCheck, Trash2, Users, Webhook, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/use-async-data";
import { settingsService } from "@/lib/services";
import type { WorkspaceSettings } from "@/types";

export function SettingsPage() {
  const { state, reload } = useAsyncData(() => settingsService.get(), []);
  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;
  return <SettingsEditor settings={state.data} onReload={reload} />;
}

function SettingsEditor({ settings, onReload }: { settings: WorkspaceSettings; onReload: () => Promise<void> }) {
  const [name, setName] = useState(settings.name);
  const [slug, setSlug] = useState(settings.slug);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [brandVoice, setBrandVoice] = useState(settings.brandVoice);
  const [notifications, setNotifications] = useState(settings.notifications);
  const [saving, setSaving] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = async (section: string, input: Partial<WorkspaceSettings>) => {
    setSaving(section);
    try {
      await settingsService.update(input);
      await onReload();
      toast.success(section + " settings saved (mock).");
    } catch {
      toast.error("We could not save these settings.");
    } finally {
      setSaving("");
    }
  };

  const exportData = async () => {
    try {
      const result = await settingsService.exportData();
      toast.success(result.filename + " prepared (mock export).");
    } catch {
      toast.error("We could not prepare a data export.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace preferences, safety controls, and data boundaries." />
      <Tabs defaultValue="general">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI & Brand Voice</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-5"><section className="sb-panel max-w-xl space-y-4 p-4 sm:p-5"><div><h2 className="text-base font-semibold">Workspace profile</h2><p className="text-sm text-muted-foreground">These fields appear across your internal workspace and public-facing configuration.</p></div><div className="space-y-2"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="workspace-slug">Workspace slug</Label><Input id="workspace-slug" value={slug} onChange={(event) => setSlug(event.target.value)} /><p className="text-xs text-muted-foreground">Used by the local public changelog path.</p></div><div className="space-y-2"><Label htmlFor="workspace-timezone">Timezone</Label><Input id="workspace-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} /></div><Button type="button" onClick={() => void save("General", { name, slug, timezone })} disabled={saving === "General"}>{saving === "General" ? <Loader2 className="animate-spin" /> : <Save />}Save changes</Button></section></TabsContent>
        <TabsContent value="ai" className="mt-5"><section className="sb-panel max-w-xl space-y-4 p-4 sm:p-5"><div><h2 className="text-base font-semibold">AI & brand voice</h2><p className="text-sm text-muted-foreground">This context guides suggestions without replacing a human decision.</p></div><div className="space-y-2"><Label htmlFor="brand-voice">Brand voice</Label><Textarea id="brand-voice" value={brandVoice} onChange={(event) => setBrandVoice(event.target.value)} rows={6} /></div><Button type="button" onClick={() => void save("Brand voice", { brandVoice })} disabled={saving === "Brand voice"}>{saving === "Brand voice" ? <Loader2 className="animate-spin" /> : <Save />}Save brand voice</Button></section></TabsContent>
        <TabsContent value="team" className="mt-5"><SettingsDestination icon={Users} title="Team collaboration" description="Invite teammates, manage roles, and review the approval history for release communication." href="/app/team" action="Manage team" /></TabsContent>
        <TabsContent value="notifications" className="mt-5"><section className="sb-panel max-w-xl space-y-4 p-4 sm:p-5"><div><h2 className="text-base font-semibold">Notification preferences</h2><p className="text-sm text-muted-foreground">Choose the events that deserve attention. Delivery channels connect later.</p></div><div className="divide-y divide-border">{Object.entries(notifications).map(([key, enabled]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4 py-3 text-sm"><span><span className="block font-medium">{key.replace(/([A-Z])/g, " $1")}</span><span className="block text-xs text-muted-foreground">Show this event in your workspace notification center.</span></span><input type="checkbox" checked={Boolean(enabled)} onChange={(event) => setNotifications((current) => ({ ...current, [key]: event.target.checked }))} className="size-4 accent-primary" /></label>)}</div><Button type="button" onClick={() => void save("Notifications", { notifications })} disabled={saving === "Notifications"}>{saving === "Notifications" ? <Loader2 className="animate-spin" /> : <Save />}Save preferences</Button></section></TabsContent>
        <TabsContent value="domains" className="mt-5"><SettingsDestination icon={Globe2} title="Domains & public appearance" description="Configure the hosted changelog address, logo, accent color, and widget theme from one dedicated branding surface." href="/app/branding" action="Open branding" /></TabsContent>
        <TabsContent value="billing" className="mt-5"><SettingsDestination icon={CreditCard} title="Plan & billing" description="Review plan limits, usage, invoices, and the payment-method placeholder. Payments remain outside this frontend phase." href="/app/billing" action="Manage billing" /></TabsContent>
        <TabsContent value="api" className="mt-5"><SettingsDestination icon={Webhook} title="API & webhooks" description="Create or revoke masked API keys, configure webhook events, and inspect mock delivery history." href="/app/api" action="Manage API" /></TabsContent>
        <TabsContent value="security" className="mt-5"><div className="grid gap-5 xl:grid-cols-2"><section className="sb-panel p-4 sm:p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /><div><h2 className="text-base font-semibold">Sessions & security</h2><p className="text-xs text-muted-foreground">Authentication enforcement is a backend boundary.</p></div></div><div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-lg border border-border p-3"><div className="flex items-center gap-3"><Laptop className="size-4 text-muted-foreground" /><div><p className="text-sm font-medium">Current session</p><p className="text-xs text-muted-foreground">Windows · Kigali · active now</p></div></div><span className="text-xs font-medium text-success">Current</span></div><div className="flex items-center justify-between rounded-lg border border-border p-3"><div className="flex items-center gap-3"><Laptop className="size-4 text-muted-foreground" /><div><p className="text-sm font-medium">Previous session</p><p className="text-xs text-muted-foreground">Chrome · 2 days ago</p></div></div><Button type="button" variant="ghost" size="sm" onClick={() => toast.message("Session revocation requires the authentication backend.")}>Revoke</Button></div></div><Button type="button" variant="outline" className="mt-4" onClick={() => toast.message("Password and SSO controls connect to the identity provider later.")}>Manage sign-in</Button></section>
        <section className="sb-panel p-4 sm:p-5"><div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Data & API</h2><p className="text-xs text-muted-foreground">Export workspace data or manage server-side credentials.</p></div></div><div className="mt-5 space-y-3"><Button type="button" variant="outline" className="w-full justify-start" onClick={() => void exportData()}><Download />Export workspace data</Button><Link href="/app/api" className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"><KeyRound className="size-4" />Manage API keys and webhooks</Link></div></section></div></TabsContent>
        <TabsContent value="danger" className="mt-5"><section className="max-w-xl rounded-xl border border-destructive/30 bg-danger-muted/20 p-4 sm:p-5"><div className="flex items-start gap-3"><Trash2 className="mt-0.5 size-4 text-destructive" /><div><h2 className="font-semibold text-destructive">Delete workspace</h2><p className="mt-1 text-sm text-muted-foreground">This action needs a backend confirmation and data-retention process. The frontend only simulates the request.</p><Button type="button" variant="destructive" className="mt-4" onClick={() => setDeleteOpen(true)}>Delete workspace</Button></div></div></section></TabsContent>
      </Tabs>
      <DeleteWorkspaceDialog open={deleteOpen} workspaceName={settings.name} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function SettingsDestination({ icon: Icon, title, description, href, action }: { icon: LucideIcon; title: string; description: string; href: string; action: string }) {
  return <section className="sb-panel max-w-xl p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p><Link href={href} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted">{action}<ArrowUpRight className="size-3.5" /></Link></div></div></section>;
}

function DeleteWorkspaceDialog({ open, workspaceName, onOpenChange }: { open: boolean; workspaceName: string; onOpenChange: (open: boolean) => void }) {
  const [confirmation, setConfirmation] = useState("");
  const submit = () => { if (confirmation !== workspaceName) return; toast.success("Workspace deletion request recorded (mock). No data was removed."); setConfirmation(""); onOpenChange(false); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Delete {workspaceName}?</DialogTitle><DialogDescription>Type the workspace name to acknowledge this destructive backend request. No local or remote data will be removed in this frontend phase.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="delete-workspace-confirmation">Workspace name</Label><Input id="delete-workspace-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={workspaceName} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant="destructive" onClick={submit} disabled={confirmation !== workspaceName}>Request deletion</Button></DialogFooter></DialogContent></Dialog>;
}
