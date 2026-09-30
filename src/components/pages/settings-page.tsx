"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, Bell, Building2, Download, Laptop, LayoutGrid, Loader2, PenLine, ShieldCheck, Smartphone, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/shared/page-states";
import { type Tone } from "@/lib/tones";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { settingsService } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { WorkspaceSettings } from "@/types";

const sections = [
  { id: "general", label: "General", icon: Building2, tone: "blue" },
  { id: "ai", label: "AI & brand voice", icon: PenLine, tone: "violet" },
  { id: "notifications", label: "Notifications", icon: Bell, tone: "amber" },
  { id: "security", label: "Security", icon: ShieldCheck, tone: "green" },
  { id: "workspace", label: "Workspace", icon: LayoutGrid, tone: "rose" },
  { id: "danger", label: "Danger zone", icon: TriangleAlert, tone: "red" },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon; tone: Tone }[];

type SectionId = (typeof sections)[number]["id"];

const timezones = [
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Kigali",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

const notificationCopy: Record<keyof WorkspaceSettings["notifications"], { title: string; detail: string }> = {
  releaseApproved: { title: "Release approved", detail: "When a teammate approves a release you wrote." },
  feedbackCluster: { title: "New feedback theme", detail: "When AI groups enough requests into a new theme." },
  integrationErrors: { title: "Integration problems", detail: "When a source sync or webhook delivery fails." },
  emailDigest: { title: "Weekly digest", detail: "A Monday summary of releases, reads and requests." },
};

const workspaceLinks = [
  { title: "Members & roles", detail: "Invite teammates and choose who can review and publish.", href: "/app/team" },
  { title: "Branding & domain", detail: "Logo, accent colour, custom domain and widget theme.", href: "/app/branding" },
  { title: "Plan & billing", detail: "Plan, usage, invoices and payment method.", href: "/app/billing" },
  { title: "API keys & webhooks", detail: "Server-side credentials and event delivery.", href: "/app/api" },
  { title: "Integrations", detail: "GitHub, Linear, GitLab and Jira connections.", href: "/app/integrations" },
];

export function SettingsPage() {
  const { state, reload } = useAsyncData(() => settingsService.get(), []);
  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={4} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;
  return <SettingsEditor settings={state.data} onReload={reload} />;
}

function SettingsEditor({ settings, onReload }: { settings: WorkspaceSettings; onReload: () => Promise<void> }) {
  const [section, setSection] = useState<SectionId>("general");
  const [draft, setDraft] = useState<WorkspaceSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  const slugValid = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(draft.slug);
  const nameValid = draft.name.trim().length >= 2;

  const patch = (input: Partial<WorkspaceSettings>) => setDraft((current) => ({ ...current, ...input }));

  const save = async () => {
    if (!nameValid || !slugValid) {
      setSection("general");
      toast.error("Check the workspace name and URL before saving.");
      return;
    }
    setSaving(true);
    try {
      await settingsService.update(draft);
      await onReload();
      toast.success("Settings saved.");
    } catch {
      toast.error("We couldn't save your settings. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const result = await settingsService.exportData();
      toast.success(`${result.filename} downloaded.`);
    } catch {
      toast.error("We couldn't prepare the export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <PageHeader title="Settings" description={`Manage how ${settings.name} works in ShipBrief.`} />

      <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Settings sections" className="sb-scrollbar-none -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-6 lg:flex-col">
            {sections.map((item) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] whitespace-nowrap transition-colors",
                    section === item.id ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                    item.id === "danger" && section !== item.id && "hover:text-danger"
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", section === item.id ? "text-foreground" : "text-muted-foreground/80")} aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-3xl">
          {section === "general" && (
            <SettingsSection title="General" description="The basics of your workspace. The URL is also your public changelog address.">
              <SettingRow label="Workspace name" htmlFor="workspace-name" hint="Shown to teammates and on customer-facing pages.">
                <Input id="workspace-name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} aria-invalid={!nameValid} />
                {!nameValid && <p className="mt-1.5 text-xs text-destructive">Use at least 2 characters.</p>}
              </SettingRow>
              <SettingRow label="Workspace URL" htmlFor="workspace-slug" hint="Lowercase letters, numbers and hyphens.">
                <div className={cn("flex h-8 items-center overflow-hidden rounded-lg border border-input bg-transparent text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", !slugValid && "border-destructive")}>
                  <span className="flex h-full items-center border-r border-input bg-surface-subtle px-2.5 text-muted-foreground">shipbrief.app/c/</span>
                  <input
                    id="workspace-slug"
                    value={draft.slug}
                    onChange={(event) => patch({ slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })}
                    aria-invalid={!slugValid}
                    spellCheck={false}
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 outline-none"
                  />
                </div>
                {!slugValid && <p className="mt-1.5 text-xs text-destructive">Use 3–50 lowercase letters, numbers or hyphens.</p>}
              </SettingRow>
              <SettingRow label="Timezone" htmlFor="workspace-timezone" hint="Used for scheduled releases and digests.">
                <Select value={draft.timezone} onValueChange={(value) => value && patch({ timezone: String(value) })}>
                  <SelectTrigger id="workspace-timezone" className="w-full">
                    <SelectValue>{(value) => String(value).replace(/_/g, " ")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(timezones.includes(draft.timezone) ? timezones : [draft.timezone, ...timezones]).map((zone) => (
                      <SelectItem key={zone} value={zone}>{zone.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </SettingsSection>
          )}

          {section === "ai" && (
            <SettingsSection title="AI & brand voice" description="Guidance applied to every AI suggestion. AI never publishes on its own — a teammate always approves.">
              <SettingRow label="Brand voice" htmlFor="brand-voice" hint="Describe tone, words to prefer or avoid, and who you write for." stacked>
                <Textarea id="brand-voice" value={draft.brandVoice} onChange={(event) => patch({ brandVoice: event.target.value })} rows={6} placeholder="Friendly, clear and customer-focused. Lead with the benefit. Avoid internal jargon." />
                <p className="mt-1.5 text-right text-xs text-muted-foreground sb-numeric">{draft.brandVoice.length} characters</p>
              </SettingRow>
            </SettingsSection>
          )}

          {section === "notifications" && (
            <SettingsSection title="Notifications" description="Choose what shows up in your notification center.">
              {(Object.keys(notificationCopy) as (keyof WorkspaceSettings["notifications"])[]).map((key) => (
                <SettingRow key={key} label={notificationCopy[key].title} hint={notificationCopy[key].detail} inline>
                  <Switch
                    checked={Boolean(draft.notifications[key])}
                    label={notificationCopy[key].title}
                    onChange={(checked) => patch({ notifications: { ...draft.notifications, [key]: checked } })}
                  />
                </SettingRow>
              ))}
            </SettingsSection>
          )}

          {section === "security" && (
            <>
              <SettingsSection title="Sign-in" description="How people access this workspace.">
                <SettingRow label="Password & single sign-on" hint="SAML SSO and enforced two-factor are available on Scale." inline>
                  <Button type="button" variant="outline" onClick={() => toast.message("SSO and enforced two-factor aren't available yet. Members sign in with email and password or Google.")}>Manage</Button>
                </SettingRow>
              </SettingsSection>
              <SettingsSection title="Active sessions" description="Devices currently signed in to your account.">
                <ActiveSessions />
              </SettingsSection>
              <SettingsSection title="Data" description="Your content always belongs to you.">
                <SettingRow label="Export workspace data" hint="Releases, feedback and roadmap as JSON." inline>
                  <Button type="button" variant="outline" onClick={() => void exportData()} disabled={exporting}>
                    {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                    Export
                  </Button>
                </SettingRow>
              </SettingsSection>
            </>
          )}

          {section === "workspace" && (
            <SettingsSection title="Workspace" description="Everything else about your workspace lives on its own page.">
              {workspaceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="group -mx-3 flex items-center justify-between gap-4 rounded-md px-3 py-4 transition-colors hover:bg-foreground/[0.03]">
                  <span>
                    <span className="block text-sm font-medium">{link.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{link.detail}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </Link>
              ))}
            </SettingsSection>
          )}

          {section === "danger" && (
            <SettingsSection title="Danger zone" description="Irreversible actions. Take a data export first.">
              <SettingRow label="Delete workspace" hint={`Permanently remove ${settings.name}, its releases, feedback and public changelog.`} inline>
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete workspace</Button>
              </SettingRow>
            </SettingsSection>
          )}
        </div>
      </div>

      {dirty &&
        createPortal(
          // Portalled: the page wrapper's entrance transform would otherwise trap `position: fixed`.
          <div role="region" aria-label="Unsaved changes" className="sb-overlay-shadow sb-auth-step fixed inset-x-4 bottom-5 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-popover py-2 pr-2 pl-4 lg:left-[15.5rem]">
            <p className="text-sm">You have unsaved changes.</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(settings)} disabled={saving}>Discard</Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>,
          document.body
        )}

      <DeleteWorkspaceDialog open={deleteOpen} workspaceName={settings.name} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`settings-${title}`} className="sb-panel mb-6 p-5 last:mb-0">
      <SectionHeader id={`settings-${title}`} title={title} description={description} />
      <div className="mt-3 divide-y divide-border">{children}</div>
    </section>
  );
}

/** Label and help on the left, control on the right — stacks on small screens. */
function SettingRow({
  label,
  hint,
  htmlFor,
  inline = false,
  stacked = false,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  inline?: boolean;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "py-5",
        inline ? "flex items-center justify-between gap-6" : stacked ? "space-y-3" : "grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-8"
      )}
    >
      <div className="min-w-0">
        {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <p className="text-sm font-medium">{label}</p>}
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn(inline ? "shrink-0" : "min-w-0")}>{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-ink" : "bg-border-strong"
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

/** A readable device label from a user-agent string. */
function describeDevice(userAgent: string | null) {
  if (!userAgent) return { device: "Unknown device", mobile: false };
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return { device: os ? `${browser} on ${os}` : browser, mobile: /Mobile|iPhone|Android/.test(userAgent) };
}

function ActiveSessions() {
  const { state, reload } = useAsyncData(() => settingsService.listSessions(), []);
  if (state.status === "loading" || state.status === "idle") return <p className="py-4 text-sm text-muted-foreground">Loading sessions…</p>;
  if (state.status === "error") return <p className="py-4 text-sm text-muted-foreground">{state.error}</p>;
  if (state.status !== "success") return null;
  const revoke = async (id: string) => {
    try {
      await settingsService.revokeSession(id);
      await reload();
      toast.success("That device has been signed out.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't sign that device out.");
    }
  };
  return (
    <>
      {state.data.map((session) => {
        const { device, mobile } = describeDevice(session.userAgent);
        const seen = session.current ? "Active now" : `Last active ${formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}`;
        return <SessionRow key={session.id} icon={mobile ? Smartphone : Laptop} device={device} detail={seen} current={session.current} onRevoke={() => void revoke(session.id)} />;
      })}
    </>
  );
}

function SessionRow({ icon: Icon, device, detail, current = false, onRevoke }: { icon: typeof Laptop; device: string; detail: string; current?: boolean; onRevoke: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{device}</p>
          <p className="text-[13px] text-muted-foreground">{detail}</p>
        </div>
      </div>
      {current ? (
        <span className="text-xs text-muted-foreground">This device</span>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={onRevoke}>Sign out</Button>
      )}
    </div>
  );
}

function DeleteWorkspaceDialog({ open, workspaceName, onOpenChange }: { open: boolean; workspaceName: string; onOpenChange: (open: boolean) => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const submit = async () => {
    if (confirmation !== workspaceName || deleting) return;
    setDeleting(true);
    try {
      await settingsService.deleteWorkspace(confirmation);
      toast.success(`${workspaceName} was deleted.`);
      // Reload fully: the session falls back to another workspace, or onboarding if there are none.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/app/overview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't delete the workspace.");
      setDeleting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {workspaceName}?</DialogTitle>
          <DialogDescription>This permanently removes the workspace for everyone. Type <span className="font-medium text-foreground">{workspaceName}</span> to confirm.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-workspace-confirmation">Workspace name</Label>
          <Input id="delete-workspace-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={workspaceName} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={() => void submit()} disabled={confirmation !== workspaceName || deleting}>{deleting && <Loader2 className="animate-spin" />}Delete workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
