"use client";

import { useState } from "react";
import { Loader2, Palette, Save, Upload, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { ShipBriefLogo } from "@/components/brand";
import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { brandingService } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { WorkspaceBranding } from "@/types";

export function BrandingPage() {
  const { state, reload } = useAsyncData(() => brandingService.get(), []);
  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;
  return <BrandingEditor branding={state.data} onReload={reload} />;
}

function BrandingEditor({ branding, onReload }: { branding: WorkspaceBranding; onReload: () => Promise<void> }) {
  const [accentColor, setAccentColor] = useState(branding.accentColor);
  const [domain, setDomain] = useState(branding.domain);
  const [publicTheme, setPublicTheme] = useState(branding.publicTheme);
  const [widgetTheme, setWidgetTheme] = useState(branding.widgetTheme);
  const [logoName, setLogoName] = useState(branding.logoUrl ? "Workspace logo" : "");
  const [faviconName, setFaviconName] = useState(branding.faviconUrl ? "Workspace favicon" : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await brandingService.update({ accentColor, domain, publicTheme, widgetTheme });
      await onReload();
      toast.success("Brand settings saved (mock).");
    } catch {
      toast.error("We could not save the brand settings.");
    } finally {
      setSaving(false);
    }
  };

  const connectDomain = async () => {
    try {
      await brandingService.update({ domain, domainStatus: "pending" });
      await onReload();
      toast.success("Domain verification started (mock).");
    } catch {
      toast.error("We could not start domain verification.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Branding" description="Make public updates, social previews, and in-app discovery feel like your product." actions={<Button type="button" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving..." : "Save changes"}</Button>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
        <main className="space-y-6">
          <section className="sb-panel p-4 sm:p-5"><div className="flex items-center gap-2"><Palette className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Brand assets</h2><p className="text-sm text-muted-foreground">Uploads are held only in this local frontend preview until storage is connected.</p></div></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><AssetControl label="Logo" help="Displayed on public changelog pages." fileName={logoName} onFile={(file) => setLogoName(file)}><ShipBriefLogo /></AssetControl><AssetControl label="Favicon" help="Used for browser tabs and share surfaces." fileName={faviconName} onFile={(file) => setFaviconName(file)}><span className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: accentColor }}><WandSparkles className="size-4 text-white" /></span></AssetControl></div></section>
          <section className="sb-panel p-4 sm:p-5"><h2 className="text-base font-semibold">Color and themes</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="accent-color">Accent color</Label><div className="flex gap-2"><input id="accent-color" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5" /><Input value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="font-mono text-sm" /></div></div><div className="space-y-2"><Label htmlFor="public-theme">Public page theme</Label><Select value={publicTheme} onValueChange={(value) => value && setPublicTheme(value as WorkspaceBranding["publicTheme"])}><SelectTrigger id="public-theme" className="w-full"><SelectValue>{(value) => value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="widget-theme">Widget theme</Label><Select value={widgetTheme} onValueChange={(value) => value && setWidgetTheme(value as WorkspaceBranding["widgetTheme"])}><SelectTrigger id="widget-theme" className="w-full"><SelectValue>{(value) => value === "inherit" ? "Inherit product theme" : value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="inherit">Inherit product theme</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></div></div></section>
          <section className="sb-panel p-4 sm:p-5"><h2 className="text-base font-semibold">Custom domain</h2><p className="mt-1 text-sm text-muted-foreground">Connect a branded address for the public changelog when infrastructure is available.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="updates.acme.com" /><Button type="button" variant="outline" onClick={() => void connectDomain()}>Connect domain</Button></div><div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><span>Verification</span><span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", branding.domainStatus === "connected" ? "bg-success-muted text-success" : "bg-warning-muted text-warning")}>{branding.domainStatus === "connected" ? "Connected" : "Pending verification"}</span></div></section>
        </main>
        <aside className="space-y-5">
          <PreviewCard title="Public changelog preview"><div className="rounded-xl border border-border bg-background p-5"><ShipBriefLogo className="mb-6" /><p className="text-lg font-semibold">What&apos;s New</p><div className="mt-4 rounded-lg border border-border p-3"><span className="text-xs font-medium" style={{ color: accentColor }}>FEATURE</span><p className="mt-1 font-medium">Dark Mode</p><p className="mt-1 text-sm text-muted-foreground">A more comfortable way to use Acme at night.</p></div></div></PreviewCard>
          <PreviewCard title="Live widget preview"><div className="overflow-hidden rounded-xl"><WhatsNewWidget theme={widgetTheme} accentColor={accentColor} /></div></PreviewCard>
          <PreviewCard title="Social preview"><div className="overflow-hidden rounded-xl border border-border"><div className="h-24 p-4" style={{ backgroundColor: accentColor }}><p className="text-xs font-medium text-white/80">ACME · PRODUCT UPDATES</p><p className="mt-1 font-semibold text-white">See what&apos;s new</p></div><div className="bg-surface p-3"><p className="text-sm font-medium">Acme product updates</p><p className="mt-1 text-xs text-muted-foreground">A branded preview image is generated by the backend later.</p></div></div></PreviewCard>
        </aside>
      </div>
    </div>
  );
}

function AssetControl({ label, help, fileName, onFile, children }: { label: string; help: string; fileName: string; onFile: (name: string) => void; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label><div className="flex min-h-24 items-center gap-3 rounded-lg border border-dashed border-border bg-surface-subtle/50 p-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface ring-1 ring-border">{children}</div><div className="min-w-0"><label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm font-medium transition-colors hover:bg-muted"><Upload className="size-3.5" />Upload<input type="file" className="sr-only" accept="image/*" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0].name)} /></label><p className="mt-1 truncate text-xs text-muted-foreground">{fileName || help}</p></div></div></div>;
}

function PreviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><Label>{title}</Label>{children}</section>;
}
