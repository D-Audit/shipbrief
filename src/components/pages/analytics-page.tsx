"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, MousePointerClick, Send, ThumbsUp, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AudienceTargetingPanel } from "@/components/operations";
import { ErrorState, LoadingState, MetricCard, PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { analyticsService } from "@/lib/services";

const ranges = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [exporting, setExporting] = useState(false);
  const { state, reload } = useAsyncData(() => analyticsService.getOverview(range), [range]);

  const exportReport = async () => {
    setExporting(true);
    try {
      const result = await analyticsService.export(range);
      toast.success(result.filename + " is ready (mock export).");
    } catch {
      toast.error("We could not prepare the analytics export.");
    } finally {
      setExporting(false);
    }
  };

  if (state.status === "loading" || state.status === "idle") return <LoadingState rows={5} />;
  if (state.status === "error") return <ErrorState message={state.error} onRetry={reload} />;
  if (state.status !== "success") return null;

  const data = state.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Understand which customer communication earns attention and action." actions={<><Select value={range} onValueChange={(value) => value && setRange(value)}><SelectTrigger className="w-36"><SelectValue>{(value) => ranges.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{ranges.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={() => void exportReport()} disabled={exporting}><Download />{exporting ? "Exporting..." : "Export"}</Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Views" value={data.views.toLocaleString()} />
        <MetricCard label="Clicks" value={(data.clicks ?? 0).toLocaleString()} />
        <MetricCard label="CTA clicks" value={(data.ctaClicks ?? 0).toLocaleString()} />
        <MetricCard label="Reactions" value={data.reactions} />
        <MetricCard label="Engagement" value={data.engagement} suffix="%" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
        <section className="space-y-3"><div><h2 className="text-base font-semibold">Release performance</h2><p className="text-sm text-muted-foreground">Combined view, click, reaction, and engagement signal.</p></div><div className="sb-panel h-[280px] p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.releasePerformance} layout="vertical" margin={{ left: 8, right: 18 }}><XAxis type="number" hide /><YAxis type="category" dataKey="title" width={118} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} /><Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, borderColor: "var(--border)" }} /><Bar dataKey="score" radius={5}>{data.releasePerformance.map((item) => <Cell key={item.id} fill="var(--primary)" />)}</Bar></BarChart></ResponsiveContainer></div></section>
        <section className="sb-panel p-4"><div className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Channels</h2><p className="text-xs text-muted-foreground">Share of engagement</p></div></div><div className="mt-5 space-y-4">{data.channelBreakdown.map((channel) => <div key={channel.channel}><div className="mb-1.5 flex justify-between text-sm"><span className="capitalize">{channel.channel}</span><span className="font-medium">{channel.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: channel.percentage + "%" }} /></div></div>)}</div></section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="sb-panel p-4"><div className="flex items-center gap-2"><MousePointerClick className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Top updates</h2><p className="text-xs text-muted-foreground">The messages customers engaged with most.</p></div></div><div className="mt-4 divide-y divide-border">{data.topReleases.map((release, index) => <Link key={release.id} href={"/app/releases/" + release.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary"><div className="flex min-w-0 items-center gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">{index + 1}</span><span className="truncate text-sm font-medium">{release.title}</span></div><span className="shrink-0 text-xs text-muted-foreground">{release.views.toLocaleString()} views · {release.engagement}%</span></Link>)}</div></section>
        <section className="sb-panel p-4"><div className="flex items-center gap-2"><Send className="size-4 text-primary" /><div><h2 className="text-base font-semibold">Audience performance</h2><p className="text-xs text-muted-foreground">Engagement by targeted segment.</p></div></div><div className="mt-4 space-y-3">{(data.audiencePerformance ?? []).map((audience) => <div key={audience.audience} className="flex items-center justify-between gap-3 rounded-lg bg-surface-subtle/70 px-3 py-2.5"><div><p className="text-sm font-medium">{audience.audience}</p><p className="text-xs text-muted-foreground">{audience.recipients.toLocaleString()} recipients</p></div><div className="flex items-center gap-1 text-sm font-medium text-primary"><ThumbsUp className="size-3.5" />{audience.engagement}%</div></div>)}</div></section>
      </div>
      <AudienceTargetingPanel />
    </div>
  );
}
