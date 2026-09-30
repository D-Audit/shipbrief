import { cn } from "@/lib/utils";
import { ShipBriefIcon } from "./shipbrief-icon";

interface ShipBriefLogoProps {
  className?: string;
  showWordmark?: boolean;
  iconSize?: number;
  tone?: "default" | "light";
}

export function ShipBriefLogo({
  className,
  showWordmark = true,
  iconSize = 22,
  tone = "default",
}: ShipBriefLogoProps) {
  if (!showWordmark) {
    return <ShipBriefIcon size={iconSize} className={className} />;
  }

  const wordmarkSize = Math.max(15, Math.round(iconSize * 0.74));

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)} role="img" aria-label="ShipBrief">
      <ShipBriefIcon size={iconSize} />
      <span
        aria-hidden="true"
        className={cn(
          "whitespace-nowrap font-heading font-semibold tracking-[-0.045em] text-foreground",
          tone === "light" && "text-white"
        )}
        style={{ fontSize: wordmarkSize, lineHeight: 1 }}
      >
        ShipBrief
      </span>
    </span>
  );
}
