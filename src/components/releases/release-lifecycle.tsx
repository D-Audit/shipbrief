"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { Release, ReleaseStatus } from "@/types";

export const lifecycleSteps: { status: ReleaseStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "in_review", label: "In review" },
  { status: "approved", label: "Approved" },
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
];

const order: ReleaseStatus[] = ["draft", "in_review", "approved", "scheduled", "published", "archived"];

/** What the release is waiting for, in plain language. */
export function lifecycleSummary(release: Release) {
  switch (release.status) {
    case "draft":
      return release.reviewNote ? "Changes were requested. Update the draft and resubmit." : "Being written. Submit for review when it’s ready.";
    case "in_review":
      return "Waiting for a teammate to approve or request changes.";
    case "approved":
      return release.scheduledAt ? "Approved. Confirm the schedule or publish now." : "Approved and ready. Publish now or pick a time.";
    case "scheduled":
      return "Scheduled. It will go out automatically at the chosen time.";
    case "published":
      return "Live on the selected channels.";
    case "archived":
      return "Archived. Hidden from the public changelog.";
  }
}

export function LifecycleStepper({ release, className }: { release: Release; className?: string }) {
  const reduce = useReducedMotion();
  const current = order.indexOf(release.status);
  // A release published without scheduling skips that step; show it as passed.
  const actors: Partial<Record<ReleaseStatus, string | undefined>> = {
    draft: release.createdBy,
    approved: release.reviewedBy,
    published: release.publishedBy,
  };

  return (
    <ol className={cn("flex items-center gap-2 overflow-x-auto sb-scrollbar-none", className)} aria-label="Release progress">
      {lifecycleSteps.map((step, index) => {
        const stepIndex = order.indexOf(step.status);
        const done = current > stepIndex || release.status === "archived";
        const active = release.status === step.status;
        return (
          <li key={step.status} className="flex min-w-0 shrink-0 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "relative flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-300",
                done && "bg-foreground text-background",
                active && "bg-primary text-primary-foreground",
                !done && !active && "border border-border-strong text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              {active && !reduce && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full ring-2 ring-primary-strong/30"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.35, opacity: [0, 1, 0] }}
                  transition={{ duration: 1.6, repeat: 2 }}
                />
              )}
            </span>
            <span className="flex flex-col leading-tight">
              <span className={cn("text-[13px] whitespace-nowrap", active ? "font-semibold" : done ? "font-medium" : "text-muted-foreground")}>{step.label}</span>
              {actors[step.status] && (done || active) && <span className="text-[11px] whitespace-nowrap text-muted-foreground">{actors[step.status]}</span>}
            </span>
            {index < lifecycleSteps.length - 1 && (
              <span aria-hidden="true" className={cn("mx-1 h-px w-6 shrink-0 transition-colors duration-500 sm:w-10", done ? "bg-foreground/50" : "bg-border-strong")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
