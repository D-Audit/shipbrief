import { Mail, PanelTop, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneText, type Tone } from "@/lib/tones";
import type { Channel } from "@/types";

/** Channel metadata. Icons stay muted; channels are told apart by glyph and label, not colour. */
export const channelMeta: Record<Channel, { label: string; icon: LucideIcon; description: string; tone: Tone }> = {
  changelog: { label: "Changelog", icon: ScrollText, description: "A permanent public page customers can search and share.", tone: "neutral" },
  email: { label: "Email", icon: Mail, description: "Sent once to the audience you choose.", tone: "neutral" },
  in_app: { label: "In-app", icon: PanelTop, description: "Shown inside your product through the What’s New widget.", tone: "neutral" },
};

export const channelOrder: Channel[] = ["changelog", "email", "in_app"];

/** Compact row of channel glyphs with an accessible label. */
export function ChannelIcons({ channels, className }: { channels: Channel[]; className?: string }) {
  const ordered = channelOrder.filter((channel) => channels.includes(channel));
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={`Channels: ${ordered.map((channel) => channelMeta[channel].label).join(", ") || "none"}`}
      title={ordered.map((channel) => channelMeta[channel].label).join(" · ")}
    >
      {ordered.map((channel) => {
        const Icon = channelMeta[channel].icon;
        return <Icon key={channel} className={cn("size-3.5", toneText[channelMeta[channel].tone])} aria-hidden="true" />;
      })}
    </span>
  );
}

export function ChannelChips({ channels, className }: { channels: Channel[]; className?: string }) {
  const ordered = channelOrder.filter((channel) => channels.includes(channel));
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {ordered.map((channel) => {
        const { label, icon: Icon, tone } = channelMeta[channel];
        return (
          <span key={channel} className={cn("inline-flex h-[22px] items-center gap-1 rounded-md border border-border px-1.5 text-xs text-muted-foreground", tone === "rose" && "text-primary-strong")}>
            <Icon className="size-3" aria-hidden="true" />
            {label}
          </span>
        );
      })}
    </span>
  );
}
