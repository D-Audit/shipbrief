"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The AI instruction box: a roomy field with the Generate action tucked in its corner. */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-input bg-surface transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <label htmlFor="ai-studio-prompt" className="sr-only">
        Tell AI what to change
      </label>
      <Textarea
        id="ai-studio-prompt"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        rows={4}
        aria-describedby="ai-studio-prompt-hint"
        className="min-h-24 resize-none border-0 bg-transparent px-3.5 pt-3 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        placeholder="Describe the change you want — e.g. “Lead with the time customers save and keep it under 60 words.”"
      />
      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <span id="ai-studio-prompt-hint" className="text-xs text-muted-foreground">
          Press Enter to generate
        </span>
        <Button type="button" size="sm" onClick={onSubmit} disabled={disabled || !value.trim()} aria-label="Generate AI proposal">
          {disabled ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          Generate
        </Button>
      </div>
    </div>
  );
}
