import Link from "next/link";
import { ShipBriefLogo } from "@/components/brand";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Product" },
      { href: "/#workflow", label: "Workflow" },
      { href: "/#ai", label: "AI Studio" },
      { href: "/#channels", label: "Channels" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/app/overview", label: "Demo workspace" },
      { href: "/c/acme", label: "Example changelog" },
      { href: "/embed/whats-new", label: "In-app widget" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[76rem] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="max-w-xs">
            <Link href="/" aria-label="ShipBrief home" className="inline-flex rounded-md">
              <ShipBriefLogo iconSize={28} />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Release communication for product teams. From merged code to the customers who asked for it.
            </p>
          </div>
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-medium">{group.title}</p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} ShipBrief</p>
          <p>Changelog · Email · In-app</p>
        </div>
      </div>
    </footer>
  );
}
