"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReleaseStatus } from "@/types";

const LIFECYCLE: { status: ReleaseStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "in_review", label: "In Review" },
  { status: "approved", label: "Approved" },
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
];

const STATUS_ORDER: ReleaseStatus[] = [
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "published",
  "archived",
];

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

  return (
    <div className="sb-panel space-y-4 p-4">
      <div>
        <p className="text-sm font-medium">Approval workflow</p>
        <p className="text-xs text-muted-foreground">
          Draft → In Review → Approved → Scheduled → Published
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LIFECYCLE.map((step, i) => {
          const stepIndex = STATUS_ORDER.indexOf(step.status);
          const isComplete = currentIndex > stepIndex;
          const isCurrent = status === step.status;
          const isScheduledStep = step.status === "scheduled" && status === "scheduled";

          return (
            <div key={step.status} className="flex items-center gap-2">
              {i > 0 && <div className="hidden h-px w-4 bg-border sm:block" />}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  isComplete || isScheduledStep
                    ? "bg-success-muted text-success"
                    : isCurrent
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isComplete || isScheduledStep ? (
                  <Check className="size-3" />
                ) : (
                  <Circle className="size-3" />
                )}
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {(createdBy || reviewedBy || publishedBy) && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {createdBy && <span>Created by {createdBy}</span>}
          {reviewedBy && <span>Reviewed by {reviewedBy}</span>}
          {publishedBy && <span>Published by {publishedBy}</span>}
          {scheduledAt && status === "scheduled" && (
            <span>Scheduled: {new Date(scheduledAt).toLocaleString()}</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {status === "draft" && onSubmitReview && (
          <ActionButton onClick={onSubmitReview} loading={loading} label="Submit for review" />
        )}
        {status === "in_review" && onApprove && (
          <ActionButton onClick={onApprove} loading={loading} label="Approve" />
        )}
        {status === "approved" && onSchedule && (
          <ActionButton onClick={onSchedule} loading={loading} variant="outline" label="Schedule" />
        )}
        {(status === "approved" || status === "scheduled") && onPublish && (
          <ActionButton onClick={onPublish} loading={loading} label="Publish" />
        )}
        {status === "published" && onArchive && (
          <ActionButton onClick={onArchive} loading={loading} variant="outline" label="Archive" />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  label,
  variant = "default",
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
  variant?: "default" | "outline";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "default"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}
