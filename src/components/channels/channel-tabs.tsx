"use client";

import { FileText, Globe, Mail, Smartphone } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Channel } from "@/types";
import type { StudioScope } from "@/components/ai";

const channelConfig: Record<Channel, { label: string; icon: typeof Globe }> = {
  changelog: { label: "Changelog", icon: Globe },
  email: { label: "Email", icon: Mail },
  in_app: { label: "In-App", icon: Smartphone },
};

export function ChannelTabs({
  active,
  selectedChannels,
  onChange,
}: {
  active: StudioScope;
  selectedChannels: Channel[];
  onChange: (scope: StudioScope) => void;
}) {
  return (
    <Tabs value={active} onValueChange={(value) => onChange(value as StudioScope)}>
      <TabsList className="max-w-full overflow-x-auto" aria-label="Release content versions">
        <TabsTrigger value="master">
          <FileText />
          Master
        </TabsTrigger>
        {selectedChannels.map((channel) => {
          const { label, icon: Icon } = channelConfig[channel];
          return (
            <TabsTrigger key={channel} value={channel}>
              <Icon />
              {label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
