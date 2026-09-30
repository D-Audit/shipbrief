"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { channelMeta, channelOrder } from "@/components/shared/channel-meta";
import { toneText } from "@/lib/tones";
import type { Channel, ChannelVariantMap } from "@/types";

interface ChannelSelectorProps {
  selected: Channel[];
  onChange: (channels: Channel[]) => void;
  /** When provided, each row shows whether the channel has its own tailored version. */
  variants?: ChannelVariantMap;
  disabled?: boolean;
}

/**
 * Explicit, per-release channel choice. Nothing is selected on the user's
 * behalf; publishing simply requires at least one channel.
 */
export function ChannelSelector({ selected, onChange, variants, disabled }: ChannelSelectorProps) {
  const toggle = (channel: Channel) => {
    onChange(selected.includes(channel) ? selected.filter((item) => item !== channel) : channelOrder.filter((item) => item === channel || selected.includes(item)));
  };

  return (
    <fieldset disabled={disabled} className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      <legend className="sr-only">Publish to</legend>
      {channelOrder.map((channel) => {
        const { label, icon: Icon, description } = channelMeta[channel];
        const checked = selected.includes(channel);
        const tailored = Boolean(variants?.[channel]);
        return (
          <label
            key={channel}
            className={cn(
              "group flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset has-disabled:cursor-not-allowed has-disabled:opacity-60",
              checked ? "bg-surface" : "hover:bg-surface-subtle/60"
            )}
          >
            <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(channel)} />
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                checked ? "border-foreground bg-foreground text-background" : "border-border-strong bg-surface"
              )}
            >
              {checked && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className={cn("size-3.5", toneText[channelMeta[channel].tone])} />
                {label}
                {variants && checked && (
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">{tailored ? "Tailored version" : "Uses master copy"}</span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
            </span>
          </label>
        );
      })}
      {selected.length === 0 && (
        <p role="status" className="px-3 py-2 text-xs text-warning">Choose at least one channel before this release can be scheduled or published.</p>
      )}
    </fieldset>
  );
}
