import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicUpdatePage } from "@/components/public/public-update";
import { absoluteAssetUrl, changelogBasePath, getPublicRelease, getPublicWorkspace } from "@/lib/public-changelog";

type PageProps = {
  params: Promise<{ workspace: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { workspace, slug } = await params;
  const [data, release] = await Promise.all([getPublicWorkspace(workspace).catch(() => null), getPublicRelease(workspace, slug).catch(() => null)]);
  if (!data || !release) return { title: { absolute: "Update not found" }, robots: { index: false } };

  const title = release.seo?.title || release.title;
  const description = release.seo?.description || release.summary;
  const url = `${data.url}/${release.slug}`;
  const image = absoluteAssetUrl(release.media?.find((media) => media.type === "image")?.url ?? data.branding.logoUrl, data.url);
  return {
    title: { absolute: `${title} · ${data.name}` },
    description,
    alternates: {
      canonical: url,
      types: { "application/rss+xml": [{ url: data.rssUrl, title: `${data.name} changelog` }] },
    },
    openGraph: {
      type: "article",
      title,
      description,
      siteName: data.name,
      url,
      publishedTime: release.publishedAt,
      authors: release.author ? [release.author.name] : undefined,
      images: image ? [image] : undefined,
    },
    twitter: { card: "summary", title, description },
    icons: data.branding.faviconUrl ? { icon: data.branding.faviconUrl } : undefined,
  };
}

export default async function Page({ params }: PageProps) {
  const { workspace, slug } = await params;
  const [data, release, basePath] = await Promise.all([getPublicWorkspace(workspace), getPublicRelease(workspace, slug), changelogBasePath(workspace)]);
  if (!data || !release) notFound();
  return <PublicUpdatePage workspace={data} release={release} basePath={basePath} />;
}
