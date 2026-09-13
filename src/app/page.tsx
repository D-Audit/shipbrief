import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, GitBranch, Send, Sparkles, type LucideIcon } from "lucide-react";
import { ShipBriefLogo } from "@/components/brand";
import { LandingHeroVisual } from "@/components/marketing/landing-hero-visual";
import { MobileMarketingNav } from "@/components/marketing/mobile-marketing-nav";
import { PricingSection } from "@/components/marketing/pricing-section";
import { buttonVariants } from "@/components/ui/button";

const workflow: { number: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    number: "01",
    title: "Bring in the work",
    description: "Connect source context from GitHub, Linear, or a note your team already trusts.",
    icon: GitBranch,
  },
  {
    number: "02",
    title: "Shape the customer story",
    description: "Use AI to find the clear version, while your team stays in control of every word.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Meet customers in context",
    description: "Publish one connected release across changelog, email, and the in-app feed.",
    icon: Send,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <a href="#marketing-content" className="sr-only fixed top-3 left-3 z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm focus:not-sr-only">Skip to content</a>
      <MarketingHeader />

      <main id="marketing-content">
        <Hero />
        <Workflow />
        <MomentumStory />
        <PricingSection />
      </main>

      <MarketingFooter />
    </div>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="ShipBrief home" className="shrink-0"><ShipBriefLogo iconSize={26} /></Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Marketing navigation">
          <a href="#product" className="transition-colors hover:text-foreground">Product</a>
          <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
          <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          <Link href="/c/acme" className="transition-colors hover:text-foreground">Changelog</Link>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <MobileMarketingNav />
          <Link href="/login" className={`${buttonVariants({ variant: "ghost", size: "sm" })} h-9 px-3 max-[359px]:hidden`}>Sign in</Link>
          <Link href="/signup" className={`${buttonVariants({ size: "sm" })} h-9 px-3`}><span className="min-[360px]:hidden">Start</span><span className="hidden min-[360px]:inline">Start for free</span> <ArrowRight /></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="product" className="border-b border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.82fr)_minmax(34rem,1.18fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-24">
        <div className="relative max-w-xl">
          <div className="relative">
            <h1 className="max-w-[11ch] text-4xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-5xl lg:text-[4.25rem]">Make the work you ship <span className="text-primary">easy to understand.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">ShipBrief turns the context behind a product change into a clear customer story—then keeps its impact connected to what your team learns next.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/signup" className={buttonVariants({ size: "lg" })}>Create your first brief <ArrowRight /></Link><Link href="/app/overview" className={buttonVariants({ variant: "outline", size: "lg" })}>Explore the product <ArrowUpRight /></Link></div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary" />Human review remains in control</span><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary" />One release, every channel</span></div>
          </div>
        </div>
        <LandingHeroVisual />
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="grid gap-6 border-b border-border pb-10 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-end">
        <div><p className="text-[11px] font-medium tracking-[0.14em] text-primary uppercase">The ShipBrief loop</p><h2 className="mt-3 max-w-md text-3xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-4xl">One release, from shipped work to product signal.</h2></div>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">A focused flow gives every update a source, a customer point of view, and a clear place to land—without asking your team to recreate the story for every channel.</p>
      </div>
      <div className="grid divide-y divide-border border-b border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {workflow.map((step) => {
          const Icon = step.icon;
          return <article key={step.number} className="relative py-7 sm:px-6 sm:py-9 first:sm:pl-0 last:sm:pr-0"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-muted-foreground">{step.number}</span><Icon className="size-4 text-primary" /></div><h3 className="mt-8 text-base font-semibold">{step.title}</h3><p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{step.description}</p></article>;
        })}
      </div>
    </section>
  );
}

function MomentumStory() {
  return (
    <section className="border-y border-border bg-surface-subtle/45">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center lg:gap-16 lg:px-8">
        <div className="relative aspect-[4/4.6] max-h-[39rem] overflow-hidden rounded-[1.35rem] border border-white/80 bg-[#e6ebe3] shadow-[0_24px_52px_rgb(78_97_65/0.11)]"><Image src="/images/shipbrief-wind-field.png" alt="Wind turbine over a sunlit wild-grass field" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[42%_center]" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/8%)_32%,rgb(255_255_255/26%)_100%)]" /><div className="absolute top-5 left-5 inline-flex items-center gap-2 border border-white/75 bg-card/86 px-3 py-1.5 text-[11px] font-medium text-foreground backdrop-blur-sm"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_0_4px_rgb(200_92_111/12%)]" />Clarity in motion</div><div className="absolute right-5 bottom-5 left-5 border border-white/80 bg-card/88 p-4 text-foreground shadow-[0_10px_24px_rgb(32_47_27/0.11)] backdrop-blur-md"><p className="text-sm font-medium">Good work should keep moving.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">ShipBrief holds the release story together from the first source signal to the customer response.</p></div></div>
        <div className="max-w-xl lg:justify-self-end"><p className="text-[11px] font-medium tracking-[0.14em] text-primary uppercase">A calmer product surface</p><h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-4xl">Give every update the attention it deserves.</h2><p className="mt-5 text-base leading-7 text-muted-foreground">The workspace is built for the work between shipping and understanding: collecting the context, finding the customer value, choosing the right channel, and learning what mattered.</p><div className="mt-8 space-y-3"><FeatureLine title="Source-aware drafts" detail="Start from the work your team has already shipped." /><FeatureLine title="Review before every send" detail="Keep judgment and brand voice where they belong: with your team." /><FeatureLine title="Signals that inform the next release" detail="Connect feedback, engagement, and roadmap evidence without losing context." /></div><Link href="/app/ai-studio" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">Open AI Studio <ArrowUpRight className="size-3.5" /></Link></div>
      </div>
    </section>
  );
}

function FeatureLine({ title, detail }: { title: string; detail: string }) {
  return <div className="flex gap-3 border-l border-primary/40 pl-4"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" /><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p></div></div>;
}

function MarketingFooter() {
  const groups = [
    {
      title: "Product",
      links: [
        { href: "#product", label: "Release workspace" },
        { href: "#workflow", label: "Workflow" },
        { href: "/pricing", label: "Pricing" },
        { href: "/c/acme", label: "Public changelog" },
      ],
    },
    {
      title: "Workspace",
      links: [
        { href: "/app/releases", label: "Releases" },
        { href: "/app/ai-studio", label: "AI Studio" },
        { href: "/app/feedback", label: "Feedback" },
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

  return (
    <footer className="border-t border-[#e5e5e5] bg-white text-[#171717]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.35fr_repeat(3,minmax(0,.72fr))] md:gap-8">
          <div className="max-w-sm">
            <Link href="/" aria-label="ShipBrief home" className="inline-flex w-fit"><ShipBriefLogo iconSize={30} /></Link>
            <p className="mt-5 text-sm leading-6 text-[#67676d]">Clear product communication, grounded in customer signal. Ship the story behind the work with one connected release workspace.</p>
            <Link href="/signup" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/70">Start your first brief <ArrowRight className="size-3.5" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:col-span-3 md:contents">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="text-[11px] font-medium tracking-[0.14em] text-[#88888f] uppercase">{group.title}</p>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}><Link href={link.href} className="text-sm text-[#55555c] transition-colors hover:text-primary">{link.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[#e5e5e5] pt-6 text-xs leading-5 text-[#85858c] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ShipBrief. Built for teams who care how their work lands.</p>
          <p>Changelog, email, and in-app updates—one connected story.</p>
        </div>
      </div>
    </footer>
  );
}
