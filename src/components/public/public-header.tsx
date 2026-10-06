/* eslint-disable @next/next/no-img-element -- workspace logos are customer-uploaded URLs of any size. */
import Link from "next/link";
import { Rss } from "lucide-react";
import { PublicFeedbackDialog } from "./public-feedback-dialog";
import { changelogHome } from "./public-format";
import { ShipBriefLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { WorkspaceBranding } from "@/types";

export function PublicHeader({
  workspace,
  name,
  branding,
  basePath,
  rssUrl,
}: {
  workspace: string;
  name: string;
  branding: WorkspaceBranding;
  basePath: string;
  rssUrl: string;
}) {
  return (
    <header
      className="border-b border-border border-t-2 bg-surface/90"
      style={{ borderTopColor: branding.accentColor }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link href={changelogHome(basePath)} aria-label={`${name} changelog home`} className="flex min-w-0 items-center gap-2">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-6 w-auto max-w-[8rem] shrink-0 object-contain" />
          ) : (
            <ShipBriefLogo showWordmark={false} />
          )}
          <span className="truncate text-base font-semibold tracking-tight text-foreground">{name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <PublicFeedbackDialog workspace={workspace} name={name} />
          <a
            href={rssUrl}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
            title="Subscribe with an RSS reader"
          >
            <Rss className="size-3.5" aria-hidden="true" />
            <span>RSS</span>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
