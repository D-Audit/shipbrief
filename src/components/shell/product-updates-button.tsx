"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { WidgetIdentity } from "@/lib/services/widget-settings-service";

type ProductUpdatesIdentity = WidgetIdentity & { key: string };
type ShipBriefCommand = ((...args: unknown[]) => void) & { q?: unknown[][]; loaded?: boolean };

declare global {
  interface Window {
    ShipBrief?: ShipBriefCommand;
  }
}

/** The widget loader keeps one instance per page, so it is initialised once and re-identified after that. */
let initialisedKey: string | null = null;

/**
 * ShipBrief's own "What's new": the same /widget.js customers install, fed by
 * the workspace named in the API's PRODUCT_UPDATES_WIDGET_KEY. The button opens
 * the feed (data-shipbrief-toggle) and shows the unread count (data-shipbrief-badge).
 * Renders nothing when the API has no product-updates workspace configured.
 */
export function ProductUpdatesButton() {
  const [identity, setIdentity] = useState<ProductUpdatesIdentity | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<ProductUpdatesIdentity | null>("/auth/product-updates")
      .then((result) => {
        if (active) setIdentity(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!identity) return;
    const { key, user, userHash } = identity;
    if (initialisedKey === key) {
      window.ShipBrief?.("identify", user, userHash);
      return;
    }
    if (initialisedKey) return; // A different key already owns the page's widget.
    initialisedKey = key;
    if (!window.ShipBrief) {
      const queue: unknown[][] = [];
      window.ShipBrief = Object.assign((...args: unknown[]) => { queue.push(args); }, { q: queue });
    }
    window.ShipBrief("init", { key, user, userHash, launcher: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = "/widget.js";
    document.head.appendChild(script);
  }, [identity]);

  if (!identity) return null;

  return (
    <Button type="button" variant="ghost" size="icon-sm" className="relative" aria-label="What's new" title="What's new" data-shipbrief-toggle="">
      <Megaphone />
      <span data-shipbrief-badge="" hidden className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background" />
    </Button>
  );
}
