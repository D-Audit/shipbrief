import { Check, ChevronDown } from "lucide-react";
import { HeroProductDemo } from "@/components/marketing/hero-product-demo";
import { AIRewriteDemo } from "@/components/marketing/ai-rewrite-demo";
import { AudienceDemo } from "@/components/marketing/audience-demo";
import { ChannelShowcase } from "@/components/marketing/channel-showcase";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingSection } from "@/components/marketing/pricing-section";
import { HeroFlowField } from "@/components/marketing/hero-flow-field";
import { HeroSourceStrip } from "@/components/marketing/hero-rotators";
import { Reveal } from "@/components/marketing/reveal";
import { WidgetDemo } from "@/components/marketing/widget-demo";
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

const widgetSteps = [
  {
    title: "Paste one snippet",
    detail: "Add it once to the layout every page uses, the same way you add analytics. A What's new button appears in your product.",
  },
  {
    title: "Tell it who is signed in",
    detail: "Pass the user and a signature from your server. ShipBrief recognises them on every device and adds them to your contacts.",
  },
  {
    title: "Publish with In-app ticked",
    detail: "The update shows in the feed with an unread count. Users read it, react, follow your button, or switch on email.",
  },
];

const audiencePoints = [
  ["Builds itself", "Everyone your widget recognises becomes a contact, with their plan and tags kept current."],
  ["Consent first", "Visitors confirm their address before they are added. Forged sign-ins are refused."],
  ["The right people", "Target an audience by plan, tag or account age, and see how many people it holds before you send."],
  ["Unsubscribe is final", "One click in any email, or a switch in the widget. They are never emailed again unless they opt back in."],
];

const loopItems = [
  {
    title: "Feedback board",
    detail: "Requests arrive from your changelog, the API and your team. Votes, comments and duplicates merge into one list, and AI groups similar asks into themes.",
  },
  {
    title: "Roadmap",
    detail: "Turn a theme into a roadmap item and share a public roadmap. When the release that delivers it ships, linked requests are marked shipped.",
  },
  {
    title: "Analytics",
    detail: "Views, reactions, comments, button clicks and emails sent, per release and per channel, so you know which updates customers noticed.",
  },
];

const platformItems = [
  ["Review before anything ships", "Draft, review, approve, then publish now or schedule. Roles decide who can write, approve and send."],
  ["Your sources, read only", "GitHub, GitLab, Linear and Jira sync merged work every few minutes. ShipBrief never reads diffs or writes to your code."],
  ["Your brand", "Logo, accent colour, light or dark theme, and a custom domain for your changelog."],
  ["API and webhooks", "Create contacts and read releases over REST. Get webhooks when releases publish, feedback arrives or a campaign is sent."],
  ["Every channel from one draft", "Write once, then adjust the in-app or email version where it needs to be shorter. Previews show each before you publish."],
  ["Built to be trusted", "Signed widget sign-ins, double opt-in, one-click unsubscribe and an audit log of every change."],
];

const faqs = [
  {
    question: "How do I add the widget to my product?",
    answer:
      "Copy the snippet from Channels → In-app and paste it into the layout file every page uses, just before </body>. In Next.js that is app/layout.tsx; in Laravel, Django or Rails it is your base template. Nothing else in your code changes.",
  },
  {
    question: "Do I have to identify my users?",
    answer:
      "No. Without it the widget still shows your updates, and visitors can subscribe by email. Identifying signed-in users adds them to your contacts automatically and keeps their read state across devices.",
  },
  {
    question: "Where do email addresses come from?",
    answer:
      "From your users signing in through the widget, from people who confirm a subscribe form, from your server through the API, or from a CSV import. You see all of them, and where each came from, in Contacts.",
  },
  {
    question: "Can I open the feed from my own button?",
    answer:
      "Yes. Add data-shipbrief-toggle to any element, or call ShipBrief.open(). An element with data-shipbrief-badge shows the unread count.",
  },
  {
    question: "Does ShipBrief see my code?",
    answer:
      "No. It reads pull request and issue titles and descriptions to draft releases. It never reads diffs and never writes to your repositories.",
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
      <WidgetSection />
      <AudienceSection />
      <LoopSection />
      <PlatformSection />
      <FaqSection />
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
            ShipBrief turns what your team shipped into changelog posts, emails and in-app updates, reviewed by a person, then sent.
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
            Rewrite, shorten, simplify or turn a release into an email, right inside the editor, as suggestions you accept or ignore.
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
          Choose changelog, email, in-app, or all three. ShipBrief keeps one source version and adapts it to each channel.
        </SectionIntro>
        <Reveal delay={0.1} className="mt-14">
          <ChannelShowcase />
        </Reveal>
      </div>
    </section>
  );
}

function WidgetSection() {
  return (
    <section id="widget" aria-labelledby="widget-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-[76rem] gap-14 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:px-8">
        <div>
          <SectionIntro id="widget-heading" eyebrow="In-app widget" title="Updates where your users already are.">
            A What&apos;s new panel inside your product, with an unread count, reactions and an email switch. One snippet installs it.
          </SectionIntro>
          <ol className="mt-10 space-y-7">
            {widgetSteps.map((step, index) => (
              <Reveal as="li" key={step.title} delay={0.06 * index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
                <span className="sb-numeric pt-px text-sm text-muted-foreground">{index + 1}</span>
                <span>
                  <span className="block text-[1.0625rem] font-semibold tracking-[-0.01em]">{step.title}</span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">{step.detail}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
        <Reveal delay={0.1} className="min-w-0">
          <WidgetDemo />
        </Reveal>
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section id="email" aria-labelledby="email-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-[76rem] px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro id="email-heading" eyebrow="Email and contacts" title="An email list that builds itself.">
          Every person your product signs in, every confirmed subscriber and every contact your server sends lands in one list. Publish with Email ticked and it reaches the audience you choose.
        </SectionIntro>
        <Reveal delay={0.1} className="mt-14">
          <AudienceDemo />
        </Reveal>
        <ul className="mt-14 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {audiencePoints.map(([title, detail], index) => (
            <Reveal as="li" key={title} delay={0.05 * index} className="border-t border-foreground/15 pt-5">
              <h3 className="text-[1.0625rem] font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function LoopSection() {
  return (
    <section id="loop" aria-labelledby="loop-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-[76rem] px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro id="loop-heading" eyebrow="Feedback and roadmap" title="Hear what customers ask for, and show them when it ships." />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {loopItems.map((item, index) => (
            <Reveal key={item.title} delay={0.06 * index} className="rounded-xl border border-border bg-card p-6">
              <span className="sb-numeric text-sm text-muted-foreground">{index + 1}</span>
              <h3 className="mt-3 text-[1.0625rem] font-semibold tracking-[-0.01em]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section id="platform" aria-labelledby="platform-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-[76rem] px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro id="platform-heading" eyebrow="For teams" title="Everything a release needs, in one place." />
        <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {platformItems.map(([title, detail], index) => (
            <Reveal as="li" key={title} delay={0.04 * index} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-foreground/60" aria-hidden="true" />
              <span>
                <span className="block text-[1.0625rem] font-semibold tracking-[-0.01em]">{title}</span>
                <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">{detail}</span>
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-[76rem] gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
        <SectionIntro id="faq-heading" eyebrow="Questions" title="How it works, in plain words." />
        <Reveal delay={0.1} className="divide-y divide-border border-y border-border">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.0625rem] font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
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
