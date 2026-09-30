import { cn } from "@/lib/utils";
import type { IntegrationProvider } from "@/types";

export const integrationMeta: Record<IntegrationProvider, { name: string; monogram: string; source: string; description: string }> = {
  github: { name: "GitHub", monogram: "Gh", source: "Repositories", description: "Merged pull requests and releases become drafts." },
  linear: { name: "Linear", monogram: "Li", source: "Teams & projects", description: "Completed issues explain the customer intent." },
  gitlab: { name: "GitLab", monogram: "Gl", source: "Projects", description: "Merge requests and tags feed the same workflow." },
  jira: { name: "Jira", monogram: "Ji", source: "Projects & epics", description: "Done epics and stories add product context." },
};

/** Neutral monogram tile for a source integration. */
export function IntegrationMark({ provider, size = "md", className }: { provider: IntegrationProvider; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = integrationMeta[provider];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface font-semibold tracking-[-0.03em] text-foreground",
        size === "sm" && "size-7 rounded-md text-[11px]",
        size === "md" && "size-9 text-[13px]",
        size === "lg" && "size-11 text-[15px]",
        className
      )}
    >
      {meta.monogram}
    </span>
  );
}
