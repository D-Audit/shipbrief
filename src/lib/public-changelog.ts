import { cache } from "react";
import { PUBLIC_PAGE_SIZE, type PublicWorkspace } from "@/lib/services";
import type { PublicRelease } from "@/types";

/**
 * Server-side data for the public changelog (/c/[workspace]).
 * Pages render on the server so visitors, search engines and link previews get
 * real HTML. Responses are shared between visitors for a short time, so a busy
 * changelog doesn't turn into one API request per page view.
 */

const REVALIDATE_SECONDS = 30;

const apiBase = () => (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");

type Envelope<T> = { success: true; data: T; meta?: { hasMore: boolean; total: number } } | { success: false };

/** GET a public endpoint. Null when it doesn't exist (unknown workspace, changelog off, unpublished update). */
async function publicGet<T>(path: string): Promise<{ data: T; meta?: { hasMore: boolean; total: number } } | null> {
  const response = await fetch(`${apiBase()}/api/public${path}`, { headers: { Accept: "application/json" }, next: { revalidate: REVALIDATE_SECONDS } });
  if (response.status === 404 || response.status === 400) return null;
  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !envelope?.success) throw new Error(`Changelog request failed (${response.status})`);
  return { data: envelope.data, meta: envelope.meta };
}

const ws = (slug: string) => `/workspaces/${encodeURIComponent(slug)}`;

export const getPublicWorkspace = cache(async (slug: string) => (await publicGet<PublicWorkspace>(ws(slug)))?.data ?? null);

export const getPublicReleasePage = cache(async (slug: string, page = 1) => {
  const result = await publicGet<PublicRelease[]>(`${ws(slug)}/releases?page=${page}&pageSize=${PUBLIC_PAGE_SIZE}`);
  if (!result) return null;
  return { items: result.data, hasMore: result.meta?.hasMore ?? false };
});

export const getPublicRelease = cache(async (slug: string, releaseSlug: string) => (await publicGet<PublicRelease>(`${ws(slug)}/releases/${encodeURIComponent(releaseSlug)}`))?.data ?? null);

/** Uploaded files are root-relative (/api/files/...). */
export function absoluteAssetUrl(url: string | null | undefined, changelogUrl: string) {
  if (!url) return undefined;
  try {
    const absolute = new URL(url, changelogUrl);
    return absolute.protocol === "https:" || absolute.protocol === "http:" ? absolute.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Where links on the changelog point. */
export const changelogBasePath = (slug: string) => `/c/${slug}`;
