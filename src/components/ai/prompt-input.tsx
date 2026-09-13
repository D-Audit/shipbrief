"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="rounded-xl border border-border bg-background p-2 shadow-sm">
      <label htmlFor="ai-studio-prompt" className="sr-only">
        Ask ShipBrief AI
      </label>
      <Textarea
        id="ai-studio-prompt"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        rows={3}
        className="min-h-20 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0"
        placeholder="Ask AI to rewrite, extract benefits, or create a channel version..."
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="size-3 text-primary" />
          Uses your release context and brand voice
        </span>
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Generate AI proposal"
        >
          <ArrowUp />
          Generate
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Ctrl + Enter to generate</p>
    </div>
  );
}
