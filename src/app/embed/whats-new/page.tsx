import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { PageHeader } from "@/components/shared/page-states";

type EmbedPageProps = { searchParams: Promise<{ key?: string | string[] }> };

export default async function EmbedWhatsNewPage({ searchParams }: EmbedPageProps) {
  const { key } = await searchParams;
  const projectKey = typeof key === "string" ? key : undefined;
  if (projectKey) {
    // Embedded in a customer's product via iframe: render only the widget.
    return (
      <div className="flex min-h-dvh items-end justify-center p-3">
        <WhatsNewWidget projectKey={projectKey} />
      </div>
    );
  }
  return (
    <div className="flex min-h-full items-center justify-center bg-muted/30 p-8">
      <div className="space-y-6">
        <PageHeader
          title="Widget preview"
          description="Embeddable What's New widget using the workspace's saved accent color and widget theme."
        />
        <WhatsNewWidget projectKey={projectKey} />
      </div>
    </div>
  );
}
