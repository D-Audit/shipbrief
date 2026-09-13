"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Mail, MessageSquareText, Rocket, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import type { OnboardedWorkspace, OnboardingChannel, OnboardingGoal, OnboardingRole } from "@/lib/services/auth-service";
import { authService } from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";
import { AuthField, AuthNotice } from "./auth-fields";

const roleValues = ["founder", "product", "engineering", "marketing", "customer_success", "other"] as const;
const goalValues = ["release_updates", "customer_feedback", "product_adoption", "all_of_the_above"] as const;
const channelValues = ["changelog", "email", "in_app"] as const;

const onboardingSchema = z.object({
  workspaceName: z.string().trim().min(2, "Use at least 2 characters."),
  workspaceSlug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, "Use 3–50 lowercase letters, numbers, or hyphens."),
  role: z.enum(roleValues),
  goal: z.enum(goalValues),
  channels: z.array(z.enum(channelValues)).min(1, "Choose at least one channel to start with."),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const steps = ["Workspace", "Your focus", "Channels"];

const roles: { value: OnboardingRole; title: string; detail: string; icon: LucideIcon }[] = [
  { value: "founder", title: "Founder", detail: "Own the narrative", icon: Rocket },
  { value: "product", title: "Product", detail: "Bring releases to life", icon: Sparkles },
  { value: "engineering", title: "Engineering", detail: "Share shipped work", icon: FileText },
  { value: "marketing", title: "Marketing", detail: "Coordinate launch moments", icon: Mail },
  { value: "customer_success", title: "Customer success", detail: "Guide feature discovery", icon: Users },
  { value: "other", title: "Something else", detail: "Set up your own way", icon: MessageSquareText },
];

const goals: { value: OnboardingGoal; title: string; detail: string }[] = [
  { value: "release_updates", title: "Ship better release updates", detail: "Turn product changes into a clear customer story." },
  { value: "customer_feedback", title: "Understand customer demand", detail: "Collect feedback and make the roadmap evidence-led." },
  { value: "product_adoption", title: "Improve product discovery", detail: "Meet customers with relevant in-app updates." },
  { value: "all_of_the_above", title: "Connect the whole loop", detail: "Keep communication, feedback, and direction together." },
];

const channels: { value: OnboardingChannel; title: string; detail: string; icon: LucideIcon }[] = [
  { value: "changelog", title: "Changelog", detail: "A lasting, searchable home for shipped work.", icon: FileText },
  { value: "email", title: "Email", detail: "Reach the right audience for important changes.", icon: Mail },
  { value: "in_app", title: "In-app", detail: "Help people find new value while they are using your product.", icon: MessageSquareText },
];

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

export function OnboardingFlow() {
  const { register, handleSubmit, setValue, trigger, control, formState: { errors, isSubmitting } } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { workspaceName: "", workspaceSlug: "", channels: [] },
  });
  const [step, setStep] = useState(0);
  const [slugEdited, setSlugEdited] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [complete, setComplete] = useState<OnboardedWorkspace | null>(null);
  const [workspaceName = "", workspaceSlug = "", selectedRole, selectedGoal, selectedChannels = []] = useWatch({
    control,
    name: ["workspaceName", "workspaceSlug", "role", "goal", "channels"] as const,
  });
  const workspaceNameField = register("workspaceName");
  const workspaceSlugField = register("workspaceSlug");

  const nextStep = async () => {
    const valid = step === 0
      ? await trigger(["workspaceName", "workspaceSlug"] as const)
      : step === 1
        ? await trigger(["role", "goal"] as const)
        : await trigger("channels");
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const toggleChannel = (channel: OnboardingChannel) => {
    const nextChannels = selectedChannels.includes(channel)
      ? selectedChannels.filter((item) => item !== channel)
      : [...selectedChannels, channel];
    setValue("channels", nextChannels, { shouldValidate: Boolean(errors.channels) });
  };

  const submit = async (values: OnboardingValues) => {
    setSubmissionError(null);
    try {
      const result = await authService.completeOnboarding(values);
      setComplete(result);
      toast.success("Mock workspace created. You are ready to explore ShipBrief.");
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not set up your workspace. Please try again.");
    }
  };

  if (complete) {
    return (
      <div className="space-y-5">
        <div className="border border-success/20 bg-success-muted/45 p-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-success-muted text-success"><CheckCircle2 className="size-5" /></span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">{complete.workspaceName} is ready.</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Your local workspace has a {complete.channels.length === 1 ? "starting channel" : "starting channel set"}, ready for its first release brief.</p>
          <div className="mt-4 flex flex-wrap gap-2">{complete.channels.map((channel) => <span key={channel} className="border border-success/20 bg-background px-2.5 py-1 text-xs font-medium text-success">{channels.find((item) => item.value === channel)?.title}</span>)}</div>
        </div>
        <Link href="/app/overview?onboarding=complete" className={cn(buttonVariants({ size: "lg" }), "h-10 w-full")}>Open {complete.workspaceName} <ArrowRight /></Link>
        <p className="text-center text-xs text-muted-foreground">This workspace is held in the mock service until a real backend is connected.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-7">
      <ol className="grid grid-cols-3 gap-2" aria-label="Onboarding progress">
        {steps.map((label, index) => (
          <li key={label} className="min-w-0">
            <div className={cn("h-1 rounded-full", index <= step ? "bg-primary" : "bg-muted")} aria-hidden="true" />
            <p className={cn("mt-2 truncate text-[11px] font-medium", index <= step ? "text-foreground" : "text-muted-foreground")}>{index + 1}. {label}</p>
          </li>
        ))}
      </ol>

      {submissionError && <AuthNotice>{submissionError}</AuthNotice>}

      {step === 0 && (
        <section className="space-y-5" aria-labelledby="onboarding-workspace-title">
          <div><h2 id="onboarding-workspace-title" className="text-base font-semibold">Name the space your team will share.</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">You can edit these details later in workspace settings.</p></div>
          <AuthField id="onboarding-workspace-name" label="Workspace name" autoComplete="organization" placeholder="Acme product team" error={errors.workspaceName?.message} {...workspaceNameField} onChange={(event) => { workspaceNameField.onChange(event); if (!slugEdited) setValue("workspaceSlug", toSlug(event.target.value)); }} />
          <div className="space-y-2">
            <AuthField id="onboarding-workspace-slug" label="Workspace address" hint="Used for your public changelog" autoCapitalize="none" spellCheck={false} placeholder="acme" error={errors.workspaceSlug?.message} {...workspaceSlugField} onChange={(event) => { setSlugEdited(true); workspaceSlugField.onChange(event); }} />
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="font-medium text-foreground">shipbrief.app/c/{workspaceSlug || toSlug(workspaceName) || "your-workspace"}</span><span>·</span>URL preview</p>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-6" aria-labelledby="onboarding-focus-title">
          <div><h2 id="onboarding-focus-title" className="text-base font-semibold">Make the first workspace feel relevant.</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">This only shapes your local starting context. It never limits what you can do later.</p></div>
          <fieldset className="space-y-2.5"><legend className="text-sm font-medium">Your role</legend><div role="radiogroup" aria-label="Your role" className="grid gap-2 sm:grid-cols-2">{roles.map((role) => <SelectionCard key={role.value} selected={selectedRole === role.value} onClick={() => setValue("role", role.value, { shouldValidate: true })} icon={role.icon} title={role.title} detail={role.detail} radio />)}</div>{errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}</fieldset>
          <fieldset className="space-y-2.5"><legend className="text-sm font-medium">What should ShipBrief help with first?</legend><div role="radiogroup" aria-label="Primary goal" className="grid gap-2">{goals.map((goal) => <SelectionCard key={goal.value} selected={selectedGoal === goal.value} onClick={() => setValue("goal", goal.value, { shouldValidate: true })} title={goal.title} detail={goal.detail} radio />)}</div>{errors.goal && <p className="text-xs text-destructive">{errors.goal.message}</p>}</fieldset>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6" aria-labelledby="onboarding-channels-title">
          <div><h2 id="onboarding-channels-title" className="text-base font-semibold">Pick the first places you will communicate.</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Choose one, two, or all three. Publishing is always explicit when you create a release.</p></div>
          <fieldset className="space-y-2.5"><legend className="sr-only">Starting channels</legend><div className="grid gap-2">{channels.map((channel) => <SelectionCard key={channel.value} selected={selectedChannels.includes(channel.value)} onClick={() => toggleChannel(channel.value)} icon={channel.icon} title={channel.title} detail={channel.detail} />)}</div>{errors.channels && <p className="text-xs text-destructive">{errors.channels.message}</p>}</fieldset>
          <AuthNotice tone="info">Your workspace begins with mock data so you can explore a full ShipBrief workflow immediately.</AuthNotice>
        </section>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        {step > 0 ? <Button type="button" variant="outline" size="lg" className="h-10" onClick={() => setStep((current) => current - 1)}><ArrowLeft />Back</Button> : <Link href="/signup" className="text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</Link>}
        {step < steps.length - 1 ? <Button type="button" size="lg" className="h-10" onClick={() => void nextStep()}>Continue <ArrowRight /></Button> : <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>{isSubmitting ? <Sparkles className="animate-spin" /> : <Check />}{isSubmitting ? "Creating workspace..." : "Create workspace"}</Button>}
      </div>
    </form>
  );
}

function SelectionCard({
  title,
  detail,
  icon: Icon,
  selected,
  onClick,
  radio = false,
}: {
  title: string;
  detail: string;
  icon?: LucideIcon;
  selected: boolean;
  onClick: () => void;
  radio?: boolean;
}) {
  return (
    <button type="button" role={radio ? "radio" : "checkbox"} aria-checked={selected} onClick={onClick} className={cn("flex w-full items-center gap-3 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary/40 bg-primary/5" : "border-border bg-background hover:bg-surface-subtle") }>
      {Icon ? <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}><Icon className="size-4" /></span> : <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-transparent")}><Check className="size-3" /></span>}
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span></span>
      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-transparent", !radio && "rounded") }><Check className="size-3" /></span>
    </button>
  );
}
