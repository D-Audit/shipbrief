"use client";

import type { Release } from "@/types";
import { RichTextPreview } from "./rich-text-editor";
import { Button } from "@/components/ui/button";

interface ReleasePreviewPanelProps {
  release: Release;
}

export function ReleasePreviewPanel({ release }: ReleasePreviewPanelProps) {
  return (
    <div className="sb-panel sticky top-4 space-y-4 p-4">
      <p className="text-sm font-medium">Preview</p>
      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {release.category}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {release.title || "Untitled release"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {release.summary || "Customer-value summary will appear here."}
        </p>
        <div className="mt-4 border-t border-border pt-4">
          <RichTextPreview html={release.body} />
        </div>
        {release.cta?.label && (
          <Button size="sm" className="mt-4">
            {release.cta.label}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Channels: {release.channels.length > 0 ? release.channels.join(", ") : "None selected"}
      </p>
    </div>
  );
}
