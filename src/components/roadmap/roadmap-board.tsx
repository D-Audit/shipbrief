import { CircleDot, Clock3, Rocket, Telescope, type LucideIcon } from "lucide-react";
import { IconTile } from "@/components/shared/icon-tile";
import { toneFill, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { RoadmapCard } from "./roadmap-card";
import type { RoadmapItem, RoadmapStatus } from "@/types";

/** Each column has its own colour so the board reads at a glance. */
const columns: { status: RoadmapStatus; label: string; description: string; icon: LucideIcon; tone: Tone }[] = [
  { status: "now", label: "Now", description: "In active delivery", icon: CircleDot, tone: "rose" },
  { status: "next", label: "Next", description: "Up next", icon: Clock3, tone: "blue" },
  { status: "later", label: "Later", description: "Worth exploring", icon: Telescope, tone: "violet" },
  { status: "shipped", label: "Shipped", description: "Delivered to customers", icon: Rocket, tone: "green" },
];

export function RoadmapBoard({ items, onOpen }: { items: RoadmapItem[]; onOpen: (item: RoadmapItem) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => {
        const columnItems = items.filter((item) => item.status === column.status);
        return (
          <section key={column.status} aria-labelledby={`roadmap-${column.status}`} className="min-w-0 overflow-hidden rounded-[var(--radius-xl)] bg-surface-subtle/70">
            <span aria-hidden="true" className={cn("block h-1", toneFill[column.tone])} />
            <div className="p-3">
              <div className="mb-3 flex items-center gap-2.5">
                <IconTile icon={column.icon} tone={column.tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 id={`roadmap-${column.status}`} className="sb-title-card">{column.label}</h2>
                  <p className="text-xs text-muted-foreground">{column.description}</p>
                </div>
                <span className="sb-numeric rounded-full bg-surface px-2 py-0.5 text-xs font-medium">{columnItems.length}</span>
              </div>
              <div className="space-y-2">
                {columnItems.length ? (
                  columnItems.map((item) => <RoadmapCard key={item.id} item={item} onOpen={() => onOpen(item)} />)
                ) : (
                  <p className="rounded-lg border border-dashed border-border-strong px-3 py-5 text-center text-xs text-muted-foreground">No items here yet.</p>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
