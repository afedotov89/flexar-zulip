// Flexar Hub Web — "mark all as read" header button (Phase 3.4).
//
// A small action above the message list that marks every unread message
// in the current narrow as read. The endpoint and the optimistic effect
// are derived from the narrow's shape:
//
//   combined feed (no narrow)    → POST /mark_all_as_read
//                                  + clear *every* unread bucket locally
//   channel-only narrow          → POST /mark_stream_as_read
//                                  + clear that channel's buckets locally
//   channel + topic narrow       → POST /mark_topic_as_read
//                                  + clear that topic's bucket locally
//
// Other narrows (DMs, mentions, starred, search, …) do not get the
// button: Zulip has no dedicated "mark as read" endpoint scoped to
// those, the mark-as-read-on-scroll path already handles the common
// "I read these" interaction, and a synthetic batch over the narrow's
// unread ids would be a larger feature than this phase aims to ship.
//
// The realtime `update_message_flags` event with `op:add flag:read`
// arrives shortly after the call returns; the unread-store reducer is
// idempotent on the same ids, so the optimistic and reconciled states
// agree without a flicker.

import { useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { apiClient } from "../../api";
import type { Narrow, StreamId } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { useUnreadStore } from "../../stores/unreadStore";
import {
  topicUnreadCount,
  type UnreadBuckets,
} from "../../stores/unreadReducer";
import styles from "./MarkAsReadButton.module.css";

/**
 * Identify the read-scope encoded by the narrow. Returns `null` when
 * the narrow has no dedicated mark-as-read endpoint — the button
 * stays hidden in that case.
 */
type ReadScope =
  | { kind: "all" }
  | { kind: "channel"; streamId: StreamId }
  | { kind: "topic"; streamId: StreamId; topic: string };

function readScopeFor(narrow: Narrow): ReadScope | null {
  if (narrow.length === 0) {
    return { kind: "all" };
  }
  let streamId: StreamId | undefined;
  let topic: string | undefined;
  for (const term of narrow) {
    if (term.negated === true) {
      // Negated terms shift the scope in ways the bulk endpoints do not
      // model; bail out and let the scroll path handle reading.
      return null;
    }
    if (term.operator === "channel" || term.operator === "stream") {
      if (typeof term.operand !== "number") {
        return null;
      }
      streamId = term.operand;
      continue;
    }
    if (term.operator === "topic") {
      if (typeof term.operand !== "string") {
        return null;
      }
      topic = term.operand;
      continue;
    }
    // Any other operator (search, has, sender, dm, is, near, id, …)
    // disqualifies the bulk endpoints — the scope no longer maps onto
    // a whole channel or topic.
    return null;
  }
  if (streamId === undefined) {
    return null;
  }
  if (topic === undefined) {
    return { kind: "channel", streamId };
  }
  return { kind: "topic", streamId, topic };
}

/**
 * The unread count for the read-scope, read off the buckets directly.
 * The button hides when this is zero.
 */
function unreadInScope(buckets: UnreadBuckets, scope: ReadScope): number {
  switch (scope.kind) {
    case "all":
      return Object.keys(buckets.location).length;
    case "channel": {
      const topics = buckets.channels[scope.streamId];
      if (topics === undefined) {
        return 0;
      }
      let total = 0;
      for (const ids of Object.values(topics)) {
        total += Object.keys(ids).length;
      }
      return total;
    }
    case "topic":
      return topicUnreadCount(buckets, scope.streamId, scope.topic);
  }
}

/**
 * Synthesise the message ids the optimistic mark-read affects. Used to
 * also remove the `read` flag locally from every cached message in the
 * scope (the unread-store optimism alone doesn't touch the message-
 * cache flag map).
 */
function idsInScope(buckets: UnreadBuckets, scope: ReadScope): number[] {
  switch (scope.kind) {
    case "all":
      return Object.keys(buckets.location).map(Number);
    case "channel": {
      const topics = buckets.channels[scope.streamId];
      if (topics === undefined) {
        return [];
      }
      const ids: number[] = [];
      for (const idSet of Object.values(topics)) {
        for (const id of Object.keys(idSet)) {
          ids.push(Number(id));
        }
      }
      return ids;
    }
    case "topic": {
      const idSet = buckets.channels[scope.streamId]?.[scope.topic];
      if (idSet === undefined) {
        return [];
      }
      return Object.keys(idSet).map(Number);
    }
  }
}

/** Human-readable label per scope. */
function labelFor(scope: ReadScope): string {
  switch (scope.kind) {
    case "all":
      return "Mark all as read";
    case "channel":
      return "Mark channel as read";
    case "topic":
      return "Mark topic as read";
  }
}

export interface MarkAsReadButtonProps {
  narrow: Narrow;
}

export function MarkAsReadButton({
  narrow,
}: MarkAsReadButtonProps): React.JSX.Element | null {
  const buckets = useUnreadStore((s) => s.unread);
  const markRead = useUnreadStore((s) => s.markRead);
  const markAllRead = useUnreadStore((s) => s.markAllRead);

  const [submitting, setSubmitting] = useState(false);

  const scope = readScopeFor(narrow);
  const count = scope === null ? 0 : unreadInScope(buckets, scope);

  const handleClick = useCallback(async () => {
    if (scope === null || submitting) {
      return;
    }
    setSubmitting(true);
    // Snapshot the affected ids before the optimistic clear so we can
    // mark the cache flags in one bulk update.
    const affected = idsInScope(buckets, scope);

    if (scope.kind === "all") {
      markAllRead();
    } else {
      markRead(affected);
    }
    // Update the message-cache flags too so a subsequent mark-unread
    // through the actions menu sees the message as currently read.
    if (affected.length > 0) {
      useMessagesStore
        .getState()
        .applyOptimisticFlagsBulk(affected, "add", "read");
    }

    try {
      switch (scope.kind) {
        case "all":
          await apiClient.markAllAsRead();
          break;
        case "channel":
          await apiClient.markStreamAsRead(scope.streamId);
          break;
        case "topic":
          await apiClient.markTopicAsRead(scope.streamId, scope.topic);
          break;
      }
    } catch (error) {
      // Soft-fail — the next snapshot reconciles. The user is the one
      // who asked for this; logging is enough.
      console.warn("mark-as-read: bulk REST call failed", error);
    } finally {
      setSubmitting(false);
    }
  }, [scope, submitting, buckets, markRead, markAllRead]);

  if (scope === null || count === 0) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <Button
        variant="ghost"
        size="sm"
        iconLeft="check"
        onClick={() => {
          void handleClick();
        }}
        loading={submitting}
      >
        {labelFor(scope)}
      </Button>
    </div>
  );
}
