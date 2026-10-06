import { config } from "../config/env.js";
import type { ReleaseMedia } from "../types/domain.js";
import { escapeHtml, sanitizeRichText } from "../utils/html.js";
import { latestPublicReleases, toPublicRelease } from "./changelog.service.js";
import { getPublicChangelogWorkspace, publicChangelogUrls } from "./workspace.service.js";

/**
 * RSS 2.0 feed of a workspace's public changelog. It reads the same published
 * releases, through the same visibility rule, as the changelog pages — there is
 * no separate feed data.
 */

export const FEED_SIZE = 50;

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  /** Sanitised rich-text HTML. */
  body: string;
  publishedAt: string;
  category: string;
  tags: string[];
  media?: ReleaseMedia[];
  author?: string;
};

export type FeedChannel = {
  title: string;
  description: string;
  url: string;
  feedUrl: string;
  imageUrl?: string | null;
};

// Characters XML 1.0 forbids outright (control characters other than tab/newline/CR, lone surrogates, U+FFFE/U+FFFF).
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function escapeXml(value: string) {
  return value
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const appOrigin = () => new URL(config.APP_URL).origin;

/** Feed readers have no base URL, so root-relative links (uploaded files) become absolute. */
function absolute(url: string) {
  return url.startsWith("/") && !url.startsWith("//") ? `${appOrigin()}${url}` : url;
}

function absolutizeHtml(html: string) {
  return html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${appOrigin()}/`);
}

/** The item's full content: the sanitised body, then its images and videos. */
function contentHtml(item: FeedItem) {
  const media = (item.media ?? [])
    .filter((entry) => /^(https?:\/\/|\/(?!\/))/.test(entry.url))
    .map((entry) => {
      const src = escapeHtml(absolute(entry.url));
      const alt = escapeHtml(entry.alt ?? "");
      const caption = entry.caption ? `<br>${escapeHtml(entry.caption)}` : "";
      return entry.type === "image" ? `<p><img src="${src}" alt="${alt}">${caption}</p>` : `<p><a href="${src}">Watch the video</a>${caption}</p>`;
    })
    .join("");
  return absolutizeHtml(sanitizeRichText(item.body)) + media;
}

const rfc822 = (iso: string) => new Date(iso).toUTCString();

export function renderRss(channel: FeedChannel, items: FeedItem[]) {
  const tag = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;
  const lastBuild = items[0]?.publishedAt ?? new Date().toISOString();
  const image = channel.imageUrl && /^(https?:\/\/|\/(?!\/))/.test(channel.imageUrl)
    ? `<image>${tag("url", absolute(channel.imageUrl))}${tag("title", channel.title)}${tag("link", channel.url)}</image>`
    : "";

  const entries = items.map((item) => {
    const categories = [item.category, ...item.tags].filter(Boolean).map((value) => tag("category", value)).join("");
    return [
      "<item>",
      tag("title", item.title),
      tag("link", item.url),
      // Stable even if the changelog moves to a custom domain, so readers never see duplicates.
      `<guid isPermaLink="false">${escapeXml(`shipbrief:release:${item.id}`)}</guid>`,
      tag("pubDate", rfc822(item.publishedAt)),
      item.author ? tag("dc:creator", item.author) : "",
      categories,
      tag("description", item.summary),
      tag("content:encoded", contentHtml(item)),
      "</item>",
    ].join("");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "<channel>",
    tag("title", channel.title),
    tag("link", channel.url),
    tag("description", channel.description),
    `<atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    tag("lastBuildDate", rfc822(lastBuild)),
    tag("generator", "ShipBrief"),
    image,
    ...entries,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}

export async function buildChangelogFeed(workspaceSlug: string) {
  const workspace = await getPublicChangelogWorkspace(workspaceSlug);
  const urls = publicChangelogUrls(workspace);
  const rows = await latestPublicReleases(workspace, FEED_SIZE);
  const items: FeedItem[] = rows.map(({ release, author }) => {
    const publicRelease = toPublicRelease(release, author);
    return {
      id: publicRelease.id,
      title: publicRelease.title,
      url: urls.releaseUrl(publicRelease.slug),
      summary: publicRelease.summary,
      body: publicRelease.body,
      publishedAt: publicRelease.publishedAt,
      category: publicRelease.category,
      tags: publicRelease.tags,
      media: publicRelease.media,
      author: publicRelease.author?.name,
    };
  });
  return renderRss(
    {
      title: `${workspace.name} changelog`,
      description: `Product updates from ${workspace.name}.`,
      url: urls.url,
      feedUrl: urls.rssUrl,
      imageUrl: workspace.logoUrl,
    },
    items,
  );
}
