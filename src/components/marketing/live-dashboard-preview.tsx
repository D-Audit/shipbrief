"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CircleDot, FileText, GitPullRequest, Mail, Sparkles } from "lucide-react";
import { ShipBriefIcon } from "@/components/brand";
import { cn } from "@/lib/utils";

const stages = [
  { label: "Source connected", note: "3 merged changes grouped", status: "Ready to shape" },
  { label: "Story refined", note: "Customer value is clear", status: "Review ready" },
  { label: "Channels aligned", note: "Changelog, email, in-app", status: "Prepared to publish" },
] as const;

export function LiveDashboardPreview() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setActiveStage((current) => (current + 1) % stages.length), 3400);
    return () => window.clearInterval(interval);
  }, []);

  const active = stages[activeStage];

  return (
    <section aria-label="Interactive ShipBrief dashboard preview" className="relative overflow-hidden rounded-[1.35rem] border border-[#39393d] bg-[#111113] p-2 shadow-[0_26px_70px_rgb(23_23_23/0.22)] sm:p-3">
      <div className="relative overflow-hidden rounded-[0.95rem] border border-white/10 bg-[#19191b]">
        <div className="flex h-11 items-center justify-between border-b border-white/10 px-3 text-[10px] sm:px-4">
          <div className="flex min-w-0 items-center gap-2 text-[#dadadd]"><ShipBriefIcon size={18} /><span className="font-semibold">ShipBrief</span><span className="hidden text-white/40 sm:inline">/ Release workspace</span></div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e398a7]/30 bg-[#d86f82]/15 px-2 py-1 text-[9px] font-medium text-[#ffc7d0]"><span className="size-1.5 rounded-full bg-[#f5a7b5]" />Live preview</span>
        </div>

        <div className="grid min-h-[26rem] grid-cols-[3.8rem_minmax(0,1fr)] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <aside className="border-r border-white/10 bg-[#141416] px-2 py-3 sm:px-3">
            <p className="hidden px-1 text-[9px] font-medium tracking-[0.12em] text-white/40 uppercase sm:block">Workspace</p>
            <div className="mt-1 space-y-1 sm:mt-3">
              {["Overview", "Releases", "AI Studio", "Signals"].map((item) => <span key={item} className={cn("block rounded-md px-1.5 py-2 text-center text-[9px] text-white/52 sm:text-left", item === "Releases" && "bg-[#422a30] text-[#ffc3cd]")}>{item}</span>)}
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-[10px] text-white/45">Release / September update</p><h3 className="mt-1 text-sm font-semibold text-white sm:text-base">Reports that answer the next question.</h3></div>
              <span className="border border-[#975562] bg-[#472a31] px-2 py-1 text-[9px] font-semibold text-[#ffc9d1]">IN REVIEW</span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(11rem,0.8fr)]">
              <div className="border border-white/10 bg-[#202023] p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-[0.1em] text-[#f0b0ba] uppercase"><Sparkles className="size-3" />Release brief</span><span className="text-[9px] text-white/40">Saved now</span></div>
                <p className="mt-4 text-[10px] font-medium text-white/42">CUSTOMER OUTCOME</p>
                <p className="mt-1 text-sm font-medium leading-5 text-white sm:text-[15px]">Find the metric that matters without waiting on a report.</p>
                <p className="mt-3 text-[11px] leading-5 text-white/60">Flexible views keep every team moving from question to answer with less setup.</p>
                <div className="mt-5 flex flex-wrap gap-1.5"><span className="border border-[#a65c69] bg-[#3f282e] px-2 py-1 text-[9px] text-[#ffc4cd]">Changelog</span><span className="border border-white/10 px-2 py-1 text-[9px] text-white/56">Email</span><span className="border border-white/10 px-2 py-1 text-[9px] text-white/56">In-app</span></div>
              </div>

              <div className="border border-white/10 bg-[#1c1c1e] p-3">
                <p className="text-[9px] font-medium tracking-[0.12em] text-white/40 uppercase">Activity</p>
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2a3a30] text-[#8ed1a6]"><GitPullRequest className="size-3" /></span><p className="text-[10px] leading-4 text-white/70"><b className="font-medium text-white">3 pull requests</b><br />Grouped into this release.</p></div>
                  <div className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#3d2b31] text-[#f1a6b3]"><FileText className="size-3" /></span><p className="text-[10px] leading-4 text-white/70"><b className="font-medium text-white">Draft reviewed</b><br />Value statement improved.</p></div>
                  <div className="flex gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#292b3c] text-[#c3c9ff]"><Mail className="size-3" /></span><p className="text-[10px] leading-4 text-white/70"><b className="font-medium text-white">3 channels ready</b><br />Audience rules are aligned.</p></div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {stages.map((stage, index) => <button key={stage.label} type="button" onClick={() => setActiveStage(index)} aria-pressed={activeStage === index} className={cn("border px-2.5 py-2 text-left transition-colors", activeStage === index ? "border-[#d86f82]/65 bg-[#d86f82]/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]")}><span className="flex items-center justify-between gap-2 text-[9px] font-medium text-white"><span>{stage.label}</span>{activeStage === index ? <Check className="size-3 text-[#f4adba]" /> : <CircleDot className="size-3 text-white/35" />}</span><span className="mt-1 block text-[9px] text-white/48">{stage.note}</span></button>)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3"><span className="text-[10px] text-white/53">{active.status}</span><span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#f2a3b1]">Open workspace <ArrowUpRight className="size-3" /></span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
