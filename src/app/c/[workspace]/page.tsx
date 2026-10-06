import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicChangelogPage } from "@/components/public/public-changelog";
import { absoluteAssetUrl, changelogBasePath, getPublicReleasePage, getPublicWorkspace } from "@/lib/public-changelog";

type PageProps = {
  params: Promise<{ workspace: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { workspace } = await params;
  const data = await getPublicWorkspace(workspace).catch(() => null);
  if (!data) return { title: { absolute: "Changelog not found" }, robots: { index: false } };

  const title = `What’s new at ${data.name}`;
  const description = `New features, improvements and fixes in ${data.name}.`;
  const logo = absoluteAssetUrl(data.branding.logoUrl, data.url);
  return {
    title: { absolute: title },
    description,
    // The custom domain, once connected, is the address search engines should index.
    alternates: {
      canonical: data.url,
      types: { "application/rss+xml": [{ url: data.rssUrl, title: `${data.name} changelog` }] },
    },
    openGraph: { type: "website", title, description, siteName: data.name, url: data.url, images: logo ? [logo] : undefined },
    twitter: { card: "summary", title, description },
    icons: data.branding.faviconUrl ? { icon: data.branding.faviconUrl } : undefined,
  };
}

export default async function Page({ params }: PageProps) {
  const { workspace } = await params;
  const [data, firstPage, basePath] = await Promise.all([getPublicWorkspace(workspace), getPublicReleasePage(workspace), changelogBasePath(workspace)]);
  if (!data || !firstPage) notFound();
  return <PublicChangelogPage workspace={data} basePath={basePath} initialReleases={firstPage.items} initialHasMore={firstPage.hasMore} />;
}
