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
      { href: "/#widget", label: "In-app widget" },
      { href: "/#email", label: "Email and contacts" },
      { href: "/#loop", label: "Feedback and roadmap" },
      { href: "/#faq", label: "FAQ" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/app/overview", label: "Demo workspace" },
      { href: "/c/acme", label: "Example changelog" },
      { href: "/embed/whats-new", label: "Widget preview" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

const socialLinks = [
  {
    href: "https://x.com/KDonJesus",
    label: "ShipBrief on X",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px] fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: "https://www.instagram.com/donje_sus12/",
    label: "ShipBrief on Instagram",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" className="fill-current" />
      </svg>
    ),
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[76rem] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <div className="max-w-xs">
            <Link href="/" aria-label="ShipBrief home" className="inline-flex rounded-md">
              <ShipBriefLogo iconSize={28} />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Release communication for product teams. From merged code to the customers who asked for it.
            </p>
            <div className="mt-6 -ml-2 flex items-center gap-1">
              {socialLinks.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="inline-flex size-10 items-center justify-center rounded-md text-foreground/75 transition-colors hover:text-foreground focus-visible:text-foreground"
                >
                  {social.icon}
                </a>
              ))}
            </div>
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
