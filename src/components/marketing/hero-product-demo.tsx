"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import {
  Check,
  Pause,
  Play,
  ChartNoAxesColumn,
  FileText,
  GitMerge,
  LayoutDashboard,
  Mail,
  PanelTop,
  PenLine,
  ScrollText,
} from "lucide-react";
import { ShipBriefIcon } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * The hero's product demonstration: a scaled, real-looking ShipBrief window
 * inside a laptop that walks through the release loop. Everything is drawn in
 * code so it stays sharp, themeable and truthful to the product UI.
 */

const scenes = [
  { id: "detect", label: "Detect", caption: "Merged work arrives from GitHub and Linear." },
  { id: "draft", label: "Draft", caption: "AI turns the change into customer language." },
  { id: "review", label: "Review", caption: "A teammate reviews and approves every word." },
  { id: "publish", label: "Publish", caption: "Send to the channels you choose." },
] as const;

type SceneId = (typeof scenes)[number]["id"];

const SCENE_MS = 4600;
const VIRTUAL_W = 1000;
const VIRTUAL_H = 540;
const ease = [0.22, 1, 0.36, 1] as const;

export function HeroProductDemo() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  // Starts as soon as a slice of the demo is on screen — it peeks in below the hero.
  const inView = useInView(rootRef, { amount: 0.1 });
  const autoplay = !reduceMotion && !paused && inView;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % scenes.length), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, index]);

  const scene = scenes[index];

  return (
    <div ref={rootRef}>
      <Frame scene={scene.id}>
        <ScaledScreen>
          <DemoWindow scene={scene.id} animate={!reduceMotion} />
        </ScaledScreen>
      </Frame>

      <div className="mx-auto mt-10 flex max-w-3xl items-start gap-4">
        {!reduceMotion && (
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? "Play walkthrough" : "Pause walkthrough"}
            className="mt-[-9px] flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-foreground/70 transition-colors hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {paused ? <Play className="size-3 translate-x-px" /> : <Pause className="size-3" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
        <div role="tablist" aria-label="ShipBrief workflow" className="grid grid-cols-5 gap-2 sm:gap-3">
          {scenes.map((item, itemIndex) => {
            const active = itemIndex === index;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="hero-demo-caption"
                onClick={() => setIndex(itemIndex)}
                className="group text-left focus-visible:outline-none"
              >
                <span className="relative block h-[3px] overflow-hidden rounded-full bg-foreground/10">
                  {active && (
                    <motion.span
                      key={`${item.id}-${autoplay}`}
                      className="absolute inset-y-0 left-0 rounded-full bg-primary-strong"
                      initial={{ width: autoplay ? "0%" : "100%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: autoplay ? SCENE_MS / 1000 : 0, ease: "linear" }}
                    />
                  )}
                  {itemIndex < index && <span className="absolute inset-0 rounded-full bg-foreground/35" />}
                </span>
                <span
                  className={cn(
                    "mt-3 block text-[13px] font-medium transition-colors group-focus-visible:underline sm:text-sm",
                    active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <span className="sb-numeric mr-1.5 hidden text-muted-foreground sm:inline">0{itemIndex + 1}</span>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        <p id="hero-demo-caption" role="tabpanel" aria-live="polite" className="mt-4 text-center text-sm text-muted-foreground">
          {scene.caption}
        </p>
        </div>
      </div>
    </div>
  );
}

const sceneRoutes: Record<SceneId, string> = {
  detect: "releases",
  draft: "ai-studio",
  review: "releases/audit-log",
  publish: "releases/audit-log/publish",
};

/**
 * A light app window in ShipBrief's smoke greys: a soft outer shell, a quiet
 * browser bar whose address follows the scene, and the product inside. Flat —
 * no shadows or gradients.
 */
function Frame({ scene, children }: { scene: SceneId; children: React.ReactNode }) {
  return (
    <figure className="relative mx-auto w-full max-w-[64rem] rounded-[1.75rem] bg-surface-subtle p-2 ring-1 ring-border sm:p-2.5" aria-label="The ShipBrief workspace, showing a release move from merged code to customer feedback">
      <div className="overflow-hidden rounded-[1.25rem] bg-background ring-1 ring-border">
        <div className="flex h-10 items-center gap-3 border-b border-border bg-surface px-4" aria-hidden="true">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-primary/80" />
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
          </span>
          <span className="mx-auto flex h-6 min-w-0 items-center gap-1.5 truncate rounded-full bg-surface-subtle px-3 text-[11px] text-muted-foreground sm:w-80 sm:justify-center">
            <span className="size-1.5 shrink-0 rounded-full bg-success" />
            app.shipbrief.com/acme/<span className="text-foreground">{sceneRoutes[scene]}</span>
          </span>
          <span className="hidden w-[42px] sm:block" />
        </div>
        {children}
      </div>
    </figure>
  );
}

/** Renders the window at a fixed virtual size and scales it to fit, so the layout never reflows. */
function ScaledScreen({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / VIRTUAL_W);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full" style={{ aspectRatio: `${VIRTUAL_W} / ${VIRTUAL_H}` }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: VIRTUAL_W, height: VIRTUAL_H, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
        aria-hidden="true"
        inert
      >
        {children}
      </div>
    </div>
  );
}

const navItems = [
  { label: "Overview", icon: LayoutDashboard, scene: null },
  { label: "Releases", icon: FileText, scene: ["detect", "review"] },
  { label: "AI Studio", icon: PenLine, scene: ["draft"] },
  { label: "Changelog", icon: ScrollText, scene: ["publish"] },
  { label: "Email", icon: Mail, scene: null },
  { label: "In-app", icon: PanelTop, scene: null },
  { label: "Analytics", icon: ChartNoAxesColumn, scene: null },
] as const;

function DemoWindow({ scene, animate }: { scene: SceneId; animate: boolean }) {
  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <aside className="flex w-[176px] shrink-0 flex-col border-r border-border px-3 py-4">
        <div className="flex items-center gap-2 px-1.5">
          <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">A</span>
          <span className="text-[13px] font-semibold">Acme</span>
        </div>
        <div className="mt-6 space-y-0.5">
          {navItems.map((item) => {
            const active = item.scene?.includes(scene as never) ?? false;
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  "flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[12.5px] transition-colors duration-500",
                  active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-[15px]", active && "text-primary-strong")} />
                {item.label}
              </div>
            );
          })}
        </div>
        <div className="mt-auto flex items-center gap-2 px-1.5 text-[11px] text-muted-foreground">
          <ShipBriefIcon size={14} />
          ShipBrief
        </div>
      </aside>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="flex h-12 items-center justify-between border-b border-border px-6 text-[12px] text-muted-foreground">
          <span>
            Acme <span className="mx-1.5 text-border-strong">/</span>
            <span className="font-medium text-foreground">{scene === "draft" ? "AI Studio" : "Releases"}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-6 w-40 rounded-md border border-border bg-surface" />
            <span className="size-6 rounded-full bg-surface-subtle ring-1 ring-border" />
          </span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scene}
            className="absolute inset-x-0 top-12 bottom-0 px-7 py-6"
            initial={animate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={animate ? { opacity: 0, y: -6 } : undefined}
            transition={{ duration: 0.45, ease }}
          >
            {scene === "detect" && <DetectScene animate={animate} />}
            {scene === "draft" && <DraftScene animate={animate} />}
            {scene === "review" && <ReviewScene animate={animate} />}
            {scene === "publish" && <PublishScene animate={animate} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Appear({ delay = 0, animate, children, className }: { delay?: number; animate: boolean; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: animate ? delay : 0, ease }}
    >
      {children}
    </motion.div>
  );
}

function Pill({ tone, children }: { tone: "neutral" | "warning" | "info" | "success" | "accent"; children: React.ReactNode }) {
  const dots = {
    neutral: "bg-border-strong",
    warning: "bg-warning",
    info: "bg-foreground",
    success: "bg-success",
    accent: "bg-primary-strong",
  };
  return (
    <span className="inline-flex h-[20px] items-center gap-1.5 rounded-full border border-border bg-surface px-2 text-[11px] font-medium text-foreground/80">
      <span className={cn("size-[5px] rounded-full", dots[tone])} />
      {children}
    </span>
  );
}

function DetectScene({ animate }: { animate: boolean }) {
  const prs = [
    { id: "#522", title: "Add audit_events table and writer", repo: "acme/app" },
    { id: "#523", title: "Expose paginated GET /v2/audit", repo: "acme/app" },
    { id: "ACM-230", title: "Admins can review workspace history", repo: "Linear" },
  ];
  return (
    <div>
      <p className="text-[20px] font-semibold tracking-[-0.02em]">Releases</p>
      <Appear animate={animate} delay={0.15} className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-md bg-surface-subtle"><GitMerge className="size-4" /></span>
        <div className="text-[12.5px]"><span className="font-medium">3 changes shipped to production</span><span className="text-muted-foreground"> · 4 minutes ago</span></div>
        <span className="ml-auto text-[11.5px] text-muted-foreground">GitHub · Linear</span>
      </Appear>
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        {prs.map((pr, i) => (
          <Appear key={pr.id} animate={animate} delay={0.45 + i * 0.25} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-[12.5px] last:border-b-0">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="sb-numeric w-16 text-muted-foreground">{pr.id}</span>
            <span className="font-mono text-[12px]">{pr.title}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{pr.repo}</span>
          </Appear>
        ))}
      </div>
      <Appear animate={animate} delay={1.5} className="mt-5 rounded-lg border border-border-strong bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11.5px] text-muted-foreground">Grouped into a new release</p>
            <p className="mt-0.5 text-[15px] font-semibold">Audit Log</p>
          </div>
          <Pill tone="neutral">Draft</Pill>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <motion.span
            className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <motion.span
              className="block h-full rounded-full bg-primary-strong"
              initial={animate ? { width: "0%" } : { width: "100%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.6, delay: animate ? 1.9 : 0, ease }}
            />
          </motion.span>
          Writing a customer-facing draft
        </div>
      </Appear>
    </div>
  );
}

function useTyped(text: string, animate: boolean, delay = 0, speed = 22) {
  const [count, setCount] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCount((current) => {
          if (current >= text.length) {
            window.clearInterval(interval);
            return current;
          }
          return current + 2;
        });
      }, speed);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [animate, delay, speed, text]);
  return text.slice(0, count);
}

function DraftScene({ animate }: { animate: boolean }) {
  const summary = useTyped("See who changed what in your workspace, and when — without asking engineering.", animate, 500);
  const bullet1 = useTyped("Every role change, export and setting update in one timeline", animate, 2300);
  const bullet2 = useTyped("Filter by teammate or date, then export for your auditors", animate, 3200);
  return (
    <div className="grid grid-cols-[1fr_1.35fr] items-start gap-5">
      <div className="rounded-lg border border-border bg-surface-subtle/60 p-4">
        <p className="text-[11px] font-medium text-muted-foreground">Source · 3 changes</p>
        <div className="mt-3 space-y-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
          <p>feat(audit): add audit_events table, write events on role change + export</p>
          <p>feat(api): paginated GET /v2/audit with actor/date filters</p>
          <p>ACM-230 Admins can review workspace history</p>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[11px] font-medium text-muted-foreground">Brand voice</p>
          <p className="mt-1.5 text-[12px] leading-relaxed">Clear and friendly. Lead with the benefit. Avoid jargon.</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Master release</p>
          <span className="flex gap-1.5">
            {["Shorten", "Simplify", "Translate"].map((label) => (
              <span key={label} className="rounded-md border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground">{label}</span>
            ))}
          </span>
        </div>
        <p className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">Audit Log</p>
        <p className="mt-2 min-h-[42px] text-[14px] leading-relaxed text-muted-foreground">
          {summary}
          {animate && summary.length < 80 && <span className="ml-px inline-block h-[15px] w-px translate-y-0.5 animate-pulse bg-foreground" />}
        </p>
        <ul className="mt-4 space-y-2 text-[13px]">
          <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />{bullet1}</li>
          <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />{bullet2}</li>
        </ul>
        <Appear animate={animate} delay={3.9} className="mt-6 flex items-center gap-2 border-t border-border pt-4">
          <span className="rounded-md bg-foreground px-2.5 py-1 text-[11.5px] font-medium text-background">Apply</span>
          <span className="rounded-md border border-border px-2.5 py-1 text-[11.5px]">Regenerate</span>
          <span className="ml-auto text-[11px] text-muted-foreground">Nothing changes until you apply</span>
        </Appear>
      </div>
    </div>
  );
}

function ReviewScene({ animate }: { animate: boolean }) {
  const [step, setStep] = useState(animate ? 1 : 2);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setStep(2), 2400);
    return () => window.clearTimeout(timer);
  }, [animate]);

  const stages = ["Draft", "In review", "Approved", "Scheduled", "Published"];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11.5px] text-muted-foreground">Releases / Audit Log</p>
          <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">Audit Log</p>
        </div>
        <motion.div key={step} initial={animate ? { scale: 0.92, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease }}>
          {step === 1 ? <Pill tone="warning">In review</Pill> : <Pill tone="info">Approved</Pill>}
        </motion.div>
      </div>
      <div className="mt-5 flex items-center gap-2">
        {stages.map((stage, i) => (
          <div key={stage} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors duration-500",
                i < step ? "bg-foreground text-background" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("text-[11.5px] whitespace-nowrap", i <= step ? "font-medium" : "text-muted-foreground")}>{stage}</span>
            {i < stages.length - 1 && <span className={cn("h-px flex-1 transition-colors duration-500", i < step ? "bg-foreground/60" : "bg-border")} />}
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-[1.4fr_1fr] gap-5">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-[16px] font-semibold">See who changed what, and when.</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Audit Log gives admins a complete timeline of role changes, exports and settings updates —{" "}
            <span className="rounded-sm bg-accent px-0.5 text-foreground">ready for your next compliance review.</span>
          </p>
          <div className="mt-4 h-2 w-3/4 rounded-full bg-muted" />
          <div className="mt-2 h-2 w-2/3 rounded-full bg-muted" />
        </div>
        <div className="space-y-3">
          <Appear animate={animate} delay={0.5} className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-surface-subtle text-[10px] font-medium ring-1 ring-border">AC</span>
              <span className="text-[12px] font-medium">Alex Chen</span>
              <span className="text-[11px] text-muted-foreground">Product</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed">Love it. Can we mention compliance up front? That&apos;s why admins asked.</p>
          </Appear>
          <Appear animate={animate} delay={1.4} className="rounded-lg border border-border bg-surface-subtle/60 p-3.5">
            <p className="text-[11.5px] text-muted-foreground">Suggestion applied by Don</p>
            <p className="mt-1 text-[12px]">&ldquo;…ready for your next compliance review.&rdquo;</p>
          </Appear>
          <AnimatePresence>
            {step === 2 && (
              <motion.div
                initial={animate ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[12px] font-medium"
              >
                <Check className="size-3.5" /> Approved by Alex Chen
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PublishScene({ animate }: { animate: boolean }) {
  const [published, setPublished] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setPublished(true), 1500);
    return () => window.clearTimeout(timer);
  }, [animate]);

  const channels = [
    { label: "Changelog", icon: ScrollText, on: true },
    { label: "Email", icon: Mail, on: true },
    { label: "In-app", icon: PanelTop, on: true },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[20px] font-semibold tracking-[-0.02em]">Publish “Audit Log”</p>
        <motion.span
          animate={published ? { scale: [1, 0.96, 1] } : {}}
          transition={{ duration: 0.3 }}
          className={cn("rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors", published ? "border border-border bg-card text-foreground" : "bg-primary text-primary-foreground")}
        >
          {published ? "Published" : "Publish to 3 channels"}
        </motion.span>
      </div>
      <div className="mt-4 flex gap-2">
        {channels.map((channel) => (
          <span key={channel.label} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[12px]">
            <span className="flex size-3.5 items-center justify-center rounded-[3px] bg-foreground text-background"><Check className="size-2.5" /></span>
            <channel.icon className="size-3.5 text-muted-foreground" />
            {channel.label}
          </span>
        ))}
        <span className="ml-auto self-center text-[11.5px] text-muted-foreground">Audience · Admins on Business plans</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {!published && [0, 1, 2].map((i) => <div key={i} className="h-[132px] rounded-lg border border-dashed border-border-strong/70" />)}
        {published && <>
        <Appear animate={animate} delay={0.1} className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10.5px] font-medium text-muted-foreground">acme.com/changelog</p>
          <p className="mt-3 text-[11px] text-primary-strong">Security · Today</p>
          <p className="mt-1 text-[14px] font-semibold">Audit Log</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">See who changed what in your workspace, and when.</p>
        </Appear>
        <Appear animate={animate} delay={0.3} className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10.5px] font-medium text-muted-foreground">Inbox</p>
          <div className="mt-3 rounded-md bg-surface-subtle/70 p-2.5">
            <p className="text-[11.5px] font-medium">Acme Product</p>
            <p className="text-[11.5px]">Your workspace now keeps a full history</p>
            <p className="truncate text-[10.5px] text-muted-foreground">Ready for your next compliance review…</p>
          </div>
        </Appear>
        <Appear animate={animate} delay={0.5} className="relative overflow-hidden rounded-lg border border-border bg-surface-subtle/50 p-4">
          <p className="text-[10.5px] font-medium text-muted-foreground">Inside Acme</p>
          <div className="mt-3 rounded-md border border-border bg-card p-2.5">
            <p className="text-[10.5px] font-medium text-primary-strong">What&apos;s new</p>
            <p className="mt-0.5 text-[12px] font-semibold">Audit Log is here</p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">Review workspace history in Settings.</p>
          </div>
        </Appear>
        </>}
      </div>
      {!published && (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">Each channel gets its own version — same release, shaped for where it’s read.</p>
      )}
    </div>
  );
}
