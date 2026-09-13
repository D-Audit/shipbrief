"use client";

import { Globe, Mail, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

const CHANNEL_CONFIG: {
  id: Channel;
  label: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    id: "changelog",
    label: "Changelog",
    description: "Permanent, searchable update history",
    icon: Globe,
  },
  {
    id: "email",
    label: "Email",
    description: "Send to selected audience",
    icon: Mail,
  },
  {
    id: "in_app",
    label: "In-App",
    description: "What's New feed, banner, or modal",
    icon: Smartphone,
  },
];

interface ChannelSelectorProps {
  selected: Channel[];
  onChange: (channels: Channel[]) => void;
}

export function ChannelSelector({ selected, onChange }: ChannelSelectorProps) {
  const toggle = (channel: Channel) => {
    if (selected.includes(channel)) {
      if (selected.length === 1) return;
      onChange(selected.filter((c) => c !== channel));
    } else {
      onChange([...selected, channel]);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Publishing channels</p>
      <p className="text-xs text-muted-foreground">
        Choose one, two, or all channels. You are not forced to publish everywhere.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {CHANNEL_CONFIG.map(({ id, label, description, icon: Icon }) => {
          const active = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={active && selected.length === 1}
              aria-pressed={active}
              title={active && selected.length === 1 ? "Select another channel before removing this one" : undefined}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
