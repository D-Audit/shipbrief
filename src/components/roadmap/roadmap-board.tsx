import { RoadmapCard } from "./roadmap-card";
import type { RoadmapItem, RoadmapStatus } from "@/types";

const columns: { status: RoadmapStatus; label: string; description: string }[] = [
  { status: "now", label: "Now", description: "In active delivery" },
  { status: "next", label: "Next", description: "Up next" },
  { status: "later", label: "Later", description: "Worth exploring" },
  { status: "shipped", label: "Shipped", description: "Delivered to customers" },
];

export function RoadmapBoard({ items, onOpen }: { items: RoadmapItem[]; onOpen: (item: RoadmapItem) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => {
        const columnItems = items.filter((item) => item.status === column.status);
        return <section key={column.status} aria-labelledby={`roadmap-${column.status}`} className="min-w-0 rounded-xl border border-border bg-surface-subtle/50 p-3"><div className="mb-3 flex items-start justify-between gap-2"><div><h2 id={`roadmap-${column.status}`} className="text-sm font-semibold">{column.label}</h2><p className="mt-0.5 text-xs text-muted-foreground">{column.description}</p></div><span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">{columnItems.length}</span></div><div className="space-y-2">{columnItems.length ? columnItems.map((item) => <RoadmapCard key={item.id} item={item} onOpen={() => onOpen(item)} />) : <p className="rounded-lg border border-dashed border-border bg-surface/60 px-3 py-5 text-center text-xs text-muted-foreground">No items here yet.</p>}</div></section>;
      })}
    </div>
  );
}
