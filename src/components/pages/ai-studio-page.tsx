"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Save, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AIAssistantPanel,
  AIStudioInspector,
  ReleaseCanvas,
  type AIGeneration,
  type QualityState,
  type StudioDraft,
  type StudioScope,
} from "@/components/ai";
import { ErrorState, LoadingState, StatusBadge } from "@/components/shared/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UnsavedChangesDialog } from "@/components/releases/unsaved-changes-dialog";
import { suggestedAIStudioActions, defaultAIStudioReleaseId } from "@/lib/mock-data/ai-studio";
import { aiStudioService, audienceService, releaseService, settingsService } from "@/lib/services";
import type { AIGenerationContext, Audience, Channel, ChannelVariant, Release, ReleaseVersion } from "@/types";

type VariantMap = NonNullable<Release["channelVariants"]>;

type UndoEntry = {
  scope: StudioScope;
  before: StudioDraft;
  previousVariant?: ChannelVariant;
};

type GenerationRequest = {
  prompt: string;
  kind: "rewrite" | "channel_variant";
  targetScope: StudioScope;
  attempt?: number;
};

function toStudioDraft(release: Pick<Release, "title" | "summary" | "body">): StudioDraft {
  return {
    title: release.title,
    summary: release.summary,
    body: release.body,
  };
}

function defaultVariant(release: Release, channel: Channel): StudioDraft {
  const draft = toStudioDraft(release);
  if (channel === "email") {
    return { ...draft, subject: draft.title, previewText: draft.summary };
  }
  if (channel === "in_app") {
    return { ...draft, format: "feed" };
  }
  return draft;
}

function asVariant<T extends Channel>(channel: T, draft: StudioDraft): Extract<ChannelVariant, { channel: T }> {
  const { format, ...content } = draft;
  if (channel === "in_app") {
    return { channel, ...content, format: format ?? "feed" } as Extract<ChannelVariant, { channel: T }>;
  }
  return { channel, ...content } as Extract<ChannelVariant, { channel: T }>;
}

function setChannelVariant(variants: VariantMap, channel: Channel, draft: StudioDraft): VariantMap {
  if (channel === "changelog") return { ...variants, changelog: asVariant(channel, draft) };
  if (channel === "email") return { ...variants, email: asVariant(channel, draft) };
  return { ...variants, in_app: asVariant(channel, draft) };
}

function removeChannelVariant(variants: VariantMap, channel: Channel): VariantMap {
  const next = { ...variants };
  if (channel === "changelog") delete next.changelog;
  if (channel === "email") delete next.email;
  if (channel === "in_app") delete next.in_app;
  return next;
}

function withChannelVariant(release: Release, channel: Channel, draft: StudioDraft): Release {
  return {
    ...release,
    channelVariants: setChannelVariant(release.channelVariants ?? {}, channel, draft),
  };
}

function inferredVariantChannel(prompt: string): Channel | undefined {
  const instruction = prompt.toLowerCase();
  if (/email.*version|version.*email/.test(instruction)) return "email";
  if (/in[ -]?app.*version|version.*in[ -]?app/.test(instruction)) return "in_app";
  return undefined;
}

export function AIStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const releaseId = searchParams.get("release") ?? defaultAIStudioReleaseId;
  const [release, setRelease] = useState<Release | null>(null);
  const [variants, setVariants] = useState<VariantMap>({});
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [brandVoice, setBrandVoice] = useState("");
  const [savedBrandVoice, setSavedBrandVoice] = useState("");
  const [brandVoiceLoading, setBrandVoiceLoading] = useState(true);
  const [activeScope, setActiveScope] = useState<StudioScope>("master");
  const [prompt, setPrompt] = useState("");
  const [generation, setGeneration] = useState<AIGeneration | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [qualityState, setQualityState] = useState<QualityState>({ status: "idle" });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [versionRevision, setVersionRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const loadRelease = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await releaseService.get(releaseId);
      setRelease(data);
      setVariants(data.channelVariants ?? {});
      setActiveScope("master");
      setGeneration(null);
      setQualityState({ status: "idle" });
      setUndoStack([]);
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not load this release.");
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    void loadRelease();
  }, [loadRelease]);

  useEffect(() => {
    let active = true;
    async function loadContext() {
      setBrandVoiceLoading(true);
      try {
        const [settings, availableAudiences] = await Promise.all([
          settingsService.get(),
          audienceService.list(),
        ]);
        if (!active) return;
        setBrandVoice(settings.brandVoice);
        setSavedBrandVoice(settings.brandVoice);
        setAudiences(availableAudiences);
      } catch {
        if (active) toast.error("Some AI Studio context could not be loaded.");
      } finally {
        if (active) setBrandVoiceLoading(false);
      }
    }
    void loadContext();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (generation?.status !== "generating") {
      setGenerationStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setGenerationStep((current) => Math.min(current + 1, 2));
    }, 380);
    return () => window.clearInterval(timer);
  }, [generation?.status]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const getDraft = useCallback((scope: StudioScope): StudioDraft => {
    if (!release) return { title: "", summary: "", body: "" };
    if (scope === "master") return toStudioDraft(release);
    return { ...defaultVariant(release, scope), ...variants[scope] };
  }, [release, variants]);

  const currentDraft = useMemo(() => getDraft(activeScope), [activeScope, getDraft]);
  const selectedAudience = useMemo(
    () => audiences.find((audience) => audience.id === release?.audienceId),
    [audiences, release?.audienceId]
  );
  const generationContext = useMemo<AIGenerationContext>(() => ({
    brandVoice,
    audience: selectedAudience
      ? { id: selectedAudience.id, name: selectedAudience.name, rules: selectedAudience.rules }
      : undefined,
    sourceRefs: release?.sourceRefs ?? [],
  }), [brandVoice, release?.sourceRefs, selectedAudience]);
  const canPublish = (release?.status === "approved" || release?.status === "scheduled") && (release?.channels.length ?? 0) > 0;

  const updateContent = useCallback((patch: Partial<StudioDraft>) => {
    if (!release) return;
    if (activeScope === "master") {
      setRelease((current) => current ? { ...current, ...patch } : current);
    } else {
      setVariants((current) => setChannelVariant(
        current,
        activeScope,
        { ...defaultVariant(release, activeScope), ...current[activeScope], ...patch }
      ));
    }
    setDirty(true);
    setQualityState({ status: "idle" });
  }, [activeScope, release]);

  const requestNavigation = useCallback((href: string) => {
    if (!dirty) {
      router.push(href);
      return;
    }
    setPendingNavigation(href);
    setShowUnsavedDialog(true);
  }, [dirty, router]);

  const updateChannels = useCallback((channels: Channel[]) => {
    setRelease((current) => current ? { ...current, channels } : current);
    if (activeScope !== "master" && !channels.includes(activeScope)) setActiveScope("master");
    setDirty(true);
  }, [activeScope]);

  const startGeneration = useCallback(async ({
    prompt: instruction,
    kind,
    targetScope,
    attempt = 0,
  }: GenerationRequest) => {
    if (!release) return;
    const before = getDraft(targetScope);
    const id = `generation_${Date.now()}`;

    if (targetScope !== "master" && !release.channels.includes(targetScope)) {
      setRelease((current) => current ? { ...current, channels: [...current.channels, targetScope] } : current);
      setDirty(true);
    }
    setActiveScope(targetScope);
    setPrompt(instruction);
    setGeneration({ id, status: "generating", kind, scope: targetScope, prompt: instruction, before, attempt });

    try {
      if (kind === "channel_variant" && targetScope !== "master") {
        const generated = await aiStudioService.generateChannelVariant(
          withChannelVariant(release, targetScope, before),
          targetScope,
          generationContext
        );
        const variant = generated.variant;
        const proposal: StudioDraft = {
          title: variant.title,
          summary: variant.summary,
          body: variant.body,
          subject: variant.subject,
          previewText: variant.previewText,
          format: variant.channel === "in_app" ? variant.format : undefined,
        };
        setGeneration((current) => current?.id === id
          ? {
            ...current,
            status: "success",
            proposal,
            summary: `${targetScope === "in_app" ? "In-app" : targetScope[0].toUpperCase() + targetScope.slice(1)} draft ready for review`,
            contextSummary: generated.contextSummary,
          }
          : current);
      } else {
        const result = await aiStudioService.rewrite(before.body, instruction, attempt, generationContext);
        const proposal = { ...before, body: result.content };
        setGeneration((current) => current?.id === id
          ? { ...current, status: "success", proposal, summary: result.summary, contextSummary: result.contextSummary }
          : current);
      }
    } catch (cause) {
      setGeneration((current) => current?.id === id
        ? { ...current, status: "error", error: cause instanceof Error ? cause.message : "AI generation failed." }
        : current);
    }
  }, [generationContext, getDraft, release]);

  const handlePromptSubmit = () => {
    if (!prompt.trim()) return;
    const targetChannel = inferredVariantChannel(prompt);
    void startGeneration({
      prompt,
      kind: targetChannel ? "channel_variant" : "rewrite",
      targetScope: targetChannel ?? activeScope,
    });
  };

  const handleAction = (action: typeof suggestedAIStudioActions[number]) => {
    void startGeneration({
      prompt: action.instruction,
      kind: action.kind ?? "rewrite",
      targetScope: action.targetChannel ?? activeScope,
    });
  };

  const applyGeneration = () => {
    if (!generation?.proposal || !release) return;
    const scope = generation.scope;
    const previousVariant = scope === "master" ? undefined : variants[scope];
    setUndoStack((current) => [...current, { scope, before: generation.before, previousVariant }]);

    if (scope === "master") {
      setRelease((current) => current ? { ...current, ...generation.proposal } : current);
    } else {
      setVariants((current) => setChannelVariant(current, scope, generation.proposal!));
      setRelease((current) => current && current.channels.includes(scope)
        ? current
        : current ? { ...current, channels: [...current.channels, scope] } : current);
    }
    setGeneration(null);
    setPrompt("");
    setDirty(true);
    setQualityState({ status: "idle" });
    toast.success("AI proposal applied. You can undo it at any time.");
  };

  const undoLastChange = () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((current) => current.slice(0, -1));
    const scope = entry.scope;
    if (scope === "master") {
      setRelease((current) => current ? { ...current, ...entry.before } : current);
    } else {
      setVariants((current) => {
        if (entry.previousVariant) return setChannelVariant(current, entry.previousVariant.channel, entry.previousVariant);
        return removeChannelVariant(current, scope);
      });
    }
    setDirty(true);
    setQualityState({ status: "idle" });
    toast.info("Last AI change undone.");
  };

  const runQualityCheck = async () => {
    setQualityState({ status: "loading" });
    try {
      const report = await aiStudioService.qualityCheck({
        title: currentDraft.title,
        summary: currentDraft.summary,
        body: currentDraft.body,
        cta: release?.cta,
      });
      setQualityState({ status: "success", data: report });
    } catch (cause) {
      setQualityState({ status: "error", error: cause instanceof Error ? cause.message : "Quality check could not run." });
    }
  };

  const persistDraft = useCallback(async () => {
    if (!release) throw new Error("Release not found");
    const shouldSaveBrandVoice = brandVoice !== savedBrandVoice;
    const [saved, savedSettings] = await Promise.all([
      releaseService.update(
        release.id,
        { ...release, channelVariants: variants },
        { changeNote: "AI Studio draft saved" }
      ),
      shouldSaveBrandVoice ? settingsService.update({ brandVoice }) : Promise.resolve(null),
    ]);
    setRelease(saved);
    setVariants(saved.channelVariants ?? variants);
    if (savedSettings) {
      setBrandVoice(savedSettings.brandVoice);
      setSavedBrandVoice(savedSettings.brandVoice);
    }
    setVersionRevision((current) => current + 1);
    return saved;
  }, [brandVoice, release, savedBrandVoice, variants]);

  const saveRelease = async () => {
    if (!release) return;
    setSaving(true);
    try {
      await persistDraft();
      setDirty(false);
      toast.success("Release, channel variants, and AI context saved (mock).");
    } catch {
      toast.error("We could not save your draft. Your edits remain in this workspace.");
    } finally {
      setSaving(false);
    }
  };

  const publishRelease = async () => {
    if (!release) return;
    if (release.channels.length === 0) {
      toast.error("Select at least one publishing channel before publishing.");
      return;
    }
    if (release.status !== "approved" && release.status !== "scheduled") {
      toast.error("Submit the release for review and approve it before publishing.");
      return;
    }
    setPublishing(true);
    try {
      if (dirty) {
        await persistDraft();
      }
      const published = await releaseService.publish(release.id);
      setRelease(published);
      setVariants(published.channelVariants ?? variants);
      setDirty(false);
      setVersionRevision((current) => current + 1);
      toast.success("Release published to the selected channels (mock).");
    } catch {
      toast.error("Publishing did not complete. Your draft is still safe.");
    } finally {
      setPublishing(false);
    }
  };

  const restoreVersion = async (version: ReleaseVersion) => {
    if (!release) return;
    if (dirty) {
      toast.error("Save or discard your current changes before restoring a version.");
      return;
    }
    try {
      const restored = await releaseService.restoreVersion(release.id, version.id);
      setRelease(restored);
      setVariants(restored.channelVariants ?? {});
      setActiveScope("master");
      setGeneration(null);
      setUndoStack([]);
      setDirty(false);
      setQualityState({ status: "idle" });
      setVersionRevision((current) => current + 1);
      toast.success(`Version ${version.version} restored and saved as a new version.`);
    } catch {
      toast.error("We could not restore that version. Your current draft is safe.");
    }
  };

  if (loading) return <LoadingState rows={7} />;
  if (error) return <ErrorState message={error} onRetry={loadRelease} />;
  if (!release) return null;

  return (
    <div className="space-y-4 pb-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button type="button" variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => requestNavigation(`/app/releases/${release.id}`)} aria-label="Back to release editor">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">AI Studio</p>
              <StatusBadge status={release.status} />
              {dirty && <Badge variant="outline" className="text-warning">Unsaved changes</Badge>}
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{release.title || "Untitled release"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create deliberate drafts across each selected communication channel.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={undoLastChange} disabled={undoStack.length === 0}>Undo AI change</Button>
          <Button type="button" variant="outline" onClick={saveRelease} disabled={saving || publishing}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
          <Button type="button" onClick={publishRelease} disabled={publishing || saving || !canPublish} title={!canPublish ? "Approve this release in the release editor before publishing" : undefined}>
            {publishing ? <Loader2 className="animate-spin" /> : <Send />}
            Publish
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        AI proposes; people review and publish. Your master release and channel versions are kept separate.
        <Check className="ml-auto size-3.5 shrink-0 text-success" aria-label="Human review required" />
      </div>

      <main className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.45fr)_minmax(17rem,0.72fr)]">
        <AIAssistantPanel
          actions={suggestedAIStudioActions}
          prompt={prompt}
          scope={activeScope}
          generation={generation}
          generationStep={generationStep}
          canUndo={undoStack.length > 0}
          onPromptChange={setPrompt}
          onAction={handleAction}
          onSubmit={handlePromptSubmit}
          onApply={applyGeneration}
          onTryAnother={() => generation && void startGeneration({ prompt: generation.prompt, kind: generation.kind, targetScope: generation.scope, attempt: generation.attempt + 1 })}
          onClearGeneration={() => setGeneration(null)}
          onUndo={undoLastChange}
        />

        <ReleaseCanvas
          activeScope={activeScope}
          selectedChannels={release.channels}
          content={currentDraft}
          release={release}
          audienceName={selectedAudience?.name}
          onScopeChange={setActiveScope}
          onContentChange={updateContent}
        />

        <AIStudioInspector
          release={release}
          audiences={audiences}
          brandVoice={brandVoice}
          brandVoiceLoading={brandVoiceLoading}
          qualityState={qualityState}
          versionHistoryRevision={versionRevision}
          onBrandVoiceChange={(value) => {
            setBrandVoice(value);
            setDirty(true);
          }}
          onChannelsChange={updateChannels}
          onAudienceChange={(audienceId) => {
            setRelease((current) => current ? { ...current, audienceId } : current);
            setDirty(true);
          }}
          onRunQualityCheck={() => void runQualityCheck()}
          onRestoreVersion={restoreVersion}
        />
      </main>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onStay={() => {
          setShowUnsavedDialog(false);
          setPendingNavigation(null);
        }}
        onDiscard={() => {
          const destination = pendingNavigation;
          setDirty(false);
          setShowUnsavedDialog(false);
          setPendingNavigation(null);
          if (destination) router.push(destination);
        }}
      />
    </div>
  );
}
