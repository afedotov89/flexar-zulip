// Flexar Hub Web — derive the compose box's pre-fill from the URL narrow
// (Phase 2.1).
//
// The compose box belongs to the message feed: when the user opens a
// narrow, composing a message in that narrow should be the obvious
// default. This module is the pure, unit-testable mapping between
// "the narrow the URL addresses" and "what the compose box's mode and
// pre-filled fields should be".
//
// Three target modes:
//
//   - "channel"  — channel + topic. Pre-filled when the narrow has a
//                  `channel` term; topic comes from a `topic` term if
//                  present, otherwise empty (the user fills it).
//   - "direct"   — DM recipients. Pre-filled when the narrow has a `dm`
//                  term whose operand is the participant id list (the
//                  viewer is included in narrow operands; we strip it
//                  here so the resulting recipient list contains only
//                  the *other* participants).
//   - "none"     — the narrow does not address a single channel or DM
//                  conversation (empty narrow, search, built-in views,
//                  `is:`/`has:`-only narrows, message-id anchors). The
//                  compose box renders a "choose a conversation" hint
//                  in this mode rather than guess where the message
//                  should go. `narrow === undefined` (a non-narrow
//                  route — special view, login, …) maps here too.
//
// Negated terms are ignored: `not-channel` does not pre-fill a
// recipient. Multiple `channel` / `dm` terms are not normal — the URL
// codec produces at most one of each — but if encountered, only the
// first non-negated occurrence is used.

import type { Narrow, NarrowTerm, StreamId, UserId } from "../../domain";

/** What the compose box pre-fills from the current narrow. */
export type ComposeFromNarrow =
  | { mode: "none" }
  | {
      mode: "channel";
      /** Pre-filled channel id, or `undefined` to require user input. */
      streamId: StreamId | undefined;
      /** Pre-filled topic; empty string when the narrow has no topic. */
      topic: string;
    }
  | {
      mode: "direct";
      /**
       * Other participants of the DM. The viewer is stripped from the
       * narrow's participant list so callers do not have to filter
       * themselves out again.
       */
      recipientIds: UserId[];
    };

// Pick the first non-negated term whose operator matches `operator`.
function findTerm(
  narrow: Narrow,
  operator: NarrowTerm["operator"],
): NarrowTerm | undefined {
  return narrow.find((term) => term.operator === operator && !term.negated);
}

// Coerce a `channel` operand to a numeric id. The URL codec normalises
// `channel` operands to numbers, but `Narrow` permits strings too; be
// permissive on input so the helper is robust to hand-crafted narrows.
function toStreamId(operand: NarrowTerm["operand"]): StreamId | undefined {
  if (typeof operand === "number") {
    return operand;
  }
  if (typeof operand === "string") {
    const n = Number(operand);
    return Number.isInteger(n) ? n : undefined;
  }
  return undefined;
}

// Coerce a `dm` operand to a participant id list. The URL codec
// produces an integer array; `Narrow` also allows a comma-separated
// string, which we accept for the same reason as channel ids.
function toUserIds(operand: NarrowTerm["operand"]): UserId[] | undefined {
  if (Array.isArray(operand)) {
    const ids: UserId[] = [];
    for (const part of operand) {
      const n = typeof part === "number" ? part : Number(part);
      if (!Number.isInteger(n)) {
        return undefined;
      }
      ids.push(n);
    }
    return ids;
  }
  if (typeof operand === "string" && operand !== "") {
    const ids: UserId[] = [];
    for (const part of operand.split(",")) {
      const n = Number(part);
      if (!Number.isInteger(n)) {
        return undefined;
      }
      ids.push(n);
    }
    return ids;
  }
  return undefined;
}

/**
 * Derive the compose box's pre-fill from the current narrow.
 *
 * `narrow === undefined` (a non-narrow route — special view, login, …)
 * resolves to `{ mode: "none" }` so the compose UI consistently shows
 * its "choose a conversation" hint there.
 *
 * `ownUserId` is the viewer's user id, used to strip the viewer from a
 * `dm` participant list (Zulip narrows include the viewer; the compose
 * recipient list does not).
 */
export function composeFromNarrow(
  narrow: Narrow | undefined,
  ownUserId: UserId | undefined,
): ComposeFromNarrow {
  if (narrow === undefined) {
    return { mode: "none" };
  }

  const channelTerm =
    findTerm(narrow, "channel") ?? findTerm(narrow, "stream");
  if (channelTerm !== undefined) {
    const streamId = toStreamId(channelTerm.operand);
    const topicTerm = findTerm(narrow, "topic");
    const topic =
      topicTerm !== undefined && typeof topicTerm.operand === "string"
        ? topicTerm.operand
        : "";
    return { mode: "channel", streamId, topic };
  }

  const dmTerm =
    findTerm(narrow, "dm") ??
    findTerm(narrow, "pm-with") ??
    findTerm(narrow, "dm-including");
  if (dmTerm !== undefined) {
    const ids = toUserIds(dmTerm.operand);
    if (ids === undefined || ids.length === 0) {
      return { mode: "none" };
    }
    const others =
      ownUserId !== undefined ? ids.filter((id) => id !== ownUserId) : ids;
    if (others.length === 0) {
      // Self-only DMs are valid in Zulip but unusual; the recipients
      // input would be empty, which would require user input to send
      // anything meaningful. Fall back to the recipient list as-is.
      return { mode: "direct", recipientIds: ids };
    }
    return { mode: "direct", recipientIds: others };
  }

  // Search-only / `is:`-only / built-in / `near:` narrows: not a
  // single-conversation pre-fill.
  return { mode: "none" };
}
