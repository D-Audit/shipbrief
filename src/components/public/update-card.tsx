import Link from "next/link";
import { format } from "date-fns";
import { MessageCircle, Pin, ThumbsUp } from "lucide-react";
import type { Release } from "@/types";

export function UpdateCard({
  workspace,
  release,
  featured = false,
}: {
  workspace: string;
  release: Release;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/c/${workspace}/${release.slug}`}
      className={featured
        ? "block rounded-xl border border-primary/20 bg-primary/5 p-5 transition-colors hover:bg-primary/10 sm:p-6"
        : "block border-b border-border pb-6 transition-colors hover:opacity-80"}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {featured && <span className="inline-flex items-center gap-1 font-medium text-primary"><Pin className="size-3" />Featured</span>}
        <span>{release.category}</span>
        <span aria-hidden="true">/</span>
        <span>{release.publishedAt && format(new Date(release.publishedAt), "MMMM d, yyyy")}</span>
      </div>
      <h2 className={featured ? "mt-2 text-2xl font-semibold tracking-tight" : "mt-1 text-lg font-semibold"}>{release.title}</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">{release.summary}</p>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" />{release.reactions}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" />{release.comments}</span>
      </div>
    </Link>
  );
}
