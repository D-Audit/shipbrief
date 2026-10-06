"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changelogService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/components/session/session-provider";
import { SectionHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import type { ChangelogSettings } from "@/types";
import { cn } from "@/lib/utils";

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error("Copy isn't available in this browser.");
  }
}

function StatusPill({ tone, children }: { tone: "live" | "off"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground/80">
      <span className={cn("size-1.5 rounded-full", tone === "live" ? "bg-success" : "bg-border-strong")} />
      {children}
    </span>
  );
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong"
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

function UrlRow({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-surface-subtle px-2.5 py-1.5 font-mono text-[12.5px]">{value}</code>
        <Button type="button" variant="ghost" size="sm" onClick={() => void copy(value, copyLabel)}><Copy />Copy</Button>
      </div>
    </div>
  );
}

const SETTINGS: { key: keyof Pick<ChangelogSettings, "enabled" | "allowSubscriptions" | "showAuthor">; label: string; hint: string }[] = [
  { key: "enabled", label: "Public changelog", hint: "Off hides the changelog page, its updates and the RSS feed. The widget keeps working." },
  { key: "allowSubscriptions", label: "Email subscriptions", hint: "Visitors can subscribe to new updates by email (they confirm by email first)." },
  { key: "showAuthor", label: "Show author", hint: "Shows who published each update, on the page and in RSS." },
];

/** Where the changelog lives (URL, RSS) and what it shows. */
export function ChangelogPublishingPanel() {
  const { can } = useSession();
  const canEdit = can("branding:update");
  const { state, reload } = useAsyncData(() => changelogService.getSettings(), []);
  const [saving, setSaving] = useState<string | null>(null);
  const [override, setOverride] = useState<ChangelogSettings | null>(null);

  if (state.status === "error") {
    return (
      <section className="sb-panel flex flex-wrap items-center justify-between gap-3 p-4" aria-live="polite">
        <div><p className="font-medium">Changelog settings didn&apos;t load</p><p className="mt-1 text-sm text-muted-foreground">{state.error}</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>Retry</Button>
      </section>
    );
  }
  if (state.status !== "success") {
    return <section className="sb-panel p-5" aria-busy="true" aria-label="Loading changelog settings"><div className="h-4 w-48 animate-pulse rounded bg-muted" /><div className="mt-4 h-9 animate-pulse rounded-lg bg-muted/70" /><div className="mt-3 h-9 animate-pulse rounded-lg bg-muted/70" /></section>;
  }

  const settings = override ?? state.data;

  const toggle = async (key: (typeof SETTINGS)[number]["key"], value: boolean) => {
    setSaving(key);
    try {
      setOverride(await changelogService.updateSettings({ [key]: value }));
      toast.success("Changelog settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings couldn't be saved.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section aria-labelledby="changelog-public-heading" className="sb-panel p-5">
      <SectionHeader
        id="changelog-public-heading"
        title="Public changelog"
        description="Every update you publish to the Changelog channel appears here. No widget or install needed."
        action={<StatusPill tone={settings.enabled ? "live" : "off"}>{settings.enabled ? "Live" : "Off"}</StatusPill>}
      />
      <div className="mt-3 divide-y divide-border">
        <UrlRow label="Public URL" value={settings.url} copyLabel="Changelog URL" />
        <UrlRow label="RSS feed" value={settings.rssUrl} copyLabel="RSS URL" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={settings.url} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium transition-colors hover:bg-muted">
          <ExternalLink className="size-4" />Open changelog
        </Link>
      </div>

      <div className="mt-5 divide-y divide-border border-t border-border">
        {SETTINGS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{item.hint}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {saving === item.key && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              <Switch
                label={item.label}
                checked={settings[item.key]}
                disabled={!canEdit || saving !== null || (item.key !== "enabled" && !settings.enabled)}
                onChange={(value) => void toggle(item.key, value)}
              />
            </div>
          </div>
        ))}
      </div>
      {!canEdit && <p className="mt-2 text-xs text-muted-foreground">Admins and marketers can change these settings.</p>}
    </section>
  );
}
