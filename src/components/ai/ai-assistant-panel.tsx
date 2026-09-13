"use client";

import { Bot, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AIAction } from "@/types";
import { AIActionButton } from "./ai-action";
import { GenerationState } from "./generation-state";
import { PromptInput } from "./prompt-input";
import type { AIGeneration, StudioScope } from "./types";

export function AIAssistantPanel({
  actions,
  prompt,
  scope,
  generation,
  generationStep,
  canUndo,
  onPromptChange,
  onAction,
  onSubmit,
  onApply,
  onTryAnother,
  onClearGeneration,
  onUndo,
}: {
  actions: AIAction[];
  prompt: string;
  scope: StudioScope;
  generation: AIGeneration | null;
  generationStep: number;
  canUndo: boolean;
  onPromptChange: (value: string) => void;
  onAction: (action: AIAction) => void;
  onSubmit: () => void;
  onApply: () => void;
  onTryAnother: () => void;
  onClearGeneration: () => void;
  onUndo: () => void;
}) {
  return (
    <aside className="sb-panel-raised flex min-w-0 flex-col p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI assistant</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Working with the {scope === "master" ? "master release" : `${scope.replace("_", "-")} version`}.</p>
          </div>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onUndo} disabled={!canUndo} aria-label="Undo last applied AI change">
          <Undo2 />
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {actions.map((action) => (
          <AIActionButton key={action.id} action={action} onSelect={onAction} disabled={generation?.status === "generating"} />
        ))}
      </div>

      <div className="mt-4">
        <PromptInput
          value={prompt}
          onChange={onPromptChange}
          onSubmit={onSubmit}
          disabled={generation?.status === "generating"}
        />
      </div>

      {generation && (
        <div className="mt-4">
          <GenerationState
            generation={generation}
            step={generationStep}
            onApply={onApply}
            onTryAnother={onTryAnother}
            onContinueManually={onClearGeneration}
          />
        </div>
      )}
    </aside>
  );
}
