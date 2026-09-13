import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Sparkles } from "lucide-react";
import type { Release } from "@/types";
import { StatusBadge } from "@/components/shared/page-states";
import { cn } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = {
  changelog: "Changelog",
  email: "Email",
  in_app: "In-App",
};

interface ReleaseCardProps {
  release: Release;
  className?: string;
}

export function ReleaseCard({ release, className }: ReleaseCardProps) {
  return (
    <Link
      href={`/app/releases/${release.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium group-hover:text-primary">{release.title}</p>
          {release.sourceRefs.some((s) => s.type === "github" || s.type === "linear") && (
            <Sparkles className="size-3.5 text-primary/60" aria-label="AI-assisted" />
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{release.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{release.category}</span>
          <span>·</span>
          <span>
            Updated {formatDistanceToNow(new Date(release.updatedAt), { addSuffix: true })}
          </span>
          {release.scheduledAt && release.status === "scheduled" && (
            <>
              <span>·</span>
              <span>Scheduled {new Date(release.scheduledAt).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={release.status} />
        {release.channels.map((ch) => (
          <span
            key={ch}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {CHANNEL_LABELS[ch] ?? ch}
          </span>
        ))}
      </div>
    </Link>
  );
}
