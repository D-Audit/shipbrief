"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReleaseStatus } from "@/types";

const LIFECYCLE: { status: ReleaseStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "in_review", label: "Review" },
  { status: "approved", label: "Approved" },
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
];

const STATUS_ORDER: ReleaseStatus[] = ["draft", "in_review", "approved", "scheduled", "published", "archived"];

const nextStep: Partial<Record<ReleaseStatus, string>> = {
  draft: "When it reads well, send it to a teammate for review.",
  in_review: "A reviewer approves the copy before anything goes out.",
  approved: "Approved. Publish now, or schedule it for later.",
  scheduled: "Scheduled. You can still publish it now.",
  published: "Live in the selected channels.",
  archived: "Archived. It no longer appears to customers.",
};

interface ApprovalBarProps {
  status: ReleaseStatus;
  scheduledAt?: string;
  createdBy?: string;
  reviewedBy?: string;
  publishedBy?: string;
  onSubmitReview?: () => void;
  onApprove?: () => void;
  onSchedule?: () => void;
  onPublish?: () => void;
  onArchive?: () => void;
  loading?: boolean;
}

/** Review & publish: where the release is, who touched it, and the one next action. */
export function ApprovalBar({
  status,
  scheduledAt,
  createdBy,
  reviewedBy,
  publishedBy,
  onSubmitReview,
  onApprove,
  onSchedule,
  onPublish,
  onArchive,
  loading,
}: ApprovalBarProps) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const people = [
    createdBy && `Written by ${createdBy}`,
    reviewedBy && `reviewed by ${reviewedBy}`,
    publishedBy && `published by ${publishedBy}`,
  ].filter(Boolean);

  return (
    <section aria-labelledby="review-heading" className="sb-panel space-y-4 p-4">
      <div>
        <h2 id="review-heading" className="sb-title-section">Review & publish</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{nextStep[status]}</p>
      </div>

      <ol className="flex items-center gap-1" aria-label="Release progress">
        {LIFECYCLE.map((step) => {
          const stepIndex = STATUS_ORDER.indexOf(step.status);
          const done = currentIndex >= stepIndex && status !== "archived";
          return (
            <li key={step.status} className="min-w-0 flex-1" aria-current={status === step.status ? "step" : undefined}>
              <span className={cn("block h-1 rounded-full", done ? "bg-foreground" : "bg-muted")} />
              <span className={cn("mt-1.5 block truncate text-[11px]", status === step.status ? "font-medium text-foreground" : "text-muted-foreground")}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {(people.length > 0 || (scheduledAt && status === "scheduled")) && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {people.join(", ")}
          {scheduledAt && status === "scheduled" && `${people.length ? " · " : ""}Goes out ${new Date(scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "draft" && onSubmitReview && <ActionButton onClick={onSubmitReview} loading={loading} label="Submit for review" />}
        {status === "in_review" && onApprove && <ActionButton onClick={onApprove} loading={loading} label="Approve" />}
        {(status === "approved" || status === "scheduled") && onPublish && <ActionButton onClick={onPublish} loading={loading} label="Publish now" />}
        {status === "approved" && onSchedule && <ActionButton onClick={onSchedule} loading={loading} variant="outline" label="Schedule" />}
        {status === "published" && onArchive && <ActionButton onClick={onArchive} loading={loading} variant="outline" label="Archive" />}
      </div>
    </section>
  );
}

function ActionButton({ onClick, loading, label, variant = "default" }: { onClick: () => void; loading?: boolean; label: string; variant?: "default" | "outline" }) {
  return (
    <Button type="button" variant={variant} onClick={onClick} disabled={loading} className="flex-1">
      {loading && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}
