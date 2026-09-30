/**
 * ShipBrief design tokens for programmatic access (charts, inline previews).
 * The CSS variables in `src/app/globals.css` are the source of truth; keep
 * these values in sync with the light theme there.
 */

export const colors = {
  background: "#ECEDEF",
  surface: "#F4F5F7",
  surfaceSubtle: "#E4E5E8",
  foreground: "#171717",
  muted: "#636466",
  border: "#DEDFE2",
  borderStrong: "#D4D5D9",
  ink: "#171717",
  inkHover: "#2E2E30",
  primary: "#C7F238",
  primaryHover: "#B9E422",
  primaryStrong: "#566A00",
  primaryMuted: "#EEF8CF",
  success: "#1F7A4D",
  successMuted: "#EAF6EF",
  warning: "#A8620C",
  warningMuted: "#FCF3E4",
  danger: "#C2352B",
  dangerMuted: "#FCEDEC",
} as const;

export const typography = {
  display: { size: "3.5rem", weight: 600, lineHeight: 1.02 },
  pageTitle: { size: "1.5rem", weight: 600, lineHeight: 1.2 },
  sectionTitle: { size: "0.9375rem", weight: 600, lineHeight: 1.3 },
  body: { size: "0.875rem", weight: 400, lineHeight: 1.55 },
  metadata: { size: "0.75rem", weight: 400, lineHeight: 1.4 },
} as const;

export const radius = {
  control: "0.4375rem", // 7px
  card: "0.546875rem", // radius-lg
  surface: "0.875rem", // radius-2xl
} as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const motion = {
  fast: "150ms",
  normal: "200ms",
  slow: "260ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;
