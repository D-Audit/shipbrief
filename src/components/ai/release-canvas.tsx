"use client";

import { Eye, PencilLine } from "lucide-react";
import { ChannelTabs, ChangelogPreview, EmailPreview, InAppPreview } from "@/components/channels";
import { inAppFormatOptions } from "@/components/channels/in-app-formats";
import { RichTextEditor } from "@/components/releases/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, InAppFormat, Release } from "@/types";
import type { StudioDraft, StudioScope } from "./types";

export function ReleaseCanvas({
  activeScope,
  selectedChannels,
  content,
  release,
  audienceName,
  onScopeChange,
  onContentChange,
}: {
  activeScope: StudioScope;
  selectedChannels: Channel[];
  content: StudioDraft;
  release: Release;
  audienceName?: string;
  onScopeChange: (scope: StudioScope) => void;
  onContentChange: (patch: Partial<StudioDraft>) => void;
}) {
  const label = activeScope === "master" ? "Master release" : activeScope === "in_app" ? "In-App version" : `${activeScope[0].toUpperCase()}${activeScope.slice(1)} version`;

  return (
    <section className="sb-panel-raised min-w-0 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><PencilLine className="size-4 text-primary" />{label}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeScope === "master"
              ? "The canonical source used to create channel-specific versions."
              : "This channel version is edited independently from the master release."}
          </p>
        </div>
        <ChannelTabs active={activeScope} selectedChannels={selectedChannels} onChange={onScopeChange} />
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <section aria-labelledby="live-preview-heading">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" />
            <h2 id="live-preview-heading" className="text-sm font-medium">Live preview</h2>
          </div>
          <div className="rounded-xl bg-surface-subtle/70 p-3 sm:p-5">
            {activeScope === "email" ? (
              <EmailPreview content={content} cta={release.cta} audienceName={audienceName} />
            ) : activeScope === "in_app" ? (
              <InAppPreview content={content} cta={release.cta} />
            ) : (
              <ChangelogPreview content={content} category={release.category} cta={release.cta} />
            )}
          </div>
        </section>

        <section className="border-t border-border pt-5" aria-labelledby="content-editor-heading">
          <h2 id="content-editor-heading" className="text-sm font-medium">Content canvas</h2>
          <p className="mt-1 text-xs text-muted-foreground">Edit directly, or use an AI proposal without overwriting your current draft.</p>
          <div className="mt-4 space-y-4">
            {activeScope === "email" && (
              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject line</Label>
                <Input
                  id="email-subject"
                  value={content.subject ?? content.title}
                  onChange={(event) => onContentChange({ subject: event.target.value })}
                  placeholder="A concise email subject"
                />
              </div>
            )}
            {activeScope === "email" && (
              <div className="space-y-2">
                <Label htmlFor="email-preview">Preview text</Label>
                <Input
                  id="email-preview"
                  value={content.previewText ?? content.summary}
                  onChange={(event) => onContentChange({ previewText: event.target.value })}
                  placeholder="A helpful preview in the inbox"
                />
              </div>
            )}
            {activeScope === "in_app" && (
              <div className="space-y-2">
                <Label htmlFor="in-app-format">Announcement format</Label>
                <Select
                  value={content.format ?? "feed"}
                  onValueChange={(format) => {
                    if (format && inAppFormatOptions.some((option) => option.value === format)) {
                      onContentChange({ format: format as InAppFormat });
                    }
                  }}
                >
                  <SelectTrigger id="in-app-format" className="w-full" aria-describedby="in-app-format-help">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inAppFormatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="in-app-format-help" className="text-xs leading-relaxed text-muted-foreground">
                  Choose the frontend preview for this in-app version. Delivery placement and frequency are connected later.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="studio-title">Title</Label>
              <Input
                id="studio-title"
                value={content.title}
                onChange={(event) => onContentChange({ title: event.target.value })}
                placeholder="Release title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studio-summary">Customer-value summary</Label>
              <Textarea
                id="studio-summary"
                rows={2}
                value={content.summary}
                onChange={(event) => onContentChange({ summary: event.target.value })}
                placeholder="Lead with the outcome for customers..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor value={content.body} onChange={(body) => onContentChange({ body })} />
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
