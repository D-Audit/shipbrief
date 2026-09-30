"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder = "Add a tag",
  id,
  suggestions = [],
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
  suggestions?: string[];
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };

  const unused = suggestions.filter((tag) => !value.includes(tag)).slice(0, 5);

  return (
    <div className={className}>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-surface px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
        {value.map((tag) => (
          <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-subtle pr-1 pl-2 text-xs ring-1 ring-border">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Remove tag ${tag}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-6 min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {unused.map((tag) => (
            <button key={tag} type="button" onClick={() => add(tag)} className={cn("rounded-md px-1.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border ring-dashed transition-colors hover:text-foreground")}>
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
