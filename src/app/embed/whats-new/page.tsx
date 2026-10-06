import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { PageHeader } from "@/components/shared/page-states";

type EmbedPageProps = { searchParams: Promise<{ key?: string | string[]; mode?: string | string[]; theme?: string | string[] }> };

export default async function EmbedWhatsNewPage({ searchParams }: EmbedPageProps) {
  const { key, mode, theme } = await searchParams;
  const projectKey = typeof key === "string" ? key : undefined;
  const themeOverride = theme === "light" || theme === "dark" ? theme : undefined;
  if (projectKey && mode === "panel") {
    // Opened by /widget.js inside the customer's product: the panel fills the iframe.
    return <WhatsNewWidget projectKey={projectKey} theme={themeOverride} mode="panel" />;
  }
  if (projectKey) {
    // Older installs embed this page directly with an iframe: render only the widget.
    return (
      <div className="flex min-h-dvh items-end justify-center p-3">
        <WhatsNewWidget projectKey={projectKey} theme={themeOverride} />
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
