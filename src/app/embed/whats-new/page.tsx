import { WhatsNewWidget } from "@/components/channels/whats-new-widget";
import { PageHeader } from "@/components/shared/page-states";

export default function EmbedWhatsNewPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-muted/30 p-8">
      <div className="space-y-6">
        <PageHeader
          title="Widget preview"
          description="Embeddable What's New widget using the workspace's saved accent color and widget theme."
        />
        <WhatsNewWidget />
      </div>
    </div>
  );
}
