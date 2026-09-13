"use client";

import { ArrowUpRight } from "lucide-react";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import type { StudioDraft } from "@/components/ai";
import type { Release } from "@/types";

export function ChangelogPreview({
  content,
  category,
  cta,
}: {
  content: StudioDraft;
  category: Release["category"];
  cta?: Release["cta"];
}) {
  return (
    <article className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-background p-5 sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">{category}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{content.title || "Untitled release"}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {content.summary || "A customer-value summary will appear here."}
      </p>
      <div className="mt-6 border-t border-border pt-5">
        <RichTextPreview html={content.body} />
      </div>
      {cta?.label && (
        <Button type="button" size="sm" className="mt-6">
          {cta.label}
          <ArrowUpRight />
        </Button>
      )}
    </article>
  );
}
