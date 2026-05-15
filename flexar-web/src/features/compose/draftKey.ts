// Flexar Hub Web — derive a stable per-conversation draft key from the
// compose pre-fill (Phase 2.4).
//
// One draft per conversation destination. The key is the addressing
// identity of that destination, derived from `ComposeFromNarrow` (which
// already strips the viewer from DM lists, normalises operator
// aliases, and so on — re-using it keeps the autosave and the
// pre-fill in lock-step).
//
// Returns `null` for the unaddressed compose state (`mode === "none"`,
// or a channel pre-fill missing its stream id) — the compose box never
// autosaves a draft that has no destination, since the user could not
// later return to it from the URL.
//
// Key formats — kept stable across reloads:
//   - channel destination → `channel:<streamId>:<topic>`
//   - DM destination      → `dm:<sortedRecipientIds.join(",")>`
//
// The DM key sorts the participant list so two DMs that differ only in
// recipient order resolve to the same draft.

import type { ComposeFromNarrow } from "./composeFromNarrow";
import type { DraftDestination } from "../../stores/draftsStore";

/**
 * The draft key for a compose pre-fill, or `null` when the compose box
 * has no addressable destination (don't autosave drafts that aren't
 * addressed to anything).
 */
export function draftKeyFor(prefill: ComposeFromNarrow): string | null {
  if (prefill.mode === "none") {
    return null;
  }
  if (prefill.mode === "channel") {
    if (prefill.streamId === undefined) {
      return null;
    }
    return `channel:${prefill.streamId}:${prefill.topic}`;
  }
  // direct
  if (prefill.recipientIds.length === 0) {
    return null;
  }
  const sorted = [...prefill.recipientIds].sort((a, b) => a - b);
  return `dm:${sorted.join(",")}`;
}

/**
 * Build a `DraftDestination` from a compose pre-fill, or `null` when
 * the pre-fill has no addressable destination. Mirrors `draftKeyFor`'s
 * filtering so a successful key derivation always yields a destination.
 */
export function destinationFor(
  prefill: ComposeFromNarrow,
): DraftDestination | null {
  if (prefill.mode === "channel") {
    if (prefill.streamId === undefined) {
      return null;
    }
    return {
      type: "channel",
      streamId: prefill.streamId,
      topic: prefill.topic,
    };
  }
  if (prefill.mode === "direct") {
    if (prefill.recipientIds.length === 0) {
      return null;
    }
    const sorted = [...prefill.recipientIds].sort((a, b) => a - b);
    return { type: "direct", recipientIds: sorted };
  }
  return null;
}
