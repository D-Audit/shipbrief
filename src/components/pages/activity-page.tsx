"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, PenLine, CheckCircle2, GitBranch, MessageSquare, Send, ThumbsUp, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/shared/page-states";
import { IconTile } from "@/components/shared/icon-tile";
import type { Tone } from "@/lib/tones";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { activityService } from "@/lib/services";
import type { ActivityEvent } from "@/types";

/** Each kind of event keeps one glyph and colour, so the feed scans at a glance. */
const eventMeta: Record<ActivityEvent["type"], { icon: LucideIcon; tone: Tone }> = {
  ai_generated: { icon: PenLine, tone: "neutral" },
  approved: { icon: CheckCircle2, tone: "blue" },
  published: { icon: Send, tone: "green" },
  integration: { icon: GitBranch, tone: "ink" },
  feedback: { icon: ThumbsUp, tone: "amber" },
  scheduled: { icon: CalendarClock, tone: "rose" },
  comment: { icon: MessageSquare, tone: "blue" },
};

const eventFilters: { value: "all" | ActivityEvent["type"]; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "ai_generated", label: "AI activity" },
  { value: "approved", label: "Approvals" },
  { value: "published", label: "Publishing" },
  { value: "integration", label: "Integrations" },
  { value: "feedback", label: "Customer signals" },
  { value: "scheduled", label: "Scheduling" },
  { value: "comment", label: "Team actions" },
];

export function ActivityPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState<"all" | ActivityEvent["type"]>("all");
  const { state, reload } = useAsyncData(() => activityService.list({ unreadOnly, type: type === "all" ? undefined : type }), [type, unreadOnly]);

  const markAllRead = async () => {
    try {
      await activityService.markAllRead();
      await reload();
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("We could not update notification state.");
    }
  };

  const markRead = async (id: string) => {
    try {
      await activityService.markRead(id);
      await reload();
    } catch {
      toast.error("We could not update that notification.");
    }
  };

  const unreadCount = state.status === "success" ? state.data.filter((event) => !event.read).length : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Activity" description="Everything that happened across releases, AI, integrations and customers." actions={<Button type="button" variant="outline" onClick={() => void markAllRead()} disabled={unreadCount === 0}>Mark all read</Button>} />
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2.5 text-sm"><IconTile icon={Bell} tone="rose" size="sm" /><span className="font-medium">Notification center</span>{unreadCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{unreadCount} unread</span>}</div><div className="flex gap-2"><Button type="button" size="sm" variant={unreadOnly ? "secondary" : "ghost"} onClick={() => setUnreadOnly((value) => !value)}>Unread only</Button><Select value={type} onValueChange={(value) => value && setType(value as "all" | ActivityEvent["type"])}><SelectTrigger className="w-40"><SelectValue>{(value) => eventFilters.find((filter) => filter.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{eventFilters.map((filter) => <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>)}</SelectContent></Select></div></section>
      {state.status === "loading" && <LoadingState rows={5} />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
      {state.status === "empty" && <EmptyState title="No activity matches this view" description="Workspace events will appear as your team, integrations, and customers take action." />}
      {state.status === "success" && <section className="sb-panel divide-y divide-border p-1.5">{state.data.map((event) => <ActivityRow key={event.id} event={event} onRead={() => void markRead(event.id)} />)}</section>}
    </div>
  );
}

function ActivityRow({ event, onRead }: { event: ActivityEvent; onRead: () => void }) {
  const meta = eventMeta[event.type] ?? { icon: Bell, tone: "neutral" as Tone };
  const body = <div className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-subtle"><span className="relative"><IconTile icon={meta.icon} tone={meta.tone} size="sm" />{!event.read && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary-strong ring-2 ring-card" />}</span><div className="min-w-0 flex-1"><p className={event.read ? "text-sm text-foreground/80" : "text-sm font-medium"}>{event.message}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(event.timestamp), "HH:mm · MMM d")}{event.actor ? " · " + event.actor : ""}</p></div></div>;
  return event.link ? <Link href={event.link} onClick={onRead}>{body}</Link> : <button type="button" onClick={onRead} className="block w-full text-left">{body}</button>;
}
