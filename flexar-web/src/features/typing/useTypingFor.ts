// Flexar Hub Web — narrow → typing-bucket selector hook (Phase 4.3).
//
// Resolves the conversation key the typing store uses for the given
// narrow and returns the active typer ids. Returns an empty array
// when the narrow is broader than a single conversation (combined
// feed, search, channel-only without a topic) — typing is per
// conversation in Zulip's API, so a "is anyone typing in some channel?"
// indicator would be misleading.

import { useEffect, useMemo } from "react";
import type { Narrow, UserId } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import {
  TYPING_STALE_AFTER_MS,
  typingChannelKey,
  typingDmKey,
  useTypingStore,
} from "../../stores/typingStore";

/**
 * Pull the conversation key out of `narrow`. The narrow must address a
 * single channel-topic or a single DM conversation; broader narrows
 * return `null` and the indicator hides.
 */
export function typingKeyForNarrow(
  narrow: Narrow,
  ownUserId: number | undefined,
): string | null {
  let streamId: number | undefined;
  let topic: string | undefined;
  let dmIds: UserId[] | undefined;
  for (const term of narrow) {
    if (term.negated === true) {
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
    if (term.operator === "dm" || term.operator === "pm-with") {
      if (Array.isArray(term.operand) && term.operand.every((v) => typeof v === "number")) {
        dmIds = term.operand as UserId[];
        continue;
      }
      return null;
    }
    return null;
  }
  if (streamId !== undefined && topic !== undefined) {
    return typingChannelKey(streamId, topic);
  }
  if (dmIds !== undefined) {
    const participants = ownUserId !== undefined ? [...dmIds, ownUserId] : dmIds;
    return typingDmKey(participants);
  }
  return null;
}

/**
 * Sender ids actively typing in the conversation `narrow` addresses.
 * Sweeps the typing store on a 1s interval to evict stale entries the
 * server forgot to send a `stop` for (browser tab closed mid-typing
 * etc.) — without the sweep, "X is typing…" would hang forever.
 */
export function useTypingFor(narrow: Narrow | undefined): UserId[] {
  const ownUserId = useAuthStore((s) => s.session?.userId);
  const buckets = useTypingStore((s) => s.buckets);
  const pruneStale = useTypingStore((s) => s.pruneStale);

  // Background sweeper: prune stale entries on a 1s tick. The store's
  // `pruneStale` is a no-op when nothing changes, so a quiet
  // conversation does not produce render storms.
  useEffect(() => {
    const interval = window.setInterval(() => {
      pruneStale(Date.now(), TYPING_STALE_AFTER_MS);
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [pruneStale]);

  return useMemo(() => {
    if (narrow === undefined) {
      return [];
    }
    const key = typingKeyForNarrow(narrow, ownUserId);
    if (key === null) {
      return [];
    }
    const senders = buckets[key]?.senders ?? {};
    return Object.keys(senders)
      .map((id) => Number(id))
      .sort((a, b) => a - b);
  }, [narrow, ownUserId, buckets]);
}
