"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Laptop, Loader2, Send, Smartphone, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { EmailPreview, type EmailPreviewViewport } from "@/components/channels/email-preview";
import { RichTextEditor } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { campaignService } from "@/lib/services";
import { getEmailCampaignDefaults } from "@/lib/channel-variants";
import type { Audience, Campaign, Release } from "@/types";

export function CampaignComposer({
  campaign,
  release,
  audiences,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  release: Release;
  audiences: Audience[];
  onClose: () => void;
  onSaved: (campaign: Campaign) => void;
}) {
  const emailDefaults = getEmailCampaignDefaults(release);
  const [draft, setDraft] = useState<Campaign>({
    ...campaign,
    body: campaign.body ?? emailDefaults.body,
    cta: campaign.cta ?? release.cta,
  });
  const [saving, setSaving] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<EmailPreviewViewport>("desktop");
  const audience = useMemo(() => audiences.find((item) => item.id === draft.audienceId), [audiences, draft.audienceId]);
  const update = (patch: Partial<Campaign>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async (status: Campaign["status"]) => {
    if (status === "scheduled" && !draft.scheduledAt) {
      toast.error("Choose a delivery date and time first.");
      return;
    }
    setSaving(true);
    try {
      const saved = await campaignService.update(draft.id, { ...draft, status });
      onSaved(saved);
      toast.success(status === "scheduled" ? "Campaign scheduled (mock)." : "Campaign draft saved (mock).");
    } catch {
      toast.error("We could not save this campaign. Your edits remain open.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Back to campaigns"><ArrowLeft /></Button>
          <div>
            <h2 className="text-lg font-semibold">Email campaign</h2>
            <p className="text-xs text-muted-foreground">
              {emailDefaults.fromVariant
                ? "Started from the saved email version. Campaign edits remain independent."
                : "Email delivery is represented by a mock service in this frontend phase."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => toast.success("Test email queued (mock). No email was sent.")}><TestTube2 />Send test</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save("draft")}>{saving ? <Loader2 className="animate-spin" /> : null}Save draft</Button>
          <Button type="button" disabled={saving} onClick={() => void save("scheduled")}>{saving ? <Loader2 className="animate-spin" /> : <Send />}Schedule</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="sb-panel space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject" htmlFor="campaign-subject"><Input id="campaign-subject" value={draft.subject} onChange={(event) => update({ subject: event.target.value })} /></Field>
            <Field label="Preview text" htmlFor="campaign-preview"><Input id="campaign-preview" value={draft.previewText} onChange={(event) => update({ previewText: event.target.value })} /></Field>
            <Field label="From" htmlFor="campaign-from"><Input id="campaign-from" value={draft.from} onChange={(event) => update({ from: event.target.value })} /></Field>
            <Field label="Reply-to" htmlFor="campaign-reply"><Input id="campaign-reply" value={draft.replyTo ?? ""} onChange={(event) => update({ replyTo: event.target.value })} placeholder="support@acme.com" /></Field>
            <div className="space-y-2"><Label htmlFor="campaign-audience">Audience</Label><Select value={draft.audienceId} onValueChange={(value) => value && update({ audienceId: value })}><SelectTrigger id="campaign-audience" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{audiences.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} / {item.size.toLocaleString()} users</SelectItem>)}</SelectContent></Select></div>
            <Field label="Schedule" htmlFor="campaign-schedule"><Input id="campaign-schedule" type="datetime-local" value={draft.scheduledAt?.slice(0, 16) ?? ""} onChange={(event) => update({ scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></Field>
          </div>

          <div className="space-y-2"><Label>Description</Label><RichTextEditor value={draft.body ?? ""} onChange={(body) => update({ body })} /></div>
          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <Field label="CTA label" htmlFor="campaign-cta-label"><Input id="campaign-cta-label" value={draft.cta?.label ?? ""} onChange={(event) => update({ cta: { label: event.target.value, url: draft.cta?.url ?? "" } })} placeholder="Explore update" /></Field>
            <Field label="CTA URL" htmlFor="campaign-cta-url"><Input id="campaign-cta-url" value={draft.cta?.url ?? ""} onChange={(event) => update({ cta: { label: draft.cta?.label ?? "", url: event.target.value } })} placeholder="/settings" /></Field>
          </div>
        </section>

        <aside className="sb-panel-raised h-fit p-4 xl:sticky xl:top-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Live email preview</p>
              <p className="text-xs text-muted-foreground">Sender, reply-to, and content update as you edit.</p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Email preview viewport">
              <Button
                type="button"
                variant={previewViewport === "desktop" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={previewViewport === "desktop"}
                aria-controls="campaign-email-preview"
                onClick={() => setPreviewViewport("desktop")}
              >
                <Laptop />
                Desktop
              </Button>
              <Button
                type="button"
                variant={previewViewport === "mobile" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={previewViewport === "mobile"}
                aria-controls="campaign-email-preview"
                onClick={() => setPreviewViewport("mobile")}
              >
                <Smartphone />
                Mobile
              </Button>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">Showing the {previewViewport} email preview.</p>
          <div className="rounded-xl bg-surface-subtle/70 p-3">
            <EmailPreview
              content={{ title: release.title, summary: draft.previewText, body: draft.body ?? "", subject: draft.subject, previewText: draft.previewText }}
              cta={draft.cta}
              audienceName={audience?.name}
              from={draft.from}
              replyTo={draft.replyTo}
              viewport={previewViewport}
              id="campaign-email-preview"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}
