import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PlanAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * A plan tile in the daisy.now style: a large, borderless smoke card; the
 * highlighted plan inverts to ink with a small rose tag. Shared by the
 * marketing pricing section and the in-app billing page so they always match.
 */
export function PlanCard({
  name,
  price,
  period = "/mo",
  note,
  detail,
  features,
  highlighted = false,
  emphasis = "invert",
  badge,
  action,
}: {
  name: string;
  price: number;
  period?: string;
  note?: string;
  detail: string;
  features: readonly string[];
  highlighted?: boolean;
  /** How a highlighted plan stands out: an inverted black card (marketing) or an ink outline (in-app). */
  emphasis?: "invert" | "outline";
  badge?: string;
  action: PlanAction;
}) {
  const outline = highlighted && emphasis === "outline";
  const inverted = highlighted && !outline;
  const buttonClass = cn(
    "mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    "bg-primary text-primary-foreground hover:bg-primary-hover",
    // The plan you're already on reads as a quiet state, not a greyed-out button.
    highlighted && action.disabled && !action.loading && (inverted ? "bg-ink-foreground/10 text-ink-foreground/80 hover:bg-ink-foreground/10 disabled:opacity-100" : "border border-border bg-surface text-foreground/70 hover:bg-surface disabled:opacity-100")
  );

  return (
    <article className={cn("relative flex flex-col rounded-3xl p-6", inverted ? "sb-invert" : outline ? "bg-surface text-foreground ring-2 ring-foreground/80" : "bg-surface-subtle text-foreground")}>
      {badge && (
        <span className="absolute -top-2.5 right-6 inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">
          {badge}
        </span>
      )}
      <h3 className={cn("text-base font-medium", inverted ? "text-ink-foreground" : "text-foreground")}>{name}</h3>
      <p className="mt-5 flex items-baseline gap-1">
        <span className="sb-numeric text-4xl font-medium tracking-tight">${price}</span>
        <span className={cn("text-sm", inverted ? "text-ink-foreground/60" : "text-muted-foreground")}>{period}</span>
      </p>
      {note && <p className={cn("mt-1 text-xs", inverted ? "text-ink-foreground/50" : "text-muted-foreground")}>{note}</p>}
      <p className={cn("mt-3 text-sm leading-snug tracking-tight", inverted ? "text-ink-foreground/70" : "text-muted-foreground")}>{detail}</p>

      {action.href ? (
        <Link href={action.href} className={buttonClass}>
          {action.label}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} disabled={action.disabled} className={buttonClass}>
          {action.loading && <Loader2 className="size-4 animate-spin" />}
          {action.label}
        </button>
      )}

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className={cn("flex items-start gap-2 text-sm", inverted ? "text-ink-foreground/80" : "text-foreground/75")}>
            <Check className={cn("mt-0.5 size-4 shrink-0", inverted ? "text-ink-foreground/50" : "text-muted-foreground")} aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
