import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneText, type Tone } from "@/lib/tones";

/**
 * A plain, background-free icon at a consistent size. Muted by default; only
 * `rose`, `ink` and `red` change its colour. The name is historical — it no
 * longer draws a tile.
 */
export function IconTile({ icon: Icon, tone = "neutral", size = "md", className }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center", size === "lg" ? "size-6 [&_svg]:size-5" : "size-5 [&_svg]:size-4", toneText[tone], className)}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}
