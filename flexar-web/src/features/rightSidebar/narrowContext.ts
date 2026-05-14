// Resolve the current narrow into the right sidebar's context (1.8).
//
// The right sidebar shows a contextual user section above the full
// organization directory. What that contextual section is depends on
// the narrow the viewer is looking at:
//
//   - a channel narrow (`channel`, optionally with `topic`) → the
//     channel's subscribers, addressed by `streamId`;
//   - a DM narrow (`dm`) → the conversation's participants, addressed
//     by their user ids;
//   - anything else (combined feed, search, `is:`/`has:` views, a
//     malformed or absent narrow) → no contextual section; just the
//     full directory.
//
// This is a pure function of the `Narrow` so it is unit-testable
// without routing. It deliberately reads only the operators it can act
// on and ignores the rest — a `channel` + `topic` + `search` narrow is
// still a channel context.

import type { Narrow, StreamId, UserId } from "../../domain";

/** The contextual section to show above the full user directory. */
export type RightSidebarContext =
  | { kind: "channel"; streamId: StreamId }
  | { kind: "dm"; participantIds: UserId[] }
  | { kind: "none" };

/** A `channel` narrow term carries the channel id as a numeric operand. */
function channelIdFromTerm(operand: unknown): StreamId | undefined {
  return typeof operand === "number" ? operand : undefined;
}

/** A `dm` narrow term carries the participant ids as a numeric array. */
function participantIdsFromTerm(operand: unknown): UserId[] | undefined {
  if (
    Array.isArray(operand) &&
    operand.every((id): id is number => typeof id === "number")
  ) {
    return operand;
  }
  return undefined;
}

/**
 * Collapse a narrow into the right sidebar's context. An `undefined`
 * narrow (the viewer is outside narrow space — a special view) or one
 * with no actionable operator resolves to `{ kind: "none" }`.
 */
export function resolveRightSidebarContext(
  narrow: Narrow | undefined,
): RightSidebarContext {
  if (narrow === undefined) {
    return { kind: "none" };
  }
  for (const term of narrow) {
    if (term.operator === "channel" || term.operator === "stream") {
      const streamId = channelIdFromTerm(term.operand);
      if (streamId !== undefined) {
        return { kind: "channel", streamId };
      }
    }
    if (term.operator === "dm") {
      const participantIds = participantIdsFromTerm(term.operand);
      if (participantIds !== undefined && participantIds.length > 0) {
        return { kind: "dm", participantIds };
      }
    }
  }
  return { kind: "none" };
}
