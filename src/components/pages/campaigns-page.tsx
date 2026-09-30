"use client";

import { useState } from "react";
import { CalendarClock, FilePen, Mail, MailPlus, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { CampaignComposer } from "@/components/channels";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { IconTile } from "@/components/shared/icon-tile";
import { categoryMeta } from "@/components/shared/category-meta";
import { toneFill } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/use-async-data";
import { audienceService, campaignService, releaseService } from "@/lib/services";
import { getEmailCampaignDefaults } from "@/lib/channel-variants";
import type { Campaign, Release } from "@/types";
import { format } from "date-fns";

export function CampaignsPage() {
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const { state: campaignsState, reload } = useAsyncData(() => campaignService.list(), []);
  const { state: releasesState } = useAsyncData(() => releaseService.list(), []);
  const { state: audiencesState } = useAsyncData(() => audienceService.list(), []);
  const releases = releasesState.status === "success" ? releasesState.data : [];
  const audiences = audiencesState.status === "success" ? audiencesState.data : [];
  const editingRelease = editing ? releases.find((release) => release.id === editing.releaseId) : undefined;

  const createCampaign = async () => {
    const release = releases.find((item) => item.channels.includes("email")) ?? releases[0];
    if (!release) {
      toast.error("Add a release before creating an email campaign.");
      return;
    }
    const emailDefaults = getEmailCampaignDefaults(release);
    setCreating(true);
    try {
      const campaign = await campaignService.create({
        releaseId: release.id,
        subject: emailDefaults.subject,
        previewText: emailDefaults.previewText,
        audienceId: release.audienceId ?? audiences[0]?.id,
        body: emailDefaults.body,
        cta: release.cta,
      });
      await reload();
      setEditing(campaign);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not create a campaign.");
    } finally {
      setCreating(false);
    }
  };

  if (editing && editingRelease) {
    return <CampaignComposer campaign={editing} release={editingRelease} audiences={audiences} onClose={() => setEditing(null)} onSaved={(campaign) => { setEditing(campaign); void reload(); }} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email campaigns"
        description="Announce releases directly in your customers’ inbox."
        actions={<Button type="button" onClick={() => void createCampaign()} disabled={creating || releasesState.status !== "success"}><MailPlus />New campaign</Button>}
      />

      {campaignsState.status === "loading" && <LoadingState />}
      {campaignsState.status === "error" && <ErrorState message={campaignsState.error} onRetry={reload} />}
      {campaignsState.status === "empty" && <EmptyState title="No campaigns" description="Create an email campaign from a release when customers need a direct announcement." action={<Button type="button" onClick={() => void createCampaign()} disabled={creating}>Create campaign</Button>} />}
      {campaignsState.status === "success" && (
        <>
          <section aria-label="Campaign summary" className="grid grid-cols-3 gap-3">
            {[
              { label: "Sent", icon: Send, tone: "green" as const, count: campaignsState.data.filter((item) => item.status === "sent").length },
              { label: "Scheduled", icon: CalendarClock, tone: "rose" as const, count: campaignsState.data.filter((item) => item.status === "scheduled").length },
              { label: "Drafts", icon: FilePen, tone: "neutral" as const, count: campaignsState.data.filter((item) => item.status === "draft").length },
            ].map((stat) => (
              <div key={stat.label} className="sb-panel flex items-center gap-3 p-4">
                <IconTile icon={stat.icon} tone={stat.tone} />
                <div>
                  <p className="sb-stat text-[1.625rem]">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </section>
          <div className="space-y-3">
            {campaignsState.data.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                release={releases.find((release) => release.id === campaign.releaseId)}
                audienceName={audiences.find((audience) => audience.id === campaign.audienceId)?.name}
                onEdit={() => setEditing(campaign)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CampaignCard({ campaign, release, audienceName, onEdit }: { campaign: Campaign; release?: Release; audienceName?: string; onEdit: () => void }) {
  return (
    <article className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3.5">
        <IconTile icon={Mail} tone="amber" size="lg" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{campaign.from}</span>{audienceName ? ` → ${audienceName}` : ""}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2"><h2 className="sb-title-card">{campaign.subject}</h2><StatusBadge status={campaign.status} /></div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{campaign.previewText}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {release && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2 py-0.5"><CategoryDot category={release.category} />{release.title}</span>}
            {campaign.sentAt && <span>Sent {format(new Date(campaign.sentAt), "MMM d, h:mm a")}</span>}
            {campaign.scheduledAt && <span className="text-primary-strong">Goes out {format(new Date(campaign.scheduledAt), "MMM d, h:mm a")}</span>}
          </div>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil />Edit</Button>
    </article>
  );
}

function CategoryDot({ category }: { category: string }) {
  return <span aria-hidden="true" className={cn("size-1.5 rounded-full", toneFill[categoryMeta(category).tone])} />;
}
