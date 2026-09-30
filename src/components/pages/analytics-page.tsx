"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AudienceTargetingPanel } from "@/components/operations";
import { ErrorState, LoadingState, MetricCard, PageHeader, SectionHeader } from "@/components/shared/page-states";
import { channelMeta } from "@/components/shared/channel-meta";
import { toneText, toneVar, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
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
      toast.success(result.filename + " is ready.");
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
      <PageHeader title="Analytics" description="Which updates customers read, click and react to." actions={<><Select value={range} onValueChange={(value) => value && setRange(value)}><SelectTrigger className="w-36"><SelectValue>{(value) => ranges.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{ranges.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={() => void exportReport()} disabled={exporting}><Download />{exporting ? "Exporting…" : "Export"}</Button></>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard className="sb-panel" label="Views" value={data.views.toLocaleString()} />
        <MetricCard className="sb-panel" label="Clicks" value={(data.clicks ?? 0).toLocaleString()} />
        <MetricCard className="sb-panel" label="CTA clicks" value={(data.ctaClicks ?? 0).toLocaleString()} />
        <MetricCard className="sb-panel" label="Reactions" value={data.reactions} />
        <MetricCard className="sb-panel" label="Engagement" value={data.engagement} suffix="%" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
        <section className="sb-panel p-5">
          <SectionHeader title="Release performance" description="Combined views, clicks and reactions." />
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.releasePerformance} layout="vertical" margin={{ left: 8, right: 18 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="title" width={118} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 8, borderColor: "var(--border)", background: "var(--popover)" }} />
                <Bar dataKey="score" radius={6} barSize={22}>
                  {data.releasePerformance.map((item, index) => <Cell key={item.id} fill={toneVar[chartTones[index % chartTones.length]]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="sb-panel p-5">
          <SectionHeader title="Channels" description="Share of engagement" />
          <div className="mt-5 space-y-4">
            {data.channelBreakdown.map((channel, index) => {
              const meta = channelFor(channel.channel);
              return (
                <div key={channel.channel}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 capitalize">
                      <meta.icon className={cn("size-3.5", toneText[meta.tone])} />
                      {meta.label}
                    </span>
                    <span className="sb-numeric font-medium">{channel.percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
                    <div className={cn("h-full rounded-full", channelFills[index] ?? "bg-foreground/30")} style={{ width: channel.percentage + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="sb-panel p-5">
          <SectionHeader title="Top updates" description="The messages customers engaged with most." />
          <div className="mt-4 divide-y divide-border">
            {data.topReleases.map((release, index) => (
              <Link key={release.id} href={"/app/releases/" + release.id} className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("sb-numeric flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", index === 0 ? "bg-ink text-ink-foreground" : "bg-surface-subtle text-foreground")}>{index + 1}</span>
                  <span className="truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">{release.title}</span>
                </div>
                <span className="sb-numeric shrink-0 text-xs text-muted-foreground">{release.views.toLocaleString()} views · <span className="font-medium text-foreground">{release.engagement}%</span></span>
              </Link>
            ))}
          </div>
        </section>
        <section className="sb-panel p-5">
          <SectionHeader title="Audiences" description="Engagement by targeted segment." />
          <div className="mt-4 space-y-4">
            {!data.audiencePerformance?.length && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Per-audience engagement needs email open and click tracking from your email provider, which isn&apos;t connected yet.
                {data.emailsSent ? ` ${data.emailsSent.toLocaleString()} release emails were delivered in this period.` : ""}
              </p>
            )}
            {(data.audiencePerformance ?? []).map((audience) => (
              <div key={audience.audience}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{audience.audience}</p>
                  <p className="sb-numeric text-sm font-medium">{audience.engagement}%</p>
                </div>
                <p className="text-xs text-muted-foreground">{audience.recipients.toLocaleString()} recipients</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                  <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.min(100, audience.engagement * 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <AudienceTargetingPanel />
    </div>
  );
}

const chartTones: Tone[] = ["rose", "blue", "violet", "green", "amber"];
const channelFills = ["bg-primary-strong", "bg-foreground/70", "bg-foreground/35"];

function channelFor(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes("mail")) return channelMeta.email;
  if (normalized.includes("widget") || normalized.includes("app")) return channelMeta.in_app;
  return channelMeta.changelog;
}
