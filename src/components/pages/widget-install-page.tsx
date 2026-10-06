"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  MousePointer2,
  Palette,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/components/session/session-provider";
import { useAsyncData } from "@/hooks/use-async-data";
import { brandingService } from "@/lib/services";
import {
  type WidgetInstallSettings,
  type WidgetPlacement,
  widgetSettingsService,
} from "@/lib/services/widget-settings-service";
import { cn } from "@/lib/utils";

type CodeTab = "script" | "react";
type ServerTab = "node" | "python" | "php" | "ruby";

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
      toast.success("Widget installation settings saved.");
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
        description="Configure the in-app update launcher, then add a single snippet to your product."
        actions={<Button type="button" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Settings2 />}{saving ? "Saving..." : "Save configuration"}</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.78fr)]">
        <main className="space-y-6">
          <section className="sb-panel p-4 sm:p-5">
            <div className="flex items-start gap-3"><Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><h2 className="sb-title-section">Choose how updates open</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Use ShipBrief&apos;s default launcher or open the feed from a control you already own.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ModeCard active={settings.launcherMode === "default"} onSelect={() => update("launcherMode", "default")} icon={<Bell className="size-4" />} title="Default launcher" description="A compact What&apos;s New control appears in your product." />
              <ModeCard active={settings.launcherMode === "manual"} onSelect={() => update("launcherMode", "manual")} icon={<MousePointer2 className="size-4" />} title="Manual trigger" description="Open, close, or toggle the feed from your own navigation." />
            </div>
          </section>

          <section className="sb-panel p-4 sm:p-5">
            <div className="flex items-start gap-3"><Palette className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><h2 className="sb-title-section">Match your product surface</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">These settings change the snippet and live preview. Saved branding supplies the accent color.</p></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="widget-placement">Launcher position</Label><Select value={settings.placement} onValueChange={(value) => value && update("placement", value as WidgetPlacement)}><SelectTrigger id="widget-placement" className="w-full"><SelectValue>{(value) => value === "bottom-left" ? "Bottom left" : "Bottom right"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="bottom-right">Bottom right</SelectItem><SelectItem value="bottom-left">Bottom left</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="widget-install-theme">Widget theme</Label><Select value={settings.theme} onValueChange={(value) => value && update("theme", value as WidgetInstallSettings["theme"])}><SelectTrigger id="widget-install-theme" className="w-full"><SelectValue>{(value) => value === "inherit" ? "Inherit product theme" : String(value)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="inherit">Inherit product theme</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-subtle/45 px-3 py-2.5 text-sm"><input type="checkbox" checked={settings.showUnreadBadge} onChange={(event) => update("showUnreadBadge", event.target.checked)} className="size-4 accent-primary" /><span><span className="block font-medium">Unread badge</span><span className="block text-xs text-muted-foreground">Show new update count</span></span></label>
            </div>
          </section>

          <section className="sb-panel p-4 sm:p-5">
            <div className="flex items-start gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><h2 className="sb-title-section">Email updates</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Signed-in users you identify are added to Contacts automatically and get a switch to turn release emails off. Visitors who aren&apos;t signed in can subscribe with their email.</p></div></div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-subtle/45 px-3 py-2.5 text-sm"><input type="checkbox" checked={settings.emailSubscribe} onChange={(event) => update("emailSubscribe", event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="block font-medium">Show email updates in the widget</span><span className="block text-xs text-muted-foreground">The &quot;Email me new updates&quot; switch for signed-in users, and &quot;Get updates by email&quot; with a confirmation email for everyone else.</span></span></label>
          </section>

          <section className="sb-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="sb-title-section">1. Add the snippet to your product</h2><p className="mt-1 text-sm text-muted-foreground">Paste it once, on every page where signed-in users should see updates. Project ID <span className="font-mono text-foreground">{settings.projectId}</span></p></div><div className="flex gap-1 rounded-lg bg-surface-subtle p-1"><TabButton active={codeTab === "script"} onClick={() => setCodeTab("script")}>HTML</TabButton><TabButton active={codeTab === "react"} onClick={() => setCodeTab("react")}>React</TabButton></div></div>
            {codeTab === "script" ? <CodePanel name="HTML snippet" code={scriptSnippet} copied={copied === "HTML snippet"} onCopy={() => void copy("HTML snippet", scriptSnippet)} /> : <CodePanel name="React snippet" code={reactSnippet} copied={copied === "React snippet"} onCopy={() => void copy("React snippet", reactSnippet)} />}
            <div className="border-t border-border bg-accent/40 px-4 py-4 sm:px-5">
              <p className="text-sm font-medium">{settings.launcherMode === "manual" ? "Open the feed from your own control" : "Optional: open the feed from your own control"}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add <code className="rounded bg-accent px-1 py-0.5 text-primary-strong">data-shipbrief-toggle</code> to any button, and <code className="rounded bg-accent px-1 py-0.5 text-primary-strong">data-shipbrief-badge</code> to an element that should show the unread count. Or call the commands below.</p>
              <div className="mt-3 flex flex-wrap gap-2"><CodePill value="ShipBrief.open()" onCopy={() => void copy("Open command", "ShipBrief.open()")}>Open</CodePill><CodePill value="ShipBrief.close()" onCopy={() => void copy("Close command", "ShipBrief.close()")}>Close</CodePill><CodePill value="ShipBrief.toggle()" onCopy={() => void copy("Toggle command", "ShipBrief.toggle()")}>Toggle</CodePill><CodePill value="ShipBrief.logout()" onCopy={() => void copy("Logout command", "ShipBrief.logout()")}>Log out</CodePill><CodePill value={'ShipBrief.on("unread", (count) => {})'} onCopy={() => void copy("Unread listener", 'ShipBrief.on("unread", (count) => {})')}>Unread count</CodePill></div>
            </div>
          </section>

          <IdentitySection copy={copy} copied={copied} />

          <section className="sb-panel p-4 sm:p-5">
            <div className="flex items-start gap-3"><Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><h2 className="sb-title-section">Where release emails go</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">When you publish a release with the Email channel, ShipBrief sends it to everyone in <a href="/app/contacts" className="font-medium text-primary-strong hover:underline">Contacts</a> who has an email, hasn&apos;t unsubscribed, and matches the release&apos;s audience. People get into Contacts like this:</p></div></div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-strong" /><span><span className="font-medium text-foreground">Widget sign-in</span>: every identified user, automatically, with their plan and tags kept up to date.</span></li>
              <li className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-strong" /><span><span className="font-medium text-foreground">Widget and changelog subscribe forms</span>: after they confirm their email.</span></li>
              <li className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-strong" /><span><span className="font-medium text-foreground">Your server</span>: <code className="text-xs">POST /api/v1/contacts</code> with an API key. Also CSV import and adding people by hand.</span></li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Every email has an unsubscribe link. Someone who unsubscribes is never emailed again, even if your app identifies them later.</p>
          </section>
        </main>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <section className="sb-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-sm font-semibold">Live product preview</p><p className="text-[11px] text-muted-foreground">{settings.launcherMode === "manual" ? "Manual trigger mode" : "Default launcher mode"}</p></div><button type="button" onClick={() => setPreviewRevision((current) => current + 1)} className="text-xs font-medium text-primary-strong hover:underline">Reset preview</button></div>
            <div className="relative min-h-[33rem] overflow-hidden bg-[#171718] p-4">
              <div className="mx-auto max-w-sm border border-white/10 bg-[#202022] p-3 text-white"><div className="flex items-center justify-between"><span className="text-[10px] text-white/65">Acme workspace</span><span className="size-5 rounded-full bg-[#c7f238]" /></div><p className="mt-8 text-lg font-medium tracking-tight">Welcome back, Avery.</p><div className="mt-4 h-16 border border-white/10 bg-white/5" /></div>
              {settings.launcherMode === "default" && <span className={cn("absolute bottom-4 inline-flex h-9 items-center gap-2 bg-[#c7f238] px-3 text-xs font-medium text-[#171717]", settings.placement === "bottom-left" ? "left-4" : "right-4")}><Bell className="size-3.5" />What&apos;s new{settings.showUnreadBadge && <span className="flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-[#b9e422]">3</span>}</span>}
              <div className="absolute inset-x-4 top-20 flex justify-center"><WhatsNewWidget key={previewRevision} theme={settings.theme} accentColor={accentColor} /></div>
            </div>
          </section>
          <section className="sb-panel p-4"><p className="text-sm font-semibold">After you install</p><ol className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground"><li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">1</span><span>Sign in to your product: you appear in Contacts with source &quot;Widget&quot;.</span></li><li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">2</span><span>Publish a release with the In-app channel. It shows in the feed with an unread badge.</span></li><li className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">3</span><span>Add the Email channel too, and identified users get it in their inbox.</span></li></ol><a href={`/embed/whats-new?key=${encodeURIComponent(settings.projectId)}`} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary-strong hover:underline">Open standalone preview <ExternalLink className="size-3" /></a></section>
        </aside>
      </div>
    </div>
  );
}

function ModeCard({ active, onSelect, icon, title, description }: { active: boolean; onSelect: () => void; icon: React.ReactNode; title: string; description: string }) {
  return <button type="button" aria-pressed={active} onClick={onSelect} className={cn("flex min-h-28 items-start gap-3 rounded-[var(--radius-lg)] border p-3.5 text-left transition-colors", active ? "border-foreground/40 bg-surface" : "border-border bg-background hover:bg-surface-subtle/60")}><span className={cn("mt-0.5 flex shrink-0 [&_svg]:size-4", active ? "text-primary-strong" : "text-muted-foreground")}>{icon}</span><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>{active && <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary-strong"><Check className="size-3" />Selected</span>}</span></button>;
}

function CodePanel({ name, code, copied, onCopy }: { name: string; code: string; copied: boolean; onCopy: () => void }) {
  return <div className="relative bg-[#171718] p-4 sm:p-5"><Button type="button" variant="outline" size="sm" aria-label={`Copy ${name}`} className="absolute top-3 right-3 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={onCopy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button><pre className="overflow-x-auto pr-16 font-mono text-[11px] leading-5 text-[#e7e7e8]"><code>{code}</code></pre></div>;
}

function CodePill({ value, children, onCopy }: { value: string; children: string; onCopy: () => void }) {
  return <button type="button" onClick={onCopy} title={value} className="border border-border-strong bg-card px-2.5 py-1.5 text-[11px] font-medium text-primary-strong transition-colors hover:bg-surface-subtle">{children}</button>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", active ? "bg-card text-foreground " : "text-muted-foreground hover:text-foreground")}>{children}</button>;
}

/**
 * The identity secret lets the customer's server vouch for who is signed in.
 * Shown only to roles that manage developer settings; the API enforces the same.
 */
function IdentitySection({ copy, copied }: { copy: (name: string, value: string) => Promise<void>; copied: string | null }) {
  const { can } = useSession();
  const allowed = can("developer:manage");
  const [secret, setSecret] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverTab, setServerTab] = useState<ServerTab>("node");

  const reveal = async () => {
    if (secret) return setVisible((current) => !current);
    setBusy(true);
    try {
      setSecret((await widgetSettingsService.identitySecret()).secret);
      setVisible(true);
    } catch {
      toast.error("We couldn't load the identity secret.");
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm("Rotate the identity secret? Signed-in users stop being identified until your server uses the new secret.")) return;
    setBusy(true);
    try {
      setSecret((await widgetSettingsService.rotateIdentitySecret()).secret);
      setVisible(true);
      toast.success("New identity secret created. Update it on your server.");
    } catch {
      toast.error("We couldn't rotate the identity secret.");
    } finally {
      setBusy(false);
    }
  };

  const serverCode = getServerSnippet(serverTab);
  const masked = secret && visible ? secret : "sbis_" + "•".repeat(28);

  return (
    <section className="sb-panel overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3"><KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><h2 className="sb-title-section">2. Identify signed-in users</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Your server signs the user&apos;s id with this secret and passes the result as <code className="text-xs">userHash</code>. ShipBrief only accepts users with a valid signature, so nobody can add someone else&apos;s email from the browser. Keep the secret on your server, never in front-end code.</p></div></div>
        {allowed ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-subtle/60 px-3 py-2 font-mono text-xs">{masked}</code>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void reveal()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : visible ? <EyeOff /> : <Eye />}{visible ? "Hide" : "Reveal"}</Button>
              <Button type="button" variant="outline" size="sm" disabled={!secret || !visible} onClick={() => secret && void copy("Identity secret", secret)}>{copied === "Identity secret" ? <Check /> : <Copy />}Copy</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => void rotate()} disabled={busy}><RefreshCw />Rotate</Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">Ask a developer or an admin of this workspace for the identity secret.</p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 sm:px-5"><p className="text-xs font-medium text-muted-foreground">Compute userHash on your server</p><div className="flex gap-1 rounded-lg bg-surface-subtle p-1">{(["node", "python", "php", "ruby"] as const).map((tab) => <TabButton key={tab} active={serverTab === tab} onClick={() => setServerTab(tab)}>{SERVER_LABELS[tab]}</TabButton>)}</div></div>
      <CodePanel name="Server code" code={serverCode} copied={copied === "Server code"} onCopy={() => void copy("Server code", serverCode)} />
    </section>
  );
}

const SERVER_LABELS: Record<ServerTab, string> = { node: "Node.js", python: "Python", php: "PHP", ruby: "Ruby" };

function getServerSnippet(tab: ServerTab) {
  switch (tab) {
    case "node":
      return `import crypto from "node:crypto";

// SHIPBRIEF_IDENTITY_SECRET is the secret above, stored as a server environment variable.
const userHash = crypto
  .createHmac("sha256", process.env.SHIPBRIEF_IDENTITY_SECRET)
  .update(String(user.id))
  .digest("hex");`;
    case "python":
      return `import hashlib, hmac, os

user_hash = hmac.new(
    os.environ["SHIPBRIEF_IDENTITY_SECRET"].encode(),
    str(user.id).encode(),
    hashlib.sha256,
).hexdigest()`;
    case "php":
      return `$userHash = hash_hmac('sha256', (string) $user->id, getenv('SHIPBRIEF_IDENTITY_SECRET'));`;
    case "ruby":
      return `user_hash = OpenSSL::HMAC.hexdigest("SHA256", ENV.fetch("SHIPBRIEF_IDENTITY_SECRET"), user.id.to_s)`;
  }
}

function appOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** The loader script: a queue stub so commands work before it finishes loading, then the async script. */
function getScriptSnippet(settings: WidgetInstallSettings) {
  return `<script>
  (function (w) { w.ShipBrief = w.ShipBrief || function () { (w.ShipBrief.q = w.ShipBrief.q || []).push(arguments); }; })(window);
  ShipBrief("init", {
    key: "${settings.projectId}",
    // The signed-in user, rendered by your server. Leave "user" out for visitors who aren't signed in.
    user: {
      id: "{{ user.id }}",
      email: "{{ user.email }}",
      name: "{{ user.name }}",
      plan: "{{ user.plan }}",      // optional, used by audiences
      tags: ["{{ user.tag }}"],     // optional, used by audiences
    },
    userHash: "{{ userHash }}",     // HMAC-SHA256(identity secret, user.id), see step 2
  });
</script>
<script async src="${appOrigin()}/widget.js"></script>`;
}

function getReactSnippet(settings: WidgetInstallSettings) {
  return `"use client";
import { useEffect } from "react";

type ShipBriefUser = { id: string; email?: string; name?: string; plan?: string; tags?: string[] };

declare global {
  interface Window { ShipBrief?: ((...args: unknown[]) => void) & { q?: unknown[][] } }
}

/** Render once in your signed-in layout. userHash comes from your server (see step 2). */
export function ShipBriefWidget({ user, userHash }: { user?: ShipBriefUser; userHash?: string }) {
  useEffect(() => {
    if (!window.ShipBrief) {
      const queue: unknown[][] = [];
      const shipBrief = Object.assign((...args: unknown[]) => { queue.push(args); }, { q: queue });
      window.ShipBrief = shipBrief;
      shipBrief("init", { key: "${settings.projectId}" });
      const script = document.createElement("script");
      script.async = true;
      script.src = "${appOrigin()}/widget.js";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (user && userHash) window.ShipBrief?.("identify", user, userHash);
    else window.ShipBrief?.("logout");
  }, [user, userHash]);

  return null;
}`;
}
