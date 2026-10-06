import Link from "next/link";
import { MessageCircle, Pin, ThumbsUp } from "lucide-react";
import { formatPublicDate, releaseHref } from "./public-format";
import type { PublicRelease } from "@/types";

export function UpdateCard({
  basePath,
  release,
  featured = false,
}: {
  basePath: string;
  release: PublicRelease;
  featured?: boolean;
}) {
  return (
    <article>
      <Link
        href={releaseHref(basePath, release.slug)}
        className={featured
          ? "block rounded-xl border border-border-strong bg-surface-subtle p-5 transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-muted sm:p-6"
          : "block border-b border-border pb-6 transition-colors hover:opacity-80"}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {featured && <span className="inline-flex items-center gap-1 font-medium text-primary-strong"><Pin className="size-3" />Featured</span>}
          <span>{release.category}</span>
          <span aria-hidden="true">/</span>
          <time dateTime={release.publishedAt}>{formatPublicDate(release.publishedAt)}</time>
          {release.author && <><span aria-hidden="true">/</span><span>{release.author.name}</span></>}
        </div>
        <h2 className={featured ? "mt-2 text-2xl font-semibold tracking-tight" : "mt-1 text-lg font-semibold"}>{release.title}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">{release.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" aria-hidden="true" /><span className="sr-only">Reactions: </span>{release.reactions}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" aria-hidden="true" /><span className="sr-only">Comments: </span>{release.comments}</span>
          {release.tags.slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      </Link>
    </article>
  );
}
