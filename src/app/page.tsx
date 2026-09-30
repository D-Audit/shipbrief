import { Check } from "lucide-react";
import { HeroProductDemo } from "@/components/marketing/hero-product-demo";
import { AIRewriteDemo } from "@/components/marketing/ai-rewrite-demo";
import { ChannelShowcase } from "@/components/marketing/channel-showcase";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { HeroFlowField } from "@/components/marketing/hero-flow-field";
import { HeroSourceStrip } from "@/components/marketing/hero-rotators";
import { Reveal } from "@/components/marketing/reveal";
import { IntegrationMark, integrationMeta } from "@/components/shared/integration-mark";
import { ButtonLink } from "@/components/ui/button-link";
import type { IntegrationProvider } from "@/types";

const providers: IntegrationProvider[] = ["github", "linear", "gitlab", "jira"];

const steps = [
  {
    title: "Connect your tools",
    detail: "ShipBrief reads merged pull requests and closed issues. It never writes to your code.",
  },
  {
    title: "Get a first draft",
    detail: "Related changes are grouped into one release, written for customers in your voice.",
  },
  {
    title: "Review and publish",
    detail: "A teammate approves every word, then it goes to the channels you pick.",
  },
  {
    title: "Learn what landed",
    detail: "Reads, reactions and requests come back and shape what you build next.",
  },
];

const aiPoints = [
  ["Grounded in the source", "Drafts cite the pull requests and issues they came from."],
  ["Written in your voice", "Brand guidance applies to every suggestion."],
  ["Always your call", "Compare, apply or undo. AI never publishes on its own."],
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <a href="#content" className="sr-only fixed top-3 left-3 z-50 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background focus:not-sr-only">
        Skip to content
      </a>
      <div className="relative">
        <MarketingHeader />
        <main id="content">
          <Hero />
        </main>
      </div>
      <Workflow />
      <AISection />
      <Channels />
      <div className="border-t border-border">
        <PricingSection />
      </div>
      <FinalCta />
      <MarketingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative isolate">
      <HeroFlowField targetId="hero-cta" className="inset-x-0 top-0 h-[calc(100svh-12rem)] min-h-[40rem]" />
      <div className="mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-8">
        {/*
          The headline and buttons are in place on the very first paint and never fade or shift.
          Motion lives around them: the flow-field backdrop and the source strip.
          The product demo peeks in below as a cue to scroll.
        */}
        <div className="mx-auto flex min-h-[calc(100svh-18rem)] max-w-3xl flex-col items-center justify-center pt-16 pb-14 text-center">
          <h1 id="hero-heading" className="font-display text-4xl leading-[1.05] font-medium tracking-tighter text-foreground md:text-[3.5rem]">
            Every release, explained <span className="sb-accent-word">clearly</span> to your customers.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-snug tracking-tight text-muted-foreground md:text-lg">
            ShipBrief turns what your team shipped into changelog posts, emails and in-app updates — reviewed by a person, then sent.
          </p>
          <div id="hero-cta" className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" variant="cta" size="pill">
              Get started
            </ButtonLink>
            <ButtonLink href="/app/overview" variant="cta-secondary" size="pill">
              View live demo
            </ButtonLink>
          </div>
          <p className="mt-5 text-[13px] text-muted-foreground">Free for 14 days · No card required</p>
          <HeroSourceStrip />
        </div>

        <div id="product" className="scroll-mt-24">
          <HeroProductDemo />
        </div>
      </div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, children, id, center = false }: { eyebrow: string; title: string; children?: React.ReactNode; id: string; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="text-sm font-medium text-primary-strong">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">{title}</h2>
      {children && <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">{children}</p>}
    </Reveal>
  );
}

function Workflow() {
  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="mt-28 scroll-mt-20 border-t border-border sm:mt-32">
      <div className="mx-auto max-w-[76rem] px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro id="workflow-heading" eyebrow="How it works" title="From merged code to a customer update in four steps." />

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 0.06} className="border-t border-foreground/15 pt-5">
              <span className="sb-numeric text-sm text-muted-foreground">{index + 1}</span>
              <h3 className="mt-3 text-[1.0625rem] font-semibold tracking-[-0.01em]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              {index === 0 && (
                <ul className="mt-4 flex items-center gap-2" aria-label="Supported sources">
                  {providers.map((provider) => (
                    <li key={provider} title={integrationMeta[provider].name}>
                      <IntegrationMark provider={provider} size="sm" />
                      <span className="sr-only">{integrationMeta[provider].name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AISection() {
  return (
    <section id="ai" aria-labelledby="ai-heading" className="scroll-mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[76rem] gap-14 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro id="ai-heading" eyebrow="AI Studio" title="AI writes the first draft. Your team has the last word.">
            Rewrite, shorten, simplify or turn a release into an email — right inside the editor, as suggestions you accept or ignore.
          </SectionIntro>
          <Reveal delay={0.1}>
            <ul className="mt-10 space-y-5">
              {aiPoints.map(([title, detail]) => (
                <li key={title} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-foreground/60" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.15} className="min-w-0 lg:pt-8">
          <AIRewriteDemo />
        </Reveal>
      </div>
    </section>
  );
}

function Channels() {
  return (
    <section id="channels" aria-labelledby="channels-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-[76rem] px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro center id="channels-heading" eyebrow="Channels" title="One release, shaped for every place it’s read.">
          Choose changelog, email, in-app — or all three. ShipBrief keeps one source version and adapts it to each channel.
        </SectionIntro>
        <Reveal delay={0.1} className="mt-14">
          <ChannelShowcase />
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="border-t border-border bg-surface-subtle">
      <div className="relative mx-auto max-w-[76rem] px-4 py-28 text-center sm:px-6 sm:py-32 lg:px-8">
        <Reveal>
          <h2 id="cta-heading" className="mx-auto max-w-[18ch] text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[3rem]">
            You shipped it. Make sure they know.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[1.0625rem] leading-relaxed text-foreground/70">
            Connect a repository and have your first release ready for review in minutes.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" variant="cta" size="pill">
              Get started
            </ButtonLink>
            <ButtonLink href="/app/overview" variant="cta-secondary" size="pill">
              View live demo
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
