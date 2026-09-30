"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Mail, PanelTop, ScrollText, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

const channels: { id: Channel; label: string; icon: typeof Mail; note: string }[] = [
  { id: "changelog", label: "Changelog", icon: ScrollText, note: "Public, searchable, permanent" },
  { id: "email", label: "Email", icon: Mail, note: "Sent once to an audience" },
  { id: "in_app", label: "In-app", icon: PanelTop, note: "Inside your product" },
];

export function ChannelShowcase() {
  const [selected, setSelected] = useState<Channel[]>(["changelog", "email"]);
  const toggle = (id: Channel) =>
    setSelected((current) => (current.includes(id) ? (current.length > 1 ? current.filter((item) => item !== id) : current) : [...current, id]));

  return (
    <div>
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Master release</p>
            <p className="mt-0.5 font-semibold">Scheduled Reports</p>
          </div>
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border bg-surface px-2 text-xs font-medium text-foreground/80"><span className="size-1.5 rounded-full bg-foreground" />Approved</span>
        </div>
        <fieldset className="mt-4 border-t border-border pt-4">
          <legend className="sr-only">Publish to</legend>
          <p className="text-xs font-medium text-muted-foreground">Publish to</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {channels.map((channel) => {
              const on = selected.includes(channel.id);
              return (
                <label key={channel.id} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors", on ? "border-border-strong bg-surface" : "border-border text-muted-foreground hover:text-foreground")}>
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(channel.id)} />
                  <span className={cn("flex size-4 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring", on ? "border-foreground bg-foreground text-background" : "border-border-strong")}>
                    {on && <Check className="size-3" />}
                  </span>
                  {channel.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="relative hidden h-12 md:block" aria-hidden="true">
        <svg className="absolute inset-0 size-full" viewBox="0 0 800 48" preserveAspectRatio="none" fill="none">
          {[133, 400, 667].map((x, i) => (
            <path key={x} d={`M400 0 C400 24 ${x} 24 ${x} 48`} className={cn("transition-[stroke] duration-500", selected.includes(channels[i].id) ? "stroke-foreground/35" : "stroke-foreground/10")} strokeWidth="1" strokeDasharray={selected.includes(channels[i].id) ? "0" : "3 4"} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>

      <div className="mt-6 grid gap-4 md:mt-0 md:grid-cols-3">
        {channels.map((channel) => {
          const on = selected.includes(channel.id);
          return (
            <motion.div key={channel.id} animate={{ opacity: on ? 1 : 0.45 }} transition={{ duration: 0.35 }} className="relative">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-medium"><channel.icon className="size-4 text-muted-foreground" />{channel.label}</span>
                <span className="text-xs text-muted-foreground">{on ? channel.note : "Not sent"}</span>
              </div>
              <div className={cn("h-[15.5rem] overflow-hidden rounded-xl border bg-card transition-colors", on ? "border-border" : "border-dashed border-border-strong")}>
                {channel.id === "changelog" && <ChangelogMock />}
                {channel.id === "email" && <EmailMock />}
                {channel.id === "in_app" && <InAppMock />}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ChangelogMock() {
  return (
    <div className="p-5">
      <p className="text-[11px] text-muted-foreground">acme.com/changelog</p>
      <p className="mt-4 text-xs font-medium text-primary-strong">Feature · Sep 30</p>
      <p className="mt-1 text-[17px] font-semibold tracking-[-0.01em]">Scheduled Reports</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Send any report to your team every Monday, automatically. Pick the day, the time and who receives it.</p>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3" /> 48</span>
        <span>6 comments</span>
      </div>
    </div>
  );
}

function EmailMock() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface-subtle/60 px-4 py-3 text-[12px]">
        <p><span className="text-muted-foreground">From</span> Acme Product</p>
        <p className="mt-0.5 font-medium">Your Monday numbers, delivered</p>
      </div>
      <div className="p-4">
        <p className="text-[13px]">Hi Priya,</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">You asked for it: reports can now arrive in your inbox on a schedule. Set it up once and your team starts every week with the same numbers.</p>
        <span className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">Schedule a report</span>
      </div>
    </div>
  );
}

function InAppMock() {
  return (
    <div className="relative h-full bg-surface-subtle/60 p-4">
      <div className="space-y-2" aria-hidden="true">
        <div className="h-2.5 w-24 rounded-full bg-foreground/10" />
        <div className="h-16 rounded-lg border border-border bg-card" />
        <div className="h-2.5 w-40 rounded-full bg-foreground/10" />
      </div>
      <AnimatePresence>
        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.5 }} className="absolute right-3 bottom-3 left-3 rounded-lg border border-border bg-card p-3.5 sb-overlay-shadow">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-primary-strong">What&apos;s new</p>
              <p className="mt-0.5 text-[13px] font-semibold">Reports on a schedule</p>
            </div>
            <X className="size-3.5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Open any report and choose Schedule.</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
