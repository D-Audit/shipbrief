"use client";

import { History, Palette, ScanSearch, Users } from "lucide-react";
import { ChannelSelector } from "@/components/releases/channel-selector";
import { VersionHistory } from "@/components/releases/version-history";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { QualityState } from "./ai-quality-check";
import { AIQualityCheck } from "./ai-quality-check";
import type { Audience, Channel, Release, ReleaseVersion } from "@/types";

export function AIStudioInspector({
  release,
  audiences,
  brandVoice,
  brandVoiceLoading,
  qualityState,
  versionHistoryRevision,
  onBrandVoiceChange,
  onChannelsChange,
  onAudienceChange,
  onRunQualityCheck,
  onRestoreVersion,
}: {
  release: Release;
  audiences: Audience[];
  brandVoice: string;
  brandVoiceLoading: boolean;
  qualityState: QualityState;
  versionHistoryRevision: number;
  onBrandVoiceChange: (value: string) => void;
  onChannelsChange: (channels: Channel[]) => void;
  onAudienceChange: (audienceId: string) => void;
  onRunQualityCheck: () => void;
  onRestoreVersion: (version: ReleaseVersion) => void;
}) {
  const slug = release.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled-release";
  const selectedAudience = audiences.find((audience) => audience.id === release.audienceId);

  return (
    <aside className="sb-panel min-w-0 p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <Tabs defaultValue="ai">
        <TabsList className="w-full justify-start overflow-x-auto" variant="line" aria-label="AI Studio inspector">
          <TabsTrigger value="ai"><Palette />AI setup</TabsTrigger>
          <TabsTrigger value="audience"><Users />Audience</TabsTrigger>
          <TabsTrigger value="seo"><ScanSearch />SEO</TabsTrigger>
          <TabsTrigger value="history"><History />History</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-5 space-y-6">
          <section>
            <h2 className="text-sm font-medium">Brand voice</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Applied to every new proposal and saved with your AI Studio changes for this workspace.</p>
            <Textarea
              value={brandVoice}
              onChange={(event) => onBrandVoiceChange(event.target.value)}
              rows={5}
              disabled={brandVoiceLoading}
              className="mt-3"
              aria-label="Brand voice guidance"
              placeholder="Loading brand voice..."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Active context: {selectedAudience?.name ?? "All customers"} · {release.sourceRefs.length} source reference{release.sourceRefs.length === 1 ? "" : "s"}
            </p>
          </section>
          <div className="border-t border-border pt-5">
            <AIQualityCheck state={qualityState} onRun={onRunQualityCheck} />
          </div>
        </TabsContent>

        <TabsContent value="audience" className="mt-5 space-y-6">
          <section className="space-y-2">
            <Label htmlFor="studio-audience">Audience</Label>
            <Select
              value={release.audienceId ?? audiences[0]?.id}
              onValueChange={(audienceId) => {
                if (audienceId) onAudienceChange(audienceId);
              }}
            >
              <SelectTrigger id="studio-audience" className="w-full"><SelectValue placeholder="Select audience" /></SelectTrigger>
              <SelectContent>
                {audiences.map((audience) => <SelectItem key={audience.id} value={audience.id}>{audience.name} · {audience.size.toLocaleString()} users</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Targeting affects only selected delivery channels.</p>
          </section>
          <div className="border-t border-border pt-5">
            <ChannelSelector selected={release.channels} onChange={onChannelsChange} />
          </div>
        </TabsContent>

        <TabsContent value="seo" className="mt-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium">SEO metadata</h2>
            <p className="mt-1 text-xs text-muted-foreground">Suggestions are derived from the current master release.</p>
          </div>
          <div className="space-y-2"><Label htmlFor="seo-title">Title</Label><Input id="seo-title" readOnly value={release.title || "Untitled release"} /></div>
          <div className="space-y-2"><Label htmlFor="seo-description">Description</Label><Textarea id="seo-description" readOnly rows={3} value={release.summary || "Add a customer-value summary to improve this preview."} /></div>
          <div className="space-y-2"><Label htmlFor="seo-slug">Suggested slug</Label><Input id="seo-slug" readOnly value={slug} /></div>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <div className="mb-3">
            <h2 className="text-sm font-medium">Version history</h2>
            <p className="mt-1 text-xs text-muted-foreground">Restore a saved master-release version when needed.</p>
          </div>
          <VersionHistory releaseId={release.id} refreshKey={versionHistoryRevision} onRestore={onRestoreVersion} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
