import Link from "next/link";
import { PublicFeedbackDialog } from "./public-feedback-dialog";
import { ShipBriefLogo } from "@/components/brand";
import type { WorkspaceBranding } from "@/types";

function workspaceName(workspace: string) {
  return workspace
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function PublicHeader({
  workspace,
  branding,
}: {
  workspace: string;
  branding: WorkspaceBranding;
}) {
  const name = workspaceName(workspace) || "ShipBrief";

  return (
    <header
      className="border-b border-border border-t-2 bg-surface/90"
      style={{ borderTopColor: branding.accentColor }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href={`/c/${workspace}`} aria-label={`Back to ${name} changelog`} className="flex items-center gap-2">
          <ShipBriefLogo showWordmark={false} />
          <span className="text-base font-semibold tracking-tight text-foreground">{name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <PublicFeedbackDialog workspace={workspace} />
          <span className="hidden text-sm font-medium sm:inline" style={{ color: branding.accentColor }}>What&apos;s New</span>
        </div>
      </div>
    </header>
  );
}
