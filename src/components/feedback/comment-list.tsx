"use client";

import { useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FeedbackComment } from "@/types";

export function CommentList({
  comments,
  onCreate,
}: {
  comments: FeedbackComment[];
  onCreate: (input: { body: string; isInternal: boolean }) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!body.trim() || pending) return;
    setPending(true);
    try {
      await onCreate({ body, isInternal });
      setBody("");
      setIsInternal(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center gap-2"><MessageSquarePlus className="size-4 text-primary" /><h2 id="comments-heading" className="text-base font-semibold">Conversation</h2><span className="text-sm text-muted-foreground">{comments.length} shown</span></div>
      <div className="space-y-3">
        {comments.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">No comments yet. Add context or invite a customer to share more.</p> : comments.map((comment) => (
          <article key={comment.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-foreground">{comment.author}</span>{comment.isInternal && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">Internal note</span>}<time className="text-muted-foreground">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(comment.createdAt))}</time></div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{comment.body}</p>
          </article>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface-subtle/50 p-3">
        <Label htmlFor="feedback-comment">Add a comment</Label>
        <Textarea id="feedback-comment" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add customer context, a decision, or a follow-up..." className="mt-2 bg-surface" rows={3} />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Label className="w-fit cursor-pointer text-xs font-normal text-muted-foreground"><input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} className="size-3.5 accent-primary" />Internal-only note</Label>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={!body.trim() || pending}>{pending && <Loader2 className="animate-spin" />}{pending ? "Saving..." : "Add comment"}</Button>
        </div>
      </div>
    </section>
  );
}
