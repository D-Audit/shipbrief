"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { releaseService } from "@/lib/services";
import type { Release, ReleaseVersion } from "@/types";
import { ErrorState, LoadingState, StatusBadge } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalBar } from "./approval-bar";
import { ChannelSelector } from "./channel-selector";
import { ReleaseMetadataFields } from "./release-metadata-fields";
import { ReleasePreviewPanel } from "./release-preview-panel";
import { RichTextEditor } from "./rich-text-editor";
import { SchedulePicker } from "./schedule-picker";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { VersionHistory } from "./version-history";

interface ReleaseEditorProps {
  releaseId?: string;
}

export function ReleaseEditor({ releaseId }: ReleaseEditorProps) {
  const router = useRouter();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(!!releaseId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [versionRevision, setVersionRevision] = useState(0);

  useEffect(() => {
    let active = true;

    async function run() {
      if (!releaseId) {
        if (!active) return;
        setRelease({
          id: "new",
          title: "",
          summary: "",
          body: "",
          status: "draft",
          channels: ["changelog"],
          category: "Feature",
          tags: [],
          sourceRefs: [],
          views: 0,
          reactions: 0,
          comments: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          audienceId: "aud_all",
        });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await releaseService.get(releaseId);
        if (!active) return;
        setRelease(data);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load release");
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [releaseId]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const reload = useCallback(async () => {
    if (!releaseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await releaseService.get(releaseId);
      setRelease(data);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load release");
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  const update = (patch: Partial<Release>) => {
    setRelease((r) => (r ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const requestNavigation = useCallback((href: string) => {
    if (!dirty) {
      router.push(href);
      return;
    }
    setPendingNavigation(href);
    setShowUnsavedDialog(true);
  }, [dirty, router]);

  const handleSave = async () => {
    if (!release) return;
    setSaving(true);
    try {
      let saved: Release;
      if (releaseId && releaseId !== "new") {
        saved = await releaseService.update(releaseId, release, { changeNote: "Release editor draft saved" });
      } else {
        saved = await releaseService.create(release);
        router.replace(`/app/releases/${saved.id}`);
      }
      setRelease(saved);
      setDirty(false);
      setVersionRevision((current) => current + 1);
      toast.success("Release saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save release");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: () => Promise<Release>, successMessage: string) => {
    if (!releaseId) return;
    setActionLoading(true);
    try {
      await action();
      toast.success(successMessage);
      await reload();
      setVersionRevision((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof Error ? `${error.message} Your content is safe.` : "Action failed. Your content is safe.");
    } finally {
      setActionLoading(false);
    }
  };

  const restoreVersion = async (version: ReleaseVersion) => {
    if (!releaseId || !release) return;
    if (dirty) {
      toast.error("Save or discard your current changes before restoring a version.");
      return;
    }
    setActionLoading(true);
    try {
      const restored = await releaseService.restoreVersion(releaseId, version.id);
      setRelease(restored);
      setDirty(false);
      setVersionRevision((current) => current + 1);
      toast.success(`Version ${version.version} restored and saved as a new version.`);
    } catch {
      toast.error("We could not restore that version. Your current draft is safe.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleConfirm = async () => {
    if (!releaseId || !release?.scheduledAt) {
      toast.error("Pick a schedule date first");
      return;
    }
    await runAction(
      () => releaseService.schedule(releaseId, release.scheduledAt!),
      "Release scheduled"
    );
  };

  if (loading) return <LoadingState rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!release) return null;

  const saved = Boolean(releaseId && releaseId !== "new");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <button type="button" onClick={() => requestNavigation("/app/releases")} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Releases
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="sb-title-page truncate">{release.title || (saved ? "Untitled release" : "New release")}</h1>
            <StatusBadge status={release.status} />
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => requestNavigation(`/app/ai-studio${saved ? `?release=${releaseId}` : ""}`)}>
            <PenLine />
            Open in AI Studio
          </Button>
          <Button onClick={handleSave} disabled={saving} variant={saved ? "outline" : "default"}>
            {saving && <Loader2 className="animate-spin" />}
            {saved ? "Save" : "Save draft"}
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-8">
          <section aria-label="Content" className="sb-panel space-y-5 p-5 sm:p-6">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={release.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="e.g. Faster search across reports"
                className="h-10 text-base font-medium md:text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={release.summary}
                onChange={(e) => update({ summary: e.target.value })}
                placeholder="One or two sentences on what customers can now do."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <RichTextEditor value={release.body} onChange={(html) => update({ body: html })} />
            </div>
          </section>

          <section aria-labelledby="channels-heading" className="space-y-3">
            <div>
              <h2 id="channels-heading" className="sb-title-section">Publish to</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Pick where this release appears. Each channel gets its own preview.</p>
            </div>
            <ChannelSelector selected={release.channels} onChange={(channels) => update({ channels })} />
          </section>

          <details className="group sb-panel">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-lg)] px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                More options
                <span className="mt-0.5 block text-[13px] font-normal text-muted-foreground">Schedule, category, tags, audience, call to action, sources and media.</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-6 border-t border-border px-5 py-5">
              <SchedulePicker value={release.scheduledAt} onChange={(scheduledAt) => update({ scheduledAt })} />
              <ReleaseMetadataFields release={release} onChange={update} />
            </div>
          </details>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:self-start">
          {saved ? (
            <ApprovalBar
              status={release.status}
              scheduledAt={release.scheduledAt}
              createdBy={release.createdBy}
              reviewedBy={release.reviewedBy}
              publishedBy={release.publishedBy}
              loading={actionLoading}
              onSubmitReview={() => runAction(() => releaseService.submitForReview(releaseId!), "Sent for review")}
              onApprove={() => runAction(() => releaseService.approve(releaseId!), "Release approved")}
              onSchedule={handleScheduleConfirm}
              onPublish={() => runAction(() => releaseService.publish(releaseId!), "Release published")}
              onArchive={() => runAction(() => releaseService.archive(releaseId!), "Release archived")}
            />
          ) : (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-border-strong px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              Save the draft to send it for review. Nothing is published until a teammate approves it.
            </p>
          )}

          <ReleasePreviewPanel release={release} />

          {saved && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Version history
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3">
                <VersionHistory releaseId={releaseId!} refreshKey={versionRevision} onRestore={restoreVersion} />
              </div>
            </details>
          )}
        </aside>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onStay={() => {
          setShowUnsavedDialog(false);
          setPendingNavigation(null);
        }}
        onDiscard={() => {
          setDirty(false);
          setShowUnsavedDialog(false);
          const destination = pendingNavigation;
          setPendingNavigation(null);
          if (destination) router.push(destination);
        }}
      />
    </div>
  );
}
