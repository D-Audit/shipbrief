"use client";

import type { AIAction } from "@/types";
import { AIActionButton } from "./ai-action";
import { PromptInput } from "./prompt-input";
import type { AIGeneration, StudioScope } from "./types";

const scopeLabel: Record<StudioScope, string> = {
  master: "Master release",
  changelog: "Changelog version",
  email: "Email version",
  in_app: "In-app version",
};

/**
 * "Ask AI": the instruction box and one-click actions, kept together in the
 * side column so the place to type is always visible. Proposals render next
 * to the content in the main column, where there is room to compare.
 */
export function AIAssistantPanel({
  actions,
  prompt,
  scope,
  generation,
  onPromptChange,
  onAction,
  onSubmit,
}: {
  actions: AIAction[];
  prompt: string;
  scope: StudioScope;
  generation: AIGeneration | null;
  onPromptChange: (value: string) => void;
  onAction: (action: AIAction) => void;
  onSubmit: () => void;
}) {
  const generating = generation?.status === "generating";

  return (
    <section aria-labelledby="ask-ai-heading" className="sb-panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ask-ai-heading" className="sb-title-section">Ask AI</h2>
        <span className="sb-meta">{scopeLabel[scope]}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Suggestions appear beside your draft. Nothing changes until you apply them.</p>

      <div className="mt-4">
        <PromptInput value={prompt} onChange={onPromptChange} onSubmit={onSubmit} disabled={generating} />
      </div>

      <p className="sb-eyebrow mt-5">Quick actions</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <AIActionButton key={action.id} action={action} onSelect={onAction} disabled={generating} />
        ))}
      </div>
    </section>
  );
}
