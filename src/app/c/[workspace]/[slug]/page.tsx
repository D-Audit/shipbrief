import type { Metadata } from "next";
import { PublicUpdatePage } from "@/components/public/public-update";
import { changelogService } from "@/lib/services";

type PageProps = {
  params: Promise<{ workspace: string; slug: string }>;
};

function workspaceName(workspace: string) {
  return workspace
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { workspace, slug } = await params;
  const name = workspaceName(workspace) || "ShipBrief";

  try {
    const release = await changelogService.getPublic(workspace, slug);
    const title = release.title;
    const description = release.summary;

    return {
      title,
      description,
      openGraph: {
        type: "article",
        title,
        description,
        siteName: name,
        publishedTime: release.publishedAt,
      },
      twitter: { card: "summary", title, description },
    };
  } catch {
    const title = `Update from ${name}`;
    const description = `Read a product update from ${name}.`;

    return {
      title,
      description,
      openGraph: { type: "article", title, description, siteName: name },
      twitter: { card: "summary", title, description },
    };
  }
}

export default async function Page({
  params,
}: PageProps) {
  const { workspace, slug } = await params;
  return <PublicUpdatePage workspace={workspace} slug={slug} />;
}
