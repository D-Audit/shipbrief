/**
 * ShipBrief's restrained colour vocabulary. Everything maps onto the app's own
 * palette — ink, smoke greys and the rose accent — so screens stay calm and on
 * brand. Semantic green/amber/red appear only as small status dots, never as
 * fills or tinted backgrounds.
 *
 * The tone names are kept so call sites can express intent ("this is the
 * primary series", "this is secondary"), but they resolve to ink/grey shades.
 */
export type Tone = "rose" | "blue" | "green" | "amber" | "violet" | "red" | "ink" | "neutral";

/** Glyph colour for plain (background-free) icons. */
export const toneText: Record<Tone, string> = {
  rose: "text-primary-strong",
  ink: "text-foreground",
  red: "text-danger",
  blue: "text-muted-foreground",
  green: "text-muted-foreground",
  amber: "text-muted-foreground",
  violet: "text-muted-foreground",
  neutral: "text-muted-foreground",
};

/** Kept for existing call sites; identical to `toneText` — icons never sit on tinted squares. */
export const toneTile = toneText;

/** Solid fill for dots, bars and stripes: rose, then ink and grey steps. */
export const toneFill: Record<Tone, string> = {
  rose: "bg-primary-strong",
  ink: "bg-foreground",
  blue: "bg-foreground/70",
  violet: "bg-foreground/45",
  green: "bg-foreground/30",
  amber: "bg-foreground/55",
  red: "bg-danger",
  neutral: "bg-border-strong",
};

/** Chart colours (SVG fills) from the same scale. */
export const toneVar: Record<Tone, string> = {
  rose: "var(--primary-strong)",
  ink: "var(--foreground)",
  blue: "var(--chart-3)",
  violet: "var(--chart-4)",
  green: "var(--chart-3)",
  amber: "var(--chart-4)",
  red: "var(--danger)",
  neutral: "var(--border-strong)",
};
