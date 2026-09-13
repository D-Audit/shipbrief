import Image from "next/image";
import { cn } from "@/lib/utils";

interface ShipBriefIconProps {
  className?: string;
  size?: number;
}

/** The supplied ShipBrief flower mark, kept as the single source of brand identity. */
export function ShipBriefIcon({ className, size = 24 }: ShipBriefIconProps) {
  return (
    <Image
      src="/brand/shipbrief-flower-mark-v1.png"
      alt=""
      aria-hidden="true"
      width={1247}
      height={1261}
      unoptimized
      sizes={`${size}px`}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
