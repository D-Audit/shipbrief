"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Token = { text: string; kind?: "add" | "remove" };

const source = "feat(export): add async CSV job queue, stream rows to S3, email signed URL on completion. Removes 10k row limit.";

const proposals: { id: string; label: string; tokens: Token[] }[] = [
  {
    id: "customer",
    label: "Make customer-focused",
    tokens: [
      { text: "Export " },
      { text: "any report, however large", kind: "add" },
      { text: " async CSV job queue", kind: "remove" },
      { text: ". " },
      { text: "We’ll email you a download link the moment it’s ready, with no more 10,000-row limit.", kind: "add" },
    ],
  },
  {
    id: "shorten",
    label: "Shorten",
    tokens: [
      { text: "Export any report, " },
      { text: "however large", kind: "remove" },
      { text: " " },
      { text: "of any size", kind: "add" },
      { text: ". " },
      { text: "We’ll email you a download link the moment it’s ready", kind: "remove" },
      { text: " " },
      { text: "The link arrives by email", kind: "add" },
      { text: "." },
    ],
  },
  {
    id: "simplify",
    label: "Simplify",
    tokens: [
      { text: "Big reports now export " },
      { text: "without limits", kind: "add" },
      { text: ". " },
      { text: "Start the export, keep working, and we’ll email you when it’s done.", kind: "add" },
    ],
  },
  {
    id: "translate",
    label: "Translate · Spanish",
    tokens: [
      { text: "Exporta cualquier informe, sin importar su tamaño. ", kind: "add" },
      { text: "Te enviaremos el enlace de descarga por correo en cuanto esté listo.", kind: "add" },
    ],
  },
];

export function AIRewriteDemo() {
  const [active, setActive] = useState(0);
  const [applied, setApplied] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });

  useEffect(() => {
    if (reduce || interacted || !inView) return;
    const timer = window.setTimeout(() => {
      setApplied(false);
      setActive((current) => (current + 1) % proposals.length);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [active, inView, interacted, reduce]);

  const proposal = proposals[active];
  const choose = (index: number) => {
    setInteracted(true);
    setApplied(false);
    setActive(index);
  };

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap gap-1.5 border-b border-border bg-surface-subtle/60 p-3" role="group" aria-label="Writing actions">
        {proposals.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={index === active}
            onClick={() => choose(index)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              index === active ? "bg-card font-medium text-foreground ring-1 ring-border-strong" : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2">
        <div className="border-b border-border p-5 md:border-r md:border-b-0 sm:p-6">
          <p className="text-xs font-medium text-muted-foreground">From the pull request</p>
          <p className="mt-3 font-mono text-[13px] leading-relaxed text-muted-foreground">{source}</p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{applied ? "Applied to your draft" : "Proposed change"}</p>
            {applied && <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Check className="size-3.5" />Applied</span>}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={`${proposal.id}-${applied}`}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-3 text-[15px] leading-relaxed"
              aria-live="polite"
            >
              {proposal.tokens.map((token, index) => {
                if (applied) return token.kind === "remove" ? null : <span key={index}>{token.text}</span>;
                if (token.kind === "add") return <span key={index} className="rounded-[3px] bg-success-muted text-foreground decoration-success/40 underline decoration-1 underline-offset-4">{token.text}</span>;
                if (token.kind === "remove") return <del key={index} className="text-muted-foreground decoration-danger/50">{token.text}</del>;
                return <span key={index}>{token.text}</span>;
              })}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 sm:px-6">
        {!applied ? (
          <button type="button" onClick={() => { setInteracted(true); setApplied(true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90">
            <Check className="size-3.5" /> Apply
          </button>
        ) : (
          <button type="button" onClick={() => setApplied(false)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-3 text-[13px] font-medium">
            <Undo2 className="size-3.5" /> Undo
          </button>
        )}
        <button type="button" onClick={() => choose((active + 1) % proposals.length)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <RotateCcw className="size-3.5" /> Regenerate
        </button>
        <span className="ml-auto text-xs text-muted-foreground">Your draft only changes when you apply.</span>
      </div>
    </div>
  );
}
