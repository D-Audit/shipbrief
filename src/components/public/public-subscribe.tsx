"use client";

import { useEffect, useId, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changelogService } from "@/lib/services";
import { cn } from "@/lib/utils";

type SubscribeState = "idle" | "sending" | "sent" | "confirmed" | "error";

/**
 * "Get updates by email" on the public changelog. Double opt-in: the visitor
 * gets a confirmation email and is only added once they click it, which then
 * lands them back here with `?subscribed=1`.
 */
export function PublicSubscribe({ workspace, workspaceName, className }: { workspace: string; workspaceName: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubscribeState>("idle");
  const [message, setMessage] = useState("");
  const inputId = useId();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") !== "1") return;
    // Shown once: drop the flag so a refresh or a shared link doesn't repeat it.
    params.delete("subscribed");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    const timer = window.setTimeout(() => setState("confirmed"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setState("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setState("sending");
    try {
      await changelogService.subscribe(workspace, address);
      setState("sent");
      setMessage(address);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  if (state === "confirmed" || state === "sent") {
    return (
      <section className={cn("flex items-start gap-3 rounded-xl border border-border bg-surface p-4", className)} aria-live="polite">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-strong" aria-hidden="true" />
        <div className="text-sm">
          {state === "confirmed" ? (
            <>
              <p className="font-medium text-foreground">You&apos;re subscribed</p>
              <p className="mt-0.5 text-muted-foreground">New updates from {workspaceName} will arrive in your inbox. Every email has an unsubscribe link.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">Check your inbox</p>
              <p className="mt-0.5 text-muted-foreground">We sent a confirmation link to {message}. Click it to start getting updates.</p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <label htmlFor={inputId} className="text-sm font-medium text-foreground">Get updates by email</label>
            <p className="text-xs text-muted-foreground">New releases from {workspaceName}, straight to your inbox.</p>
          </div>
        </div>
        <div className="flex gap-2 sm:w-[19rem]">
          <Input
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (state === "error") setState("idle");
            }}
            aria-invalid={state === "error"}
            aria-describedby={state === "error" ? `${inputId}-error` : undefined}
            className="h-9 min-w-0 flex-1"
          />
          <Button type="submit" className="h-9 shrink-0" disabled={state === "sending"}>
            {state === "sending" && <Loader2 className="animate-spin" />}Subscribe
          </Button>
        </div>
      </form>
      {state === "error" && <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs text-destructive">{message}</p>}
    </section>
  );
}
