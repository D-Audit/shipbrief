"use client";

import { Plus, X, ExternalLink, ImagePlus } from "lucide-react";
import type { Release, SourceRef } from "@/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockAudiences } from "@/lib/mock-data";

const CATEGORIES = ["Feature", "Improvement", "Fix", "Security"];

interface ReleaseMetadataFieldsProps {
  release: Release;
  onChange: (patch: Partial<Release>) => void;
}

export function ReleaseMetadataFields({ release, onChange }: ReleaseMetadataFieldsProps) {
  const tags = release.tags;
  const tagInput = tags.join(", ");

  const addSourceRef = () => {
    const ref: SourceRef = {
      id: `src_${Date.now()}`,
      type: "manual",
      label: "New reference",
    };
    onChange({ sourceRefs: [...release.sourceRefs, ref] });
  };

  const updateSourceRef = (id: string, label: string) => {
    onChange({
      sourceRefs: release.sourceRefs.map((r) =>
        r.id === id ? { ...r, label } : r
      ),
    });
  };

  const removeSourceRef = (id: string) => {
    onChange({ sourceRefs: release.sourceRefs.filter((r) => r.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={release.category}
            onValueChange={(v) => v && onChange({ category: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) =>
              onChange({
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            placeholder="ui, accessibility"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Audience</Label>
        <Select
          value={release.audienceId ?? "aud_all"}
          onValueChange={(v) => v && onChange({ audienceId: v })}
        >
          <SelectTrigger>
            <SelectValue>
              {(value) =>
                mockAudiences.find((audience) => audience.id === value)?.name ?? "All users"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {mockAudiences.map((aud) => (
              <SelectItem key={aud.id} value={aud.id}>
                {aud.name} ({aud.size.toLocaleString()} users)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cta-label">CTA label</Label>
          <Input
            id="cta-label"
            value={release.cta?.label ?? ""}
            onChange={(e) =>
              onChange({
                cta: { label: e.target.value, url: release.cta?.url ?? "" },
              })
            }
            placeholder="Try it now"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cta-url">CTA URL</Label>
          <Input
            id="cta-url"
            value={release.cta?.url ?? ""}
            onChange={(e) =>
              onChange({
                cta: { label: release.cta?.label ?? "", url: e.target.value },
              })
            }
            placeholder="/feature"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Source references</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addSourceRef}>
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        {release.sourceRefs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Link GitHub, Linear, or manual sources.</p>
        ) : (
          <div className="space-y-2">
            {release.sourceRefs.map((ref) => (
              <div key={ref.id} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                  {ref.type}
                </span>
                <Input
                  value={ref.label}
                  onChange={(e) => updateSourceRef(ref.id, e.target.value)}
                  className="flex-1"
                />
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 text-muted-foreground" />
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeSourceRef(ref.id)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Media</Label>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-subtle/50 px-4 py-8 text-center">
          <ImagePlus className="mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Upload images or video</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Media upload connects to backend in a later phase
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" disabled>
            Upload / Replace
          </Button>
        </div>
      </div>
    </div>
  );
}
