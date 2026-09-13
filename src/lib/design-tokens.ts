/**
 * ShipBrief design tokens — single source of truth for programmatic access.
 * CSS variables in globals.css mirror these values.
 */

export const colors = {
  background: "#ECEDEF",
  surface: "#F8F8F9",
  surfaceSubtle: "#E4E5E8",
  foreground: "#171717",
  muted: "#68696E",
  border: "#D4D5D9",
  borderStrong: "#C4C5CA",
  primary: "#E40178",
  primaryHover: "#BD0063",
  primaryMuted: "#FEE5F1",
  success: "#16A34A",
  successMuted: "#ECFDF3",
  warning: "#D97706",
  warningMuted: "#FFFBEB",
  danger: "#DC2626",
  dangerMuted: "#FEF2F2",
} as const;

export const typography = {
  display: { size: "2.5rem", weight: 600, lineHeight: 1.15 },
  pageTitle: { size: "1.75rem", weight: 600, lineHeight: 1.2 },
  sectionTitle: { size: "1.125rem", weight: 600, lineHeight: 1.3 },
  body: { size: "0.9375rem", weight: 400, lineHeight: 1.55 },
  metadata: { size: "0.75rem", weight: 400, lineHeight: 1.4 },
} as const;

export const radius = {
  control: "0.4375rem", // 7px
  card: "0.625rem", // 10px
  surface: "0.875rem", // 14px
} as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const motion = {
  fast: "150ms",
  normal: "200ms",
  slow: "250ms",
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;
