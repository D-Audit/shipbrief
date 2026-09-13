"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { History, Loader2 } from "lucide-react";
import { useAsyncData } from "@/hooks/use-async-data";
import { releaseService } from "@/lib/services";
import { ErrorState, LoadingState } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import type { ReleaseVersion } from "@/types";

interface VersionHistoryProps {
  releaseId: string;
  /** Incremented by the surrounding editor after save or lifecycle work. */
  refreshKey?: number;
  onRestore?: (version: ReleaseVersion) => void | Promise<void>;
}

export function VersionHistory({ releaseId, refreshKey = 0, onRestore }: VersionHistoryProps) {
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const { state, reload } = useAsyncData(
    () => releaseService.getVersionHistory(releaseId),
    [releaseId, refreshKey]
  );

  if (state.status === "loading" || state.status === "idle") {
    return <LoadingState rows={2} />;
  }

  if (state.status === "error") {
    return <ErrorState message={state.error} onRetry={reload} />;
  }

  if (state.status !== "success" || state.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        <History className="mx-auto mb-2 size-4" />
        Version history will appear after edits are saved.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.data.map((version) => (
        <div
          key={version.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Version {version.version}
              {version.changeNote && (
                <span className="ml-2 font-normal text-muted-foreground">
                  · {version.changeNote}
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {version.summary}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {version.changedBy} · {format(new Date(version.changedAt), "MMM d, yyyy")} (
              {formatDistanceToNow(new Date(version.changedAt), { addSuffix: true })})
            </p>
          </div>
          {onRestore && version.version > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                void (async () => {
                  setRestoringVersionId(version.id);
                  try {
                    await onRestore(version);
                    await reload();
                  } finally {
                    setRestoringVersionId(null);
                  }
                })();
              }}
              disabled={Boolean(restoringVersionId)}
            >
              {restoringVersionId === version.id && <Loader2 className="animate-spin" />}
              Restore
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
