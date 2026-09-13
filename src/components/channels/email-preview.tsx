"use client";

import { ArrowUpRight, Mail } from "lucide-react";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudioDraft } from "@/components/ai";
import type { Release } from "@/types";

export type EmailPreviewViewport = "desktop" | "mobile";

export function EmailPreview({
  content,
  cta,
  audienceName,
  from,
  replyTo,
  viewport = "desktop",
  id,
}: {
  content: StudioDraft;
  cta?: Release["cta"];
  audienceName?: string;
  from?: string;
  replyTo?: string;
  viewport?: EmailPreviewViewport;
  id?: string;
}) {
  const sender = from?.trim() || "Acme Product Team";
  const audience = audienceName || "Selected audience";
  const replyAddress = replyTo?.trim() || sender;
  const isMobile = viewport === "mobile";

  return (
    <div
      className={cn(
        "mx-auto w-full transition-[max-width] duration-200 motion-reduce:transition-none",
        isMobile ? "max-w-[23rem]" : "max-w-2xl"
      )}
    >
      <article
        id={id}
        aria-label={`${isMobile ? "Mobile" : "Desktop"} email preview`}
        className={cn(
          "overflow-hidden border border-border bg-background shadow-sm",
          isMobile ? "rounded-[1.75rem] border-[5px] border-foreground/15" : "rounded-xl"
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center border-b border-border bg-surface-subtle/70 px-4 text-[11px] font-medium text-muted-foreground",
            isMobile ? "h-8 justify-center" : "h-9 gap-1.5"
          )}
        >
          {isMobile ? (
            <span className="h-1.5 w-14 rounded-full bg-foreground/15" />
          ) : (
            <>
              <span className="size-2 rounded-full bg-destructive/60" />
              <span className="size-2 rounded-full bg-warning/70" />
              <span className="size-2 rounded-full bg-success/60" />
              <span className="ml-2">Email preview</span>
            </>
          )}
        </div>
        <div className={cn("border-b border-border bg-surface-subtle/70 text-xs text-muted-foreground", isMobile ? "px-4 py-3" : "px-5 py-3")}>
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="size-3.5" /></span>
            <dl className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 gap-1.5">
                <dt className="shrink-0">From</dt>
                <dd className="truncate font-medium text-foreground">{sender}</dd>
              </div>
              <div className="flex min-w-0 gap-1.5">
                <dt className="shrink-0">To</dt>
                <dd className="truncate">{audience}</dd>
              </div>
              <div className="flex min-w-0 gap-1.5">
                <dt className="shrink-0">Reply-to</dt>
                <dd className="truncate">{replyAddress}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className={cn("p-5", !isMobile && "sm:p-8")}>
          <p className="text-xs text-muted-foreground">Subject</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{content.subject || content.title || "Untitled release"}</h2>
          {content.previewText && <p className="mt-2 text-sm text-muted-foreground">{content.previewText}</p>}
          <div className="mt-6 border-t border-border pt-5">
            <RichTextPreview html={content.body} />
          </div>
          {cta?.label && (
            <Button type="button" size="sm" className="mt-6">
              {cta.label}
              <ArrowUpRight />
            </Button>
          )}
        </div>
      </article>
    </div>
  );
}
