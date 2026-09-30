import type { DbExecutor } from "../database/client.js";
import type { releases } from "../database/schema.js";
import type { Channel } from "../types/domain.js";

export type ReleaseRow = typeof releases.$inferSelect;

export type PublishContext = {
  tx: DbExecutor;
  release: ReleaseRow;
  /** Null when the system publishes on schedule. */
  actorUserId: string | null;
};

export type PublishOutcome = {
  /** `published`: live now. `pending`: handed to background delivery (e.g. email). `skipped`: nothing to do. */
  status: "published" | "pending" | "skipped" | "failed";
  meta?: Record<string, unknown>;
  error?: string;
};

/**
 * A delivery channel. Publishing a release runs every selected channel's
 * publisher inside the publish transaction; each one records its own outcome
 * in `release_publications`. Adding a channel means adding a publisher here —
 * the release workflow itself does not change.
 */
export interface ChannelPublisher {
  readonly channel: Channel;
  publish(context: PublishContext): Promise<PublishOutcome>;
  /** Called when a published release is archived, to withdraw it from the channel. */
  withdraw?(context: PublishContext): Promise<void>;
}
