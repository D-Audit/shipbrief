import { cn } from "@/lib/utils";
import type { ElementType, HTMLAttributes } from "react";

type TypographyVariant =
  | "display"
  | "page-title"
  | "section-title"
  | "body"
  | "body-medium"
  | "metadata"
  | "metadata-medium";

const variantStyles: Record<TypographyVariant, string> = {
  display:
    "text-[2.5rem] font-semibold leading-[1.15] tracking-tight sm:text-[3rem] sm:leading-[1.1]",
  "page-title": "text-[1.625rem] font-semibold leading-[1.2] tracking-tight sm:text-[1.875rem]",
  "section-title": "text-lg font-semibold leading-[1.3] tracking-tight",
  body: "text-[0.9375rem] font-normal leading-[1.55] text-foreground",
  "body-medium": "text-[0.9375rem] font-medium leading-[1.55] text-foreground",
  metadata: "text-xs font-normal leading-[1.4] text-muted-foreground",
  "metadata-medium": "text-xs font-medium leading-[1.4] text-muted-foreground",
};

const defaultElements: Record<TypographyVariant, ElementType> = {
  display: "h1",
  "page-title": "h1",
  "section-title": "h2",
  body: "p",
  "body-medium": "p",
  metadata: "span",
  "metadata-medium": "span",
};

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  as?: ElementType;
}

export function Typography({
  variant = "body",
  as,
  className,
  children,
  ...props
}: TypographyProps) {
  const Component = as ?? defaultElements[variant];

  return (
    <Component className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </Component>
  );
}
