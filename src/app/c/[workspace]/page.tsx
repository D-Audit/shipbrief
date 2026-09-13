import type { Metadata } from "next";
import { PublicChangelogPage } from "@/components/public/public-changelog";
import { brandingService, changelogService } from "@/lib/services";

type PageProps = {
  params: Promise<{ workspace: string }>;
};

function workspaceName(workspace: string) {
  return workspace
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { workspace } = await params;
  const name = workspaceName(workspace) || "ShipBrief";

  try {
    const [branding, releases] = await Promise.all([
      brandingService.get(),
      changelogService.getPublicList(workspace),
    ]);
    const title = `What’s new at ${name}`;
    const description =
      releases.length === 1
        ? `Read the latest product update from ${name}.`
        : `Read the latest product updates from ${name}.`;

    return {
      title,
      description,
      openGraph: {
        type: "website",
        title,
        description,
        siteName: name,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
      icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    };
  } catch {
    const title = `What’s new at ${name}`;
    const description = `Product updates from ${name}.`;

    return {
      title,
      description,
      openGraph: { type: "website", title, description, siteName: name },
      twitter: { card: "summary", title, description },
    };
  }
}

export default async function Page({
  params,
}: PageProps) {
  const { workspace } = await params;
  return <PublicChangelogPage workspace={workspace} />;
}
