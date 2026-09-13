"use client";

import { useState } from "react";
import { MailPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CampaignComposer } from "@/components/channels";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { Badge } from "@/components/ui/badge";
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
        from: "Acme Product Team",
        audienceId: release.audienceId ?? audiences[0]?.id ?? "aud_all",
        body: emailDefaults.body,
        cta: release.cta,
      });
      await reload();
      setEditing(campaign);
    } catch {
      toast.error("We could not create a campaign.");
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
        description="Create thoughtful email announcements from selected product releases. Delivery remains mocked in this frontend phase."
        actions={<Button type="button" onClick={() => void createCampaign()} disabled={creating || releasesState.status !== "success"}><MailPlus />New campaign</Button>}
      />

      {campaignsState.status === "loading" && <LoadingState />}
      {campaignsState.status === "error" && <ErrorState message={campaignsState.error} onRetry={reload} />}
      {campaignsState.status === "empty" && <EmptyState title="No campaigns" description="Create an email campaign from a release when customers need a direct announcement." action={<Button type="button" onClick={() => void createCampaign()} disabled={creating}>Create campaign</Button>} />}
      {campaignsState.status === "success" && (
        <div className="space-y-3">
          {campaignsState.data.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} release={releases.find((release) => release.id === campaign.releaseId)} onEdit={() => setEditing(campaign)} />)}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, release, onEdit }: { campaign: Campaign; release?: Release; onEdit: () => void }) {
  return (
    <article className="sb-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{campaign.subject}</h2><StatusBadge status={campaign.status} /></div>
        <p className="mt-2 text-sm text-muted-foreground">{campaign.previewText}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{release?.title ?? "Release unavailable"}</Badge>
          <span>From {campaign.from}</span>
          {campaign.scheduledAt && <span>Scheduled {format(new Date(campaign.scheduledAt), "MMM d, h:mm a")}</span>}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil />Edit campaign</Button>
    </article>
  );
}
