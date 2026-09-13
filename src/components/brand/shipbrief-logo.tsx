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
  iconSize = 24,
  tone = "default",
}: ShipBriefLogoProps) {
  if (!showWordmark) {
    return <ShipBriefIcon size={iconSize} className={className} />;
  }

  const wordmarkSize = Math.max(15, Math.round(iconSize * 0.78));

  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)} role="img" aria-label="ShipBrief">
      <ShipBriefIcon size={iconSize} />
      <span
        aria-hidden="true"
        className={cn(
          "whitespace-nowrap font-heading font-semibold tracking-[-0.07em] text-[#19191b] dark:text-white",
          tone === "light" && "text-white"
        )}
        style={{ fontSize: wordmarkSize, lineHeight: 0.9 }}
      >
        Ship<span className="text-[#e40178]">Brief</span>
      </span>
    </div>
  );
}
