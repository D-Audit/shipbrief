"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { feedbackService } from "@/lib/services";

type SubmissionState = "idle" | "submitting" | "success" | "error";

/**
 * A deliberately small public intake surface. It only collects the details a
 * visitor can reasonably provide; triage, priority, and tags remain internal
 * workspace concerns.
 */
export function PublicFeedbackDialog({ workspace }: { workspace: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [state, setState] = useState<SubmissionState>("idle");
  const [message, setMessage] = useState("");
  const id = useId();
  const titleId = `${id}-feedback-title`;
  const contextId = `${id}-feedback-context`;

  const reset = () => {
    setTitle("");
    setContext("");
    setState("idle");
    setMessage("");
  };

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanContext = context.trim();

    if (cleanTitle.length < 3) {
      setState("error");
      setMessage("Add a short title with at least 3 characters.");
      return;
    }
    if (cleanContext.length < 10) {
      setState("error");
      setMessage("Add a little more context so the team can understand the request.");
      return;
    }

    setState("submitting");
    setMessage("");

    try {
      await feedbackService.create({
        title: cleanTitle,
        description: cleanContext,
        source: "customer",
      });
      setState("success");
      setMessage("Thanks — your feedback has been saved.");
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "We could not save your feedback. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Share feedback about ${workspace}`}
      >
        <Send aria-hidden="true" />
        <span className="hidden sm:inline">Share feedback</span>
        <span className="sr-only sm:hidden">Share feedback</span>
      </Button>
      <DialogContent className="sm:max-w-md">
        {state === "success" ? (
          <>
            <DialogHeader>
              <div className="flex size-9 items-center justify-center rounded-full bg-success-muted text-success">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle>Feedback shared</DialogTitle>
              <DialogDescription>
                {message} It is stored as local mock data while the frontend is connected to a real service later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => changeOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle>Share feedback</DialogTitle>
              <DialogDescription>
                Tell {workspace} what would make the product more useful. Your request goes to the product team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={titleId}>What would you like to see?</Label>
              <Input
                id={titleId}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (state === "error") {
                    setState("idle");
                    setMessage("");
                  }
                }}
                placeholder="A clear title for your request"
                required
                disabled={state === "submitting"}
                aria-invalid={state === "error" && title.trim().length < 3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={contextId}>Context</Label>
              <Textarea
                id={contextId}
                value={context}
                onChange={(event) => {
                  setContext(event.target.value);
                  if (state === "error") {
                    setState("idle");
                    setMessage("");
                  }
                }}
                rows={4}
                placeholder="What are you trying to do, and why would this help?"
                required
                disabled={state === "submitting"}
                aria-invalid={state === "error" && context.trim().length < 10}
              />
            </div>
            {state === "error" && message && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</p>}
            {state === "submitting" && <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Saving your feedback…</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={state === "submitting"}>Cancel</Button>
              <Button type="submit" disabled={state === "submitting"}>
                {state === "submitting" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {state === "submitting" ? "Sharing…" : "Share feedback"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
