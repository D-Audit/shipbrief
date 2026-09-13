"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  MousePointer2,
  Palette,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { brandingService } from "@/lib/services";
import {
  type WidgetInstallSettings,
  type WidgetPlacement,
  widgetSettingsService,
} from "@/lib/services/widget-settings-service";
import { cn } from "@/lib/utils";

type CodeTab = "script" | "react";

export function WidgetInstallPage() {
  const { state: settingsState, reload: reloadSettings } = useAsyncData(() => widgetSettingsService.get(), []);
  const { state: brandingState, reload: reloadBranding } = useAsyncData(() => brandingService.get(), []);

  if (settingsState.status === "idle" || settingsState.status === "loading" || brandingState.status === "idle" || brandingState.status === "loading") {
    return <LoadingState rows={5} />;
  }
  if (settingsState.status === "error") return <ErrorState title="Widget settings unavailable" message={settingsState.error} onRetry={reloadSettings} />;
  if (brandingState.status === "error") return <ErrorState title="Brand settings unavailable" message={brandingState.error} onRetry={reloadBranding} />;
  if (settingsState.status !== "success" || brandingState.status !== "success") return null;

  return <WidgetInstallEditor initialSettings={settingsState.data} accentColor={brandingState.data.accentColor} onReload={reloadSettings} />;
}

function WidgetInstallEditor({
  initialSettings,
  accentColor,
  onReload,
}: {
  initialSettings: WidgetInstallSettings;
  accentColor: string;
  onReload: () => Promise<void>;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTab>("script");
  const [previewRevision, setPreviewRevision] = useState(0);

  const update = <K extends keyof WidgetInstallSettings>(key: K, value: WidgetInstallSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setPreviewRevision((current) => current + 1);
  };

  const save = async () => {
    setSaving(true);
    try {
      await widgetSettingsService.update(settings);
      await onReload();
      toast.success("Widget installation settings saved (mock).");
    } catch {
      toast.error("We could not save the widget settings.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (name: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(name);
      window.setTimeout(() => setCopied((current) => current === name ? null : current), 1800);
      toast.success(`${name} copied.`);
    } catch {
      toast.error("Copy was unavailable. Select the code block to copy it manually.");
    }
  };

  const scriptSnippet = getScriptSnippet(settings);
  const reactSnippet = getReactSnippet(settings);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Widget install"
        description="Configure the in-app update launcher, then use a single project snippet in your product. Everything here is a local frontend simulation."
        actions={<Button type="button" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Settings2 />}{saving ? "Saving..." : "Save configuration"}</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.78fr)]">
        <main className="space-y-6">
          <section className="sb-panel p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="size-4" /></span><div><h2 className="text-base font-semibold">Choose how updates open</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Use ShipBrief&apos;s default launcher or open the feed from a control you already own.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ModeCard active={settings.launcherMode === "default"} onSelect={() => update("launcherMode", "default")} icon={<Bell className="size-4" />} title="Default launcher" description="A compact What&apos;s New control appears in your product." />
              <ModeCard active={settings.launcherMode === "manual"} onSelect={() => update("launcherMode", "manual")} icon={<MousePointer2 className="size-4" />} title="Manual trigger" description="Open, close, or toggle the feed from your own navigation." />
            </div>
          </section>

          <section className="sb-panel p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Palette className="size-4" /></span><div><h2 className="text-base font-semibold">Match your product surface</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">These local settings change the snippet and live preview. Saved branding still supplies the accent color.</p></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="widget-placement">Launcher position</Label><Select value={settings.placement} onValueChange={(value) => value && update("placement", value as WidgetPlacement)}><SelectTrigger id="widget-placement" className="w-full"><SelectValue>{(value) => value === "bottom-left" ? "Bottom left" : "Bottom right"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="bottom-right">Bottom right</SelectItem><SelectItem value="bottom-left">Bottom left</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="widget-install-theme">Widget theme</Label><Select value={settings.theme} onValueChange={(value) => value && update("theme", value as WidgetInstallSettings["theme"])}><SelectTrigger id="widget-install-theme" className="w-full"><SelectValue>{(value) => value === "inherit" ? "Inherit product theme" : String(value)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="inherit">Inherit product theme</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-subtle/45 px-3 py-2.5 text-sm"><input type="checkbox" checked={settings.showUnreadBadge} onChange={(event) => update("showUnreadBadge", event.target.checked)} className="size-4 accent-primary" /><span><span className="block font-medium">Unread badge</span><span className="block text-xs text-muted-foreground">Show new update count</span></span></label>
            </div>
          </section>

          <section className="sb-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="text-base font-semibold">Install your project snippet</h2><p className="mt-1 text-sm text-muted-foreground">Project ID <span className="font-mono text-foreground">{settings.projectId}</span></p></div><div className="flex gap-1 rounded-lg bg-surface-subtle p-1"><button type="button" onClick={() => setCodeTab("script")} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", codeTab === "script" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Script</button><button type="button" onClick={() => setCodeTab("react")} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", codeTab === "react" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>React</button></div></div>
            {codeTab === "script" ? <CodePanel name="Script snippet" code={scriptSnippet} copied={copied === "Script snippet"} onCopy={() => void copy("Script snippet", scriptSnippet)} /> : <CodePanel name="React snippet" code={reactSnippet} copied={copied === "React snippet"} onCopy={() => void copy("React snippet", reactSnippet)} />}
            {settings.launcherMode === "manual" && <div className="border-t border-border bg-primary/[0.035] px-4 py-4 sm:px-5"><p className="text-sm font-medium">Manual trigger API</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Call <code className="rounded bg-primary/10 px-1 py-0.5 text-primary">open()</code>, <code className="rounded bg-primary/10 px-1 py-0.5 text-primary">close()</code>, or <code className="rounded bg-primary/10 px-1 py-0.5 text-primary">toggle()</code> from your own product control.</p><div className="mt-3 flex flex-wrap gap-2"><CodePill value="window.ShipBrief.open()" onCopy={() => void copy("Open command", "window.ShipBrief.open()")}>Open</CodePill><CodePill value="window.ShipBrief.close()" onCopy={() => void copy("Close command", "window.ShipBrief.close()")}>Close</CodePill><CodePill value="window.ShipBrief.toggle()" onCopy={() => void copy("Toggle command", "window.ShipBrief.toggle()")}>Toggle</CodePill></div></div>}
          </section>

          <section className="flex items-start gap-3 border border-dashed border-border bg-surface-subtle/35 p-4 text-sm text-muted-foreground"><Code2 className="mt-0.5 size-4 shrink-0 text-primary" /><p>The public SDK URL and trigger methods are shown as a realistic integration contract. A future backend will supply the production project token, read state, and delivery metrics.</p></section>
        </main>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <section className="sb-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-sm font-semibold">Live product preview</p><p className="text-[11px] text-muted-foreground">{settings.launcherMode === "manual" ? "Manual trigger mode" : "Default launcher mode"}</p></div><button type="button" onClick={() => setPreviewRevision((current) => current + 1)} className="text-xs font-medium text-primary hover:underline">Reset preview</button></div>
            <div className="relative min-h-[33rem] overflow-hidden bg-[#171718] p-4">
              <div className="mx-auto max-w-sm border border-white/10 bg-[#202022] p-3 text-white"><div className="flex items-center justify-between"><span className="text-[10px] text-white/65">Acme workspace</span><span className="size-5 rounded-full bg-[#e40178]" /></div><p className="mt-8 text-lg font-medium tracking-tight">Welcome back, Avery.</p><div className="mt-4 h-16 border border-white/10 bg-white/5" /></div>
              {settings.launcherMode === "default" && <span className={cn("absolute bottom-4 inline-flex h-9 items-center gap-2 bg-[#e40178] px-3 text-xs font-medium text-white shadow-lg", settings.placement === "bottom-left" ? "left-4" : "right-4")}><Bell className="size-3.5" />What&apos;s new{settings.showUnreadBadge && <span className="flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-[#bd0063]">3</span>}</span>}
              <div className="absolute inset-x-4 top-20 flex justify-center"><WhatsNewWidget key={previewRevision} theme={settings.theme} accentColor={accentColor} /></div>
            </div>
          </section>
          <section className="sb-panel p-4"><p className="text-sm font-semibold">After you install</p><ol className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground"><li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">1</span><span>Publish an in-app release from the workspace.</span></li><li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">2</span><span>Preview the feed in your product before you share it.</span></li><li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">3</span><span>Use analytics and feedback to understand what customers did next.</span></li></ol><a href="/embed/whats-new" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open standalone preview <ExternalLink className="size-3" /></a></section>
        </aside>
      </div>
    </div>
  );
}

function ModeCard({ active, onSelect, icon, title, description }: { active: boolean; onSelect: () => void; icon: React.ReactNode; title: string; description: string }) {
  return <button type="button" aria-pressed={active} onClick={onSelect} className={cn("flex min-h-28 items-start gap-3 border p-3.5 text-left transition-colors", active ? "border-primary/45 bg-primary/[0.045]" : "border-border bg-background hover:bg-surface-subtle/60")}><span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-surface-subtle text-muted-foreground")}>{icon}</span><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>{active && <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary"><Check className="size-3" />Selected</span>}</span></button>;
}

function CodePanel({ name, code, copied, onCopy }: { name: string; code: string; copied: boolean; onCopy: () => void }) {
  return <div className="relative bg-[#171718] p-4 sm:p-5"><Button type="button" variant="outline" size="sm" aria-label={`Copy ${name}`} className="absolute top-3 right-3 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={onCopy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button><pre className="overflow-x-auto pr-16 font-mono text-[11px] leading-5 text-[#e7e7e8]"><code>{code}</code></pre></div>;
}

function CodePill({ value, children, onCopy }: { value: string; children: string; onCopy: () => void }) {
  return <button type="button" onClick={onCopy} title={value} className="border border-primary/20 bg-card px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5">{children}</button>;
}

function getScriptSnippet(settings: WidgetInstallSettings) {
  return `<script src="https://cdn.shipbrief.app/widget.js" async></script>
<script>
  window.ShipBrief = window.ShipBrief || [];
  window.ShipBrief.push(["init", {
    workspace: "${settings.projectId}",
    launcher: "${settings.launcherMode}",
    position: "${settings.placement}",
    unreadBadge: ${settings.showUnreadBadge},
    theme: "${settings.theme}"
  }]);
</script>`;
}

function getReactSnippet(settings: WidgetInstallSettings) {
  const launcher = settings.launcherMode === "manual" ? "false" : "true";
  return `import { ShipBriefWidget } from "@shipbrief/react";

export function ProductShell() {
  return (
    <ShipBriefWidget
      workspace="${settings.projectId}"
      launcher={${launcher}}
      position="${settings.placement}"
      unreadBadge={${settings.showUnreadBadge}}
      theme="${settings.theme}"
    />
  );
}`;
}
