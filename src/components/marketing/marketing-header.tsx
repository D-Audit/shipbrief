"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShipBriefLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ButtonLink } from "@/components/ui/button-link";
import { marketingLinks } from "./marketing-links";
import { MobileMarketingNav } from "./mobile-marketing-nav";
import { cn } from "@/lib/utils";


export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // No entrance animation: the header is in place on first paint and doesn't shift on refresh.
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300",
        scrolled ? "border-border bg-background" : "border-transparent bg-background"
      )}
    >
      <div className="mx-auto grid h-16 max-w-[76rem] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link href="/" aria-label="ShipBrief home" className="w-fit shrink-0 rounded-md">
          <ShipBriefLogo iconSize={32} />
        </Link>
        <nav className="hidden items-center justify-center gap-1 md:flex" aria-label="Main">
          {marketingLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle className="hidden md:inline-flex" />
          <Link href="/login" className="hidden rounded-md px-3 py-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground sm:block">
            Sign in
          </Link>
          <ButtonLink href="/signup" variant="cta" size="pill-sm">
            Get started
          </ButtonLink>
          <MobileMarketingNav />
        </div>
      </div>
    </header>
  );
}
