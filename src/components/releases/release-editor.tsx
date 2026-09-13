"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { aiService, releaseService } from "@/lib/services";
import type { Release, ReleaseVersion } from "@/types";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ApprovalBar } from "./approval-bar";
import { ChannelSelector } from "./channel-selector";
import { ReleaseMetadataFields } from "./release-metadata-fields";
import { ReleasePreviewPanel } from "./release-preview-panel";
import { RichTextEditor, RichTextPreview } from "./rich-text-editor";
import { SchedulePicker } from "./schedule-picker";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { VersionHistory } from "./version-history";

interface ReleaseEditorProps {
  releaseId?: string;
  aiStudio?: boolean;
}

export function ReleaseEditor({ releaseId, aiStudio = false }: ReleaseEditorProps) {
  const router = useRouter();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(!!releaseId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<string[]>([]);
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
    } catch {
      toast.error("Failed to save release");
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
    } catch {
      toast.error("Action failed. Your content is safe.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAiSubmit = async () => {
    if (!release || !aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiPreview(null);
    try {
      const result = await aiService.rewrite(release.body || release.summary, aiPrompt);
      setAiPreview(result.content);
    } catch {
      toast.error("We couldn't generate this draft. Your existing content is safe.");
    } finally {
      setAiGenerating(false);
    }
  };

  const applyAi = () => {
    if (!release || !aiPreview) return;
    setUndoStack((s) => [...s, release.body]);
    update({ body: aiPreview });
    setAiPreview(null);
    setAiPrompt("");
    toast.success("AI suggestion applied");
  };

  const undoAi = () => {
    if (!release || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    update({ body: prev });
    toast.info("Change undone");
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
      "Release scheduled (mock)"
    );
  };

  if (loading) return <LoadingState rows={6} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!release) return null;

  const editorFields = (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={release.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Release title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Customer-value summary</Label>
        <Textarea
          id="summary"
          value={release.summary}
          onChange={(e) => update({ summary: e.target.value })}
          placeholder="Lead with the benefit to customers…"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <RichTextEditor
          value={release.body}
          onChange={(html) => update({ body: html })}
        />
      </div>
      <ChannelSelector
        selected={release.channels}
        onChange={(channels) => update({ channels })}
      />
      <SchedulePicker
        value={release.scheduledAt}
        onChange={(scheduledAt) => update({ scheduledAt })}
      />
      <ReleaseMetadataFields release={release} onChange={update} />
    </div>
  );

  if (aiStudio) {
    return (
      <div className="space-y-4">
        <EditorHeader
          release={release}
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onPublish={() => releaseId && runAction(() => releaseService.publish(releaseId), "Published (mock)")}
          onBack={() => requestNavigation("/app/releases")}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="sb-panel space-y-4 p-4">
            <AiAssistantPanel
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              aiGenerating={aiGenerating}
              aiPreview={aiPreview}
              setAiPreview={setAiPreview}
              onSubmit={handleAiSubmit}
              onApply={applyAi}
              onUndo={undoAi}
              canUndo={undoStack.length > 0}
            />
            {editorFields}
          </div>
          <div className="sb-panel p-4">
            <p className="mb-3 text-sm font-medium">Live preview</p>
            <ChannelPreviewTabs release={release} />
          </div>
        </div>
        <InspectorTabs releaseId={releaseId} release={release} versionHistoryRevision={versionRevision} onRestore={restoreVersion} />
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={release.title || (releaseId ? "Edit release" : "New release")}
        description={release.summary || "Craft a customer-friendly product update."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <Badge variant="outline" className="text-warning">
                Unsaved changes
              </Badge>
            )}
            <StatusBadge status={release.status} />
            <Button type="button" variant="outline" onClick={() => requestNavigation(`/app/ai-studio${releaseId ? `?release=${releaseId}` : ""}`)}>
              <Sparkles />
              AI Studio
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="sb-panel p-6">{editorFields}</div>
        <ReleasePreviewPanel release={release} />
      </div>

      {releaseId && releaseId !== "new" && (
        <>
          <ApprovalBar
            status={release.status}
            scheduledAt={release.scheduledAt}
            createdBy={release.createdBy}
            reviewedBy={release.reviewedBy}
            publishedBy={release.publishedBy}
            loading={actionLoading}
            onSubmitReview={() =>
              runAction(() => releaseService.submitForReview(releaseId), "Submitted for review")
            }
            onApprove={() =>
              runAction(() => releaseService.approve(releaseId), "Release approved")
            }
            onSchedule={handleScheduleConfirm}
            onPublish={() =>
              runAction(() => releaseService.publish(releaseId), "Release published (mock)")
            }
            onArchive={() =>
              runAction(() => releaseService.archive(releaseId), "Release archived")
            }
          />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Version history</h2>
            <VersionHistory releaseId={releaseId} refreshKey={versionRevision} onRestore={restoreVersion} />
          </div>
        </>
      )}

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

function EditorHeader({
  release,
  dirty,
  saving,
  onSave,
  onPublish,
  onBack,
}: {
  release: Release;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onPublish: () => void;
  onBack: () => void;
}) {
  const canPublish = (release.status === "approved" || release.status === "scheduled") && release.channels.length > 0;
  const publishBlockedReason = release.status !== "approved" && release.status !== "scheduled"
    ? "Approve this release before publishing"
    : release.channels.length === 0
      ? "Select at least one publishing channel"
      : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to releases">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{release.title || "AI Studio"}</h1>
          <StatusBadge status={release.status} />
        </div>
      </div>
      <div className="flex gap-2">
        {dirty && (
          <Badge variant="outline" className="text-warning">
            Unsaved changes
          </Badge>
        )}
        <Button variant="outline" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
        <Button
          onClick={onPublish}
          disabled={!canPublish}
          title={publishBlockedReason}
        >
          Publish
        </Button>
      </div>
    </div>
  );
}

function AiAssistantPanel({
  aiPrompt,
  setAiPrompt,
  aiGenerating,
  aiPreview,
  setAiPreview,
  onSubmit,
  onApply,
  onUndo,
  canUndo,
}: {
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  aiGenerating: boolean;
  aiPreview: string | null;
  setAiPreview: (v: string | null) => void;
  onSubmit: () => void;
  onApply: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" />
        AI Assistant
      </div>
      <div className="flex flex-wrap gap-2">
        {["Make this shorter", "Make it friendlier", "Create email version"].map((action) => (
          <Button key={action} variant="outline" size="sm" onClick={() => setAiPrompt(action)}>
            {action}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Ask AI to rewrite, expand, or transform…"
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
        <Button onClick={onSubmit} disabled={aiGenerating}>
          {aiGenerating ? <Loader2 className="animate-spin" /> : "Send"}
        </Button>
      </div>
      {aiGenerating && (
        <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Generating…
        </div>
      )}
      {aiPreview && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm">{aiPreview}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onApply}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAiPreview(null)}>
              Try another
            </Button>
            {canUndo && (
              <Button size="sm" variant="ghost" onClick={onUndo}>
                Undo
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChannelPreviewTabs({ release }: { release: Release }) {
  return (
    <Tabs defaultValue="changelog">
      <TabsList>
        <TabsTrigger value="changelog">Changelog</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="in_app">In-App</TabsTrigger>
      </TabsList>
      <TabsContent value="changelog" className="mt-4 space-y-3">
        <h2 className="text-xl font-semibold">{release.title || "Untitled"}</h2>
        <p className="text-muted-foreground">{release.summary}</p>
        <RichTextPreview html={release.body} />
      </TabsContent>
      <TabsContent value="email" className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground">Subject: {release.title}</p>
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-semibold">{release.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{release.summary}</p>
        </div>
      </TabsContent>
      <TabsContent value="in_app" className="mt-4">
        <div className="max-w-xs rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-primary">✦ What&apos;s new</p>
          <p className="mt-2 font-medium">{release.title}</p>
          <p className="text-sm text-muted-foreground">{release.summary}</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function InspectorTabs({
  releaseId,
  release,
  versionHistoryRevision,
  onRestore,
}: {
  releaseId?: string;
  release: Release;
  versionHistoryRevision: number;
  onRestore: (v: ReleaseVersion) => void | Promise<void>;
}) {
  return (
    <Tabs defaultValue="history">
      <TabsList>
        <TabsTrigger value="history">Version history</TabsTrigger>
        <TabsTrigger value="audience">Audience</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
      </TabsList>
      <TabsContent value="history" className="mt-3">
        {releaseId ? (
          <VersionHistory releaseId={releaseId} refreshKey={versionHistoryRevision} onRestore={onRestore} />
        ) : (
          <p className="text-sm text-muted-foreground">Save the release to track versions.</p>
        )}
      </TabsContent>
      <TabsContent value="audience" className="mt-3 text-sm text-muted-foreground">
        {release.audienceId === "aud_pro"
          ? "Pro customers · 1,248 users"
          : "All users · 3,240 users"}
      </TabsContent>
      <TabsContent value="seo" className="mt-3 text-sm text-muted-foreground">
        Suggested slug: {release.title.toLowerCase().replace(/\s+/g, "-") || "untitled"}
      </TabsContent>
    </Tabs>
  );
}
