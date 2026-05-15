// Pure reducers for the local-drafts store (Phase 2.4).
//
// A draft is the in-progress compose state for one conversation
// destination. Keyed by a stable per-conversation `key` (see
// `src/features/compose/draftKey`); only one draft exists per key, so
// the conversation always has at most one in-progress message.
//
// Local-only: drafts live in `localStorage` (via `persist` in
// `draftsStore`), never on the server. This intentionally diverges from
// Zulip's server-side `Draft` type (`src/domain/emoji.ts`) — the store
// here is a UI convenience for survival across reloads, not a synced
// document.
//
// All reducers are pure: they return new records and never mutate the
// inputs.

import type { StreamId, UserId } from "../domain";

/** A draft destined for a channel + topic. */
export interface ChannelDraftDestination {
  type: "channel";
  streamId: StreamId;
  topic: string;
}

/** A draft destined for a direct-message conversation. */
export interface DirectDraftDestination {
  type: "direct";
  /**
   * Recipient user ids. Stored sorted ascending so the destination has
   * a canonical form independent of input order.
   */
  recipientIds: readonly UserId[];
}

/** Where a draft is going. */
export type DraftDestination =
  | ChannelDraftDestination
  | DirectDraftDestination;

/** A locally-persisted compose draft. */
export interface Draft {
  /** Stable per-conversation key — see `draftKeyFor`. */
  key: string;
  /** Where the draft is going. */
  destination: DraftDestination;
  /** The user-typed body (Markdown source). */
  content: string;
  /** Wall-clock timestamp (ms) of the last edit. */
  updatedAt: number;
}

/** The drafts map, keyed by `Draft.key`. */
export type DraftMap = Record<string, Draft>;

/** Insert or replace the draft for `draft.key`. Returns a new map. */
export function saveDraft(drafts: DraftMap, draft: Draft): DraftMap {
  return { ...drafts, [draft.key]: draft };
}

/**
 * Drop the draft for `key`. No-op (returns the same reference) when the
 * key is unknown, so consumers can call it unconditionally without
 * triggering spurious re-renders.
 */
export function deleteDraft(drafts: DraftMap, key: string): DraftMap {
  if (!(key in drafts)) {
    return drafts;
  }
  const next = { ...drafts };
  delete next[key];
  return next;
}

/**
 * The drafts list, sorted by `updatedAt` descending (most recent first).
 * Stable secondary sort by key keeps the order deterministic when two
 * drafts share a timestamp.
 */
export function listDrafts(drafts: DraftMap): Draft[] {
  return Object.values(drafts).sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}
