import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { ShipBriefLogo } from "@/components/brand";
import { cn } from "@/lib/utils";
import { AuthGardenVisual } from "./auth-garden-visual";

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
};

export function AuthShell({ eyebrow, title, description, children, wide = false }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-[#f8f8f9] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-[80rem] flex-col sm:min-h-[calc(100svh-3rem)]">
        <header className="flex h-11 shrink-0 items-center justify-between gap-4" aria-label="Authentication navigation">
          <Link href="/" aria-label="Return to ShipBrief home" className="rounded-lg focus-visible:outline-none">
            <ShipBriefLogo iconSize={22} />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </header>

        <div
          className={cn(
            "my-4 grid flex-1 overflow-hidden border border-white/80 bg-card/85 shadow-[0_22px_62px_rgb(31_32_35/0.08)] sm:my-6 sm:rounded-[1.75rem]",
            wide ? "mx-auto w-full max-w-3xl" : "lg:grid-cols-[minmax(23rem,0.94fr)_minmax(0,1.06fr)]"
          )}
        >
          <section className={cn("flex min-w-0 flex-col px-6 py-10 sm:px-12 sm:py-14", !wide && "justify-center", wide && "sm:px-12")}>{/* Content stays intentionally narrow for readable forms. */}
            <div className={cn("w-full", wide ? "mx-auto max-w-2xl" : "mx-auto max-w-md")}>
              <div className={cn(!wide && "text-center")}>
                {eyebrow && (
                  <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
                )}
                <h1 className="text-[1.75rem] font-semibold leading-[1.14] tracking-[-0.045em] text-foreground sm:text-[2rem]">{title}</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
              <div className="mt-8 text-left">{children}</div>
            </div>
          </section>
          {!wide && <AuthGardenVisual />}
        </div>

        <footer className="pb-1 text-center text-[11px] text-muted-foreground sm:text-left">
          ShipBrief frontend preview · Identity, email delivery, and access control connect in the backend phase.
        </footer>
      </div>
    </main>
  );
}
