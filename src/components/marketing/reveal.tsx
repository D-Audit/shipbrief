"use client";

import { motion, useReducedMotion } from "motion/react";

/** Fades a block up into place once, the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
  immediate = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
  /** Animate on mount instead of waiting to scroll into view (for above-the-fold content). */
  immediate?: boolean;
}) {
  const reduce = useReducedMotion();
  const Component = as === "li" ? motion.li : as === "section" ? motion.section : motion.div;

  if (reduce) {
    const Static = as;
    return <Static className={className}>{children}</Static>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 18 }}
      {...(immediate ? { animate: { opacity: 1, y: 0 } } : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.25 } })}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
