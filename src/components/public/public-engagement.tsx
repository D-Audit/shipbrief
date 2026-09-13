"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/shared/page-states";
import { useAsyncData } from "@/hooks/use-async-data";
import { publicEngagementService } from "@/lib/services";
import { ReactionBar } from "./reaction-bar";

export function PublicEngagement({ workspace, slug }: { workspace: string; slug: string }) {
  const { state: engagementState, reload: reloadEngagement } = useAsyncData(
    () => publicEngagementService.get(workspace, slug),
    [workspace, slug]
  );
  const { state: commentsState, reload: reloadComments } = useAsyncData(
    () => publicEngagementService.listComments(workspace, slug),
    [workspace, slug]
  );
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [reactionPending, setReactionPending] = useState(false);
  const [commentPending, setCommentPending] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const toggleReaction = async () => {
    if (reactionPending || engagementState.status !== "success") return;

    setReactionPending(true);
    setReactionError(null);
    try {
      const engagement = await publicEngagementService.toggleReaction(workspace, slug);
      setAnnouncement(engagement.hasReacted ? "Marked this update as helpful." : "Removed your helpful reaction.");
      await reloadEngagement();
    } catch (cause) {
      setReactionError(cause instanceof Error ? cause.message : "We could not save your reaction.");
    } finally {
      setReactionPending(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || commentPending) return;

    setCommentPending(true);
    setCommentError(null);
    try {
      await publicEngagementService.createComment({ workspace, slug, author, body });
      setBody("");
      setAnnouncement("Your comment has been posted.");
      await Promise.all([reloadComments(), reloadEngagement()]);
    } catch (cause) {
      setCommentError(cause instanceof Error ? cause.message : "We could not post your comment.");
    } finally {
      setCommentPending(false);
    }
  };

  const engagementLoading = engagementState.status === "idle" || engagementState.status === "loading";
  const commentsLoading = commentsState.status === "idle" || commentsState.status === "loading";

  return (
    <section aria-labelledby="update-engagement-heading" className="space-y-6">
      <h2 id="update-engagement-heading" className="sr-only">Update engagement</h2>

      {engagementLoading && <LoadingState rows={1} />}
      {engagementState.status === "error" && (
        <ErrorState
          title="Reactions unavailable"
          message={engagementState.error}
          onRetry={() => void reloadEngagement()}
        />
      )}
      {engagementState.status === "success" && (
        <ReactionBar
          reactions={engagementState.data.reactions}
          comments={engagementState.data.comments}
          hasReacted={engagementState.data.hasReacted}
          onToggle={() => void toggleReaction()}
          pending={reactionPending}
        />
      )}
      {reactionError && <p role="alert" className="text-sm text-destructive">{reactionError}</p>}

      <section id="comments" aria-labelledby="comments-heading" className="space-y-4 scroll-mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <h3 id="comments-heading" className="text-base font-semibold">Comments</h3>
          {engagementState.status === "success" && (
            <span className="text-sm text-muted-foreground">{engagementState.data.comments} total</span>
          )}
        </div>

        {commentsLoading && <LoadingState rows={2} />}
        {commentsState.status === "error" && (
          <ErrorState
            title="Comments unavailable"
            message={commentsState.error}
            onRetry={() => void reloadComments()}
          />
        )}
        {commentsState.status === "empty" && (
          <div role="status" className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No comments yet. Be the first to share how this update works for you.
          </div>
        )}
        {commentsState.status === "success" && (
          <ul className="space-y-3" aria-label="Comments on this update">
            {commentsState.data.map((comment) => (
              <li key={comment.id}>
                <article className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="font-medium text-foreground">{comment.author}</span>
                    <time dateTime={comment.createdAt} className="text-muted-foreground">
                      {format(new Date(comment.createdAt), "MMM d, yyyy")}
                    </time>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{comment.body}</p>
                </article>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={(event) => void submitComment(event)} className="rounded-xl border border-border bg-surface-subtle/50 p-4" aria-busy={commentPending}>
          <div className="space-y-2">
            <Label htmlFor="public-comment-author">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="public-comment-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="How should we identify you?"
              maxLength={80}
              disabled={commentPending}
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="public-comment">Add a comment</Label>
            <Textarea
              id="public-comment"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share your feedback or a question about this update..."
              maxLength={1000}
              rows={4}
              required
              aria-invalid={Boolean(commentError)}
              aria-errormessage={commentError ? "public-comment-error" : undefined}
              aria-describedby="public-comment-help"
              disabled={commentPending}
            />
            <p id="public-comment-help" className="text-xs text-muted-foreground">Up to 1,000 characters. Your comment is posted as mock data in this frontend preview.</p>
            {commentError && <p id="public-comment-error" role="alert" className="text-sm text-destructive">{commentError}</p>}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.trim().length}/1,000</span>
            <Button type="submit" size="sm" disabled={!body.trim() || commentPending}>
              {commentPending ? <Loader2 className="animate-spin" /> : <Send />}
              {commentPending ? "Posting..." : "Post comment"}
            </Button>
          </div>
        </form>
      </section>

      {announcement && <p role="status" aria-live="polite" className="text-sm text-success">{announcement}</p>}
    </section>
  );
}
