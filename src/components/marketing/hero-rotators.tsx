"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mail, PanelTop, ScrollText } from "lucide-react";
import { IntegrationMark, integrationMeta } from "@/components/shared/integration-mark";
import type { IntegrationProvider } from "@/types";

/** Shared swap: the old item lifts away and blurs out while the new one rises in. */
const swap = {
  initial: { opacity: 0, y: 10, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, filter: "blur(6px)" },
};
const ease = [0.22, 1, 0.36, 1] as const;

/** Cycles 0…count-1 every `ms`; frozen at 0 under reduced motion. */
function useCycle(count: number, ms: number) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms, reduce]);
  return index;
}

const sources: IntegrationProvider[] = ["github", "gitlab", "linear", "jira"];
const channels = [
  { name: "Changelog", icon: ScrollText },
  { name: "Email", icon: Mail },
  { name: "In-app", icon: PanelTop },
];

/**
 * "Imports from" sources and "Publishes to" channels, swapping item by item
 * with a small stagger.
 */
export function HeroSourceStrip() {
  const index = useCycle(2, 4200);
  const showSources = index === 0;
  const items = showSources
    ? sources.map((provider) => ({ key: provider, label: integrationMeta[provider].name, mark: <IntegrationMark provider={provider} size="sm" /> }))
    : channels.map(({ name, icon: Icon }) => ({
        key: name,
        label: name,
        mark: (
          <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-surface text-foreground">
            <Icon className="size-3.5" />
          </span>
        ),
      }));

  return (
    <div className="mt-12 flex flex-col items-center gap-4">
      <div className="relative h-4 overflow-visible">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p key={showSources ? "from" : "to"} {...swap} transition={{ duration: 0.45, ease }} className="text-[13px] whitespace-nowrap text-muted-foreground">
            {showSources ? "Imports from" : "Publishes to"}
          </motion.p>
        </AnimatePresence>
      </div>
      <ul className="flex h-7 items-center justify-center gap-5 sm:gap-7" aria-label={showSources ? "Supported sources" : "Publishing channels"}>
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item, i) => (
            <motion.li
              key={item.key}
              {...swap}
              transition={{ duration: 0.45, ease, delay: i * 0.07 }}
              className="flex items-center gap-2 text-sm font-medium text-foreground/80"
            >
              {/* Names only on phones, so all four sources fit on one line. */}
              <span className="hidden sm:inline-flex">{item.mark}</span>
              {item.label}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
