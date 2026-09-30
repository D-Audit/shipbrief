"use client";

import { useSession } from "@/components/session/session-provider";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ImageUp, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { ShipBriefIcon, ShipBriefLogo } from "@/components/brand";
import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsyncData } from "@/hooks/use-async-data";
import { brandingService } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { WorkspaceBranding } from "@/types";

const presets = [
  { name: "Lime", value: "#c7f238" },
  { name: "Ocean", value: "#3d5f8f" },
  { name: "Forest", value: "#1a6e45" },
  { name: "Amber", value: "#b0690f" },
  { name: "Violet", value: "#6a4fc0" },
  { name: "Ink", value: "#171717" },
];

type PreviewTab = "changelog" | "widget" | "social";

/** Relative luminance → pick readable text on the accent, and flag low contrast on white. */
function contrastInfo(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return { valid: false, onAccent: "#ffffff", ratio: 0 };
  const channel = (i: number) => {
    const v = parseInt(clean.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return { valid: true, onAccent: lum > 0.4 ? "#171717" : "#ffffff", ratio: Math.round((1.05 / (lum + 0.05)) * 10) / 10 };
}

export function BrandingPage() {
  const { state, reload } = useAsyncData(() => brandingService.get(), []);
  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;
  return <BrandingEditor branding={state.data} onReload={reload} />;
}

function BrandingEditor({ branding, onReload }: { branding: WorkspaceBranding; onReload: () => Promise<void> }) {
  const { session } = useSession();
  const workspaceName = session.workspace?.name ?? "Your product";
  const [draft, setDraft] = useState(branding);
  const [logoName, setLogoName] = useState(branding.logoUrl ? "Workspace logo" : "");
  const [faviconName, setFaviconName] = useState(branding.faviconUrl ? "Workspace favicon" : "");
  const [preview, setPreview] = useState<PreviewTab>("changelog");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const uploadAsset = async (file: File, purpose: "logo" | "favicon") => {
    try {
      const asset = await brandingService.uploadAsset(file, purpose);
      await brandingService.update(purpose === "logo" ? { logoUrl: asset.url } : { faviconUrl: asset.url });
      if (purpose === "logo") setLogoName(asset.name);
      else setFaviconName(asset.name);
      await onReload();
      toast.success(`${purpose === "logo" ? "Logo" : "Favicon"} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That file couldn't be uploaded.");
    }
  };

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(branding), [draft, branding]);
  const contrast = contrastInfo(draft.accentColor);
  const patch = (input: Partial<WorkspaceBranding>) => setDraft((current) => ({ ...current, ...input }));

  const save = async () => {
    if (!contrast.valid) {
      toast.error("Use a 6-digit hex colour, like #c7f238.");
      return;
    }
    setSaving(true);
    try {
      await brandingService.update({ accentColor: draft.accentColor, domain: draft.domain, publicTheme: draft.publicTheme, widgetTheme: draft.widgetTheme });
      await onReload();
      toast.success("Brand settings saved.");
    } catch {
      toast.error("We couldn't save your brand settings. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async () => {
    if (!draft.domain.trim()) {
      toast.error("Enter a domain first, like updates.acme.com.");
      return;
    }
    setVerifying(true);
    try {
      await brandingService.update({ domain: draft.domain });
      await onReload();
      toast.success("Domain saved. It stays pending until its DNS record is verified.");
    } catch {
      toast.error("We couldn't start domain verification.");
    } finally {
      setVerifying(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Copy isn't available in this browser.");
    }
  };

  const status = branding.domainStatus;

  return (
    <div className="space-y-8 pb-20">
      <PageHeader title="Branding" description="Make your changelog, emails and in-app updates look and feel like your product." />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="assets-heading" className="sb-panel p-5">
            <SectionHeader id="assets-heading" title="Brand assets" description="PNG or SVG. Shown on your public changelog, emails and browser tabs." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AssetDrop wide label="Logo" hint="Wide format, at least 240px" fileName={logoName} onFile={(file) => void uploadAsset(file, "logo")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded asset served by the API */}
                {branding.logoUrl ? <img src={branding.logoUrl} alt="Workspace logo" className="max-h-9 max-w-full object-contain" /> : <ShipBriefLogo iconSize={16} />}
              </AssetDrop>
              <AssetDrop label="Favicon" hint="Square, 64 × 64px" fileName={faviconName} onFile={(file) => void uploadAsset(file, "favicon")}>
                <span className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: contrast.valid ? draft.accentColor : "#c7f238" }}>
                  <ShipBriefIcon size={18} className="brightness-0 invert" />
                </span>
              </AssetDrop>
            </div>
          </section>

          <section aria-labelledby="color-heading" className="sb-panel p-5">
            <SectionHeader id="color-heading" title="Accent colour" description="Used for links, buttons and highlights on every customer-facing surface." />
            <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Preset colours">
              {presets.map((preset) => {
                const active = preset.value.toLowerCase() === draft.accentColor.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={preset.name}
                    onClick={() => patch({ accentColor: preset.value })}
                    className={cn(
                      "flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[13px] ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-surface font-medium ring-foreground/40" : "bg-surface-subtle ring-transparent hover:bg-border"
                    )}
                  >
                    <span className="flex size-6 items-center justify-center rounded-full" style={{ backgroundColor: preset.value }}>
                      {active && <Check className="size-3.5 text-white" strokeWidth={3} />}
                    </span>
                    {preset.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-input bg-surface pr-1 pl-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <input
                  type="color"
                  value={contrast.valid ? draft.accentColor : "#c7f238"}
                  onChange={(event) => patch({ accentColor: event.target.value })}
                  className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  aria-label="Pick a custom colour"
                />
                <input
                  value={draft.accentColor}
                  onChange={(event) => patch({ accentColor: event.target.value.trim() })}
                  spellCheck={false}
                  aria-label="Hex colour"
                  aria-invalid={!contrast.valid}
                  className="w-24 bg-transparent font-mono text-sm outline-none"
                />
              </label>
              {contrast.valid ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", contrast.ratio >= 4.5 ? "bg-success" : "bg-warning")} />
                  {contrast.ratio >= 4.5 ? `Readable on white · ${contrast.ratio}:1` : `Low contrast on white · ${contrast.ratio}:1`}
                </span>
              ) : (
                <span className="text-xs text-destructive">Use a 6-digit hex colour, like #c7f238.</span>
              )}
            </div>
          </section>

          <section aria-labelledby="theme-heading" className="sb-panel p-5">
            <SectionHeader id="theme-heading" title="Themes" description="How your public changelog and in-app widget appear to customers." />
            <div className="mt-5 space-y-5">
              <ThemePicker
                label="Public changelog"
                value={draft.publicTheme}
                options={[
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ]}
                accent={draft.accentColor}
                onChange={(value) => patch({ publicTheme: value as WorkspaceBranding["publicTheme"] })}
              />
              <ThemePicker
                label="In-app widget"
                value={draft.widgetTheme}
                options={[
                  { value: "inherit", label: "Match product", icon: Monitor },
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                ]}
                accent={draft.accentColor}
                onChange={(value) => patch({ widgetTheme: value as WorkspaceBranding["widgetTheme"] })}
              />
            </div>
          </section>

          <section aria-labelledby="domain-heading" className="sb-panel p-5">
            <SectionHeader
              id="domain-heading"
              title="Custom domain"
              description="Serve your changelog from your own address."
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground/80">
                  <span className={cn("size-1.5 rounded-full", status === "connected" ? "bg-success" : status === "pending" ? "bg-warning" : "bg-border-strong")} />
                  {status === "connected" ? "Connected" : status === "pending" ? "Verifying" : "Not connected"}
                </span>
              }
            />
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Input value={draft.domain} onChange={(event) => patch({ domain: event.target.value.trim().toLowerCase() })} placeholder="updates.acme.com" aria-label="Custom domain" className="h-9" />
              <Button type="button" variant="outline" className="h-9" onClick={() => void verifyDomain()} disabled={verifying}>
                {verifying && <Loader2 className="animate-spin" />}
                {status === "none" ? "Connect domain" : "Check again"}
              </Button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg sb-feature">
              <p className="border-b border-ink-foreground/10 px-4 py-2.5 text-xs text-ink-foreground/60">Add this record at your DNS provider</p>
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-3 px-4 py-3 font-mono text-[12.5px]">
                <span className="text-ink-foreground/50">CNAME</span>
                <span className="truncate">{draft.domain.split(".")[0] || "updates"}</span>
                <span className="truncate text-primary-strong">cname.shipbrief.app</span>
                <button type="button" onClick={() => void copy("cname.shipbrief.app")} aria-label="Copy CNAME target" className="rounded-md p-1 text-ink-foreground/60 transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground">
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start" aria-label="Live preview">
          <div className="flex items-center justify-between gap-3">
            <h2 className="sb-title-section">Live preview</h2>
            <div role="tablist" aria-label="Preview surface" className="flex rounded-full bg-surface-subtle p-0.5">
              {(["changelog", "widget", "social"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={preview === tab}
                  onClick={() => setPreview(tab)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors", preview === tab ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-[var(--radius-xl)] bg-surface-subtle p-3">
            {preview === "changelog" && <ChangelogMock name={workspaceName} accent={contrast.valid ? draft.accentColor : "#c7f238"} dark={draft.publicTheme === "dark"} domain={draft.domain} />}
            {preview === "widget" && (
              <div className="overflow-hidden rounded-xl">
                <WhatsNewWidget theme={draft.widgetTheme} accentColor={contrast.valid ? draft.accentColor : undefined} />
              </div>
            )}
            {preview === "social" && <SocialMock name={workspaceName} accent={contrast.valid ? draft.accentColor : "#c7f238"} onAccent={contrast.onAccent} domain={draft.domain} />}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Previews update as you edit. Customers see changes after you save.</p>
        </aside>
      </div>

      {dirty &&
        createPortal(
          <div role="region" aria-label="Unsaved changes" className="sb-auth-step fixed inset-x-4 bottom-5 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-popover py-2 pr-2 pl-4 lg:left-[15.5rem]">
            <p className="text-sm">You have unsaved brand changes.</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(branding)} disabled={saving}>Discard</Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function AssetDrop({ label, hint, fileName, onFile, children, wide = false }: { label: string; hint: string; fileName: string; onFile: (file: File) => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className="group flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border-strong bg-surface-subtle/60 p-4 transition-colors hover:border-foreground/30 hover:bg-surface-subtle focus-within:ring-2 focus-within:ring-ring">
      <span className={cn("flex h-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface px-3 ring-1 ring-border", wide ? "w-32" : "w-14")}>{children}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{fileName || hint}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 group-hover:text-foreground">
          <ImageUp className="size-3.5" />
          {fileName ? "Replace" : "Upload"}
        </span>
      </span>
      <input type="file" accept="image/png,image/svg+xml,image/x-icon" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} />
    </label>
  );
}

function ThemePicker({
  label,
  value,
  options,
  accent,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon: typeof Sun }[];
  accent: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = option.value === value;
          const dark = option.value === "dark";
          const split = option.value === "system" || option.value === "inherit";
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn("rounded-xl p-1.5 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-surface ring-foreground/40" : "bg-surface-subtle/60 ring-border hover:ring-border-strong")}
            >
              <span className={cn("relative block h-14 overflow-hidden rounded-lg", dark ? "bg-[#161617]" : "bg-[#f4f5f7]")}>
                {split && <span className="absolute inset-y-0 right-0 w-1/2 bg-[#161617]" />}
                <span className="absolute top-2.5 left-2.5 h-1.5 w-8 rounded-full" style={{ backgroundColor: accent }} />
                <span className={cn("absolute top-5.5 left-2.5 h-1.5 w-14 rounded-full", dark ? "bg-white/25" : "bg-black/15")} />
                <span className={cn("absolute top-8.5 left-2.5 h-1.5 w-10 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 px-1 pb-0.5 text-xs font-medium">
                <Icon className="size-3.5 text-muted-foreground" />
                {option.label}
                {active && <Check className="ml-auto size-3.5" />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChangelogMock({ name, accent, dark, domain }: { name: string; accent: string; dark: boolean; domain: string }) {
  const entries = [
    { tag: "Feature", title: "Dark mode is here", text: `A calmer way to use ${name} at night.` },
    { tag: "Improvement", title: "Faster search", text: "Results appear as you type." },
  ];
  return (
    <div className={cn("overflow-hidden rounded-xl ring-1", dark ? "bg-[#161617] text-white ring-white/10" : "bg-white text-[#171717] ring-border")}>
      <div className={cn("flex items-center justify-between border-b px-4 py-3", dark ? "border-white/10" : "border-[#e4e5e8]")}>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-5 items-center justify-center rounded-md" style={{ backgroundColor: accent }}>
            <ShipBriefIcon size={11} className="brightness-0 invert" />
          </span>
          {name}
        </span>
        <span className={cn("truncate text-[11px]", dark ? "text-white/50" : "text-[#6c6d6e]")}>{domain || "acme.shipbrief.app"}</span>
      </div>
      <div className="px-4 py-4">
        <p className="text-lg font-semibold tracking-tight">What&apos;s new</p>
        <div className="mt-3 space-y-3">
          {entries.map((entry) => (
            <div key={entry.title} className={cn("rounded-lg p-3", dark ? "bg-white/5" : "bg-[#f4f5f7]")}>
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: accent }}>{entry.tag}</span>
              <p className="mt-0.5 text-sm font-medium">{entry.title}</p>
              <p className={cn("mt-0.5 text-xs", dark ? "text-white/60" : "text-[#6c6d6e]")}>{entry.text}</p>
            </div>
          ))}
        </div>
        <span className="mt-4 inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
          Subscribe to updates
        </span>
      </div>
    </div>
  );
}

function SocialMock({ name, accent, onAccent, domain }: { name: string; accent: string; onAccent: string; domain: string }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-border">
      <div className="flex aspect-[1.91/1] flex-col justify-between p-5" style={{ backgroundColor: accent, color: onAccent }}>
        <span className="flex items-center gap-2 text-xs font-semibold opacity-80">
          <ShipBriefIcon size={14} className={onAccent === "#ffffff" ? "brightness-0 invert" : "brightness-0"} />
          ACME · PRODUCT UPDATES
        </span>
        <span>
          <span className="block text-xl leading-tight font-semibold tracking-tight">Dark mode is here</span>
          <span className="mt-1 block text-xs opacity-75">A calmer way to use {name} at night.</span>
        </span>
      </div>
      <div className="px-4 py-3 text-[#171717]">
        <p className="text-[11px] text-[#6c6d6e] uppercase">{domain || "acme.shipbrief.app"}</p>
        <p className="mt-0.5 text-sm font-medium">Dark mode is here · {name}</p>
      </div>
    </div>
  );
}
