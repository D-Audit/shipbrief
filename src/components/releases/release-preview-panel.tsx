"use client";

import { useState } from "react";
import type { Channel, Release } from "@/types";
import { channelMeta, channelOrder } from "@/components/shared/channel-meta";
import { ChangelogPreview } from "@/components/channels/changelog-preview";
import { EmailPreview } from "@/components/channels/email-preview";
import { InAppPreview } from "@/components/channels/in-app-preview";
import { cn } from "@/lib/utils";

interface ReleasePreviewPanelProps {
  release: Release;
}

/** Live preview of the release in each selected channel. */
export function ReleasePreviewPanel({ release }: ReleasePreviewPanelProps) {
  const channels = channelOrder.filter((channel) => release.channels.includes(channel));
  const [picked, setPicked] = useState<Channel | null>(null);
  const active = picked && channels.includes(picked) ? picked : channels[0];
  const content = { title: release.title, summary: release.summary, body: release.body, subject: release.title, previewText: release.summary };

  return (
    <section aria-labelledby="preview-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="preview-heading" className="sb-title-section">Preview</h2>
        {channels.length > 1 && (
          <div role="tablist" aria-label="Preview channel" className="flex rounded-lg bg-muted p-0.5">
            {channels.map((channel) => (
              <button
                key={channel}
                type="button"
                role="tab"
                aria-selected={channel === active}
                onClick={() => setPicked(channel)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  channel === active ? "bg-surface text-foreground " : "text-muted-foreground hover:text-foreground"
                )}
              >
                {channelMeta[channel].label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface-subtle p-3">
        {!active && <p className="px-2 py-8 text-center text-sm text-muted-foreground">Choose a channel to see how this release will look.</p>}
        {active === "changelog" && <ChangelogPreview content={content} category={release.category} cta={release.cta} />}
        {active === "email" && <EmailPreview content={content} cta={release.cta} viewport="mobile" />}
        {active === "in_app" && <InAppPreview content={content} cta={release.cta} />}
      </div>
    </section>
  );
}
