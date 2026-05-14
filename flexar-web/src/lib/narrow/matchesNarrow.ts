// Flexar Hub Web — pure narrow-matching predicate (Phase 1.6).
//
// `matchesNarrow(message, narrow)` decides whether a single `Message`
// belongs in a given narrow. The message feed (Phase 1.6) uses it for
// *live-event reconciliation*: when a `message` event arrives, the feed
// must decide whether the new message belongs in the narrow the user is
// currently looking at (append it) or not (ignore it); likewise an
// edited/moved message may fall out of the narrow.
//
// ── Scope: what this evaluates ──────────────────────────────────────
//
// The server-fetched history window is always authoritative — the
// server evaluates the full narrow. This predicate only has to be good
// enough for the *live-append decision*, on the message shapes the
// client actually holds. It evaluates the operators a chat client can
// decide locally from a `Message` plus the viewer's own id:
//
//   channel / stream  — `message.stream_id` equals the operand id
//   topic             — `message.subject` equals the operand (exact;
//                        channel messages only)
//   dm / pm-with      — direct message whose participant set equals the
//                        operand user-id list (Zulip treats `dm` and
//                        the legacy `pm-with` identically)
//   dm-including      — direct message whose participant set contains
//                        the operand user id
//   sender            — `message.sender_id` equals the operand id (the
//                        literal `me` requires the viewer id; see
//                        `MatchContext`)
//   is:dm / is:private — message is a direct message
//   is:mentioned      — viewer is mentioned (needs the message's flags)
//   is:starred        — message is starred (needs flags)
//   is:unread         — message is unread (needs flags — absence of the
//                        `read` flag)
//   is:resolved       — channel message whose topic is marked resolved
//                        (the `✔ ` topic-name prefix Zulip uses)
//   is:followed       — not decidable from a `Message`; see below
//
// Negated terms (`negated: true`) invert the term's result.
//
// ── Scope: what this does NOT evaluate ─────────────────────────────
//
// `search`, `has:*`, `near`, `id`, `with`, and `is:followed` cannot be
// evaluated from a `Message` (+flags) alone — they need the rendered
// search index, attachment metadata, or per-topic follow state the feed
// layer does not hold. For these the predicate is *permissive*: an
// unknown/undecidable term is treated as "matches", so a live message
// is appended rather than dropped. The consequence is bounded and
// self-correcting: at worst a message that the server would have
// excluded is shown until the next history refetch; we never *hide* a
// message the server would have included. This is the documented
// limitation (see the feed module header).
//
// Pure and synchronous — unit-tested in `./matchesNarrow.test.ts`.

import type {
  Message,
  MessageFlag,
  Narrow,
  NarrowTerm,
  UserId,
} from "../../domain";

/**
 * Ambient facts a narrow may need that are not on the `Message` itself:
 * the viewer's own user id (for `sender:me` and `dm` self-inclusion
 * semantics) and the viewer's per-message flags (for the `is:` flags
 * that are flag-derived). Both are optional — when a term needs a
 * piece of context that was not supplied, that term is treated as
 * permissive (matches), consistent with the undecidable-term policy.
 */
export interface MatchContext {
  /** The viewer's own user id, for `sender:me`. */
  ownUserId?: UserId;
  /** The viewer's flags for this message, for flag-derived `is:` terms. */
  flags?: readonly MessageFlag[];
}

// The participant ids of a direct message, taken from its
// `display_recipient` array. Returns `undefined` for channel messages.
function dmParticipantIds(message: Message): Set<UserId> | undefined {
  if (message.type !== "private") {
    return undefined;
  }
  const recipient = message.display_recipient;
  if (!Array.isArray(recipient)) {
    return undefined;
  }
  return new Set(recipient.map((participant) => participant.id));
}

// Coerce a narrow operand into a single numeric id, or `undefined` if
// it is not a clean integer. Operands reach us as `number` (from
// app-built narrows) or `string` (round-tripped through the URL codec
// for some operators).
function operandToId(operand: NarrowTerm["operand"]): number | undefined {
  if (Array.isArray(operand)) {
    return undefined;
  }
  const n = typeof operand === "number" ? operand : Number(operand);
  return Number.isInteger(n) ? n : undefined;
}

// Coerce a narrow operand into a list of numeric ids (for `dm` family).
function operandToIdList(
  operand: NarrowTerm["operand"],
): number[] | undefined {
  if (!Array.isArray(operand)) {
    return undefined;
  }
  const ids: number[] = [];
  for (const raw of operand) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(n)) {
      return undefined;
    }
    ids.push(n);
  }
  return ids;
}

// Zulip marks a resolved topic by prefixing its name with this string.
const RESOLVED_TOPIC_PREFIX = "✔ ";

// Evaluate a single `is:` keyword against the message and context.
// Returns `undefined` for keywords this predicate cannot decide, so the
// caller can apply the permissive fallback.
function matchesIsKeyword(
  keyword: string,
  message: Message,
  context: MatchContext,
): boolean | undefined {
  switch (keyword) {
    case "dm":
    case "private":
      return message.type === "private";
    case "mentioned":
      return context.flags?.includes("mentioned") ?? undefined;
    case "starred":
      return context.flags?.includes("starred") ?? undefined;
    case "unread":
      // Unread = the `read` flag is absent. Needs the flags context.
      return context.flags ? !context.flags.includes("read") : undefined;
    case "resolved":
      return (
        message.type === "stream" &&
        message.subject.startsWith(RESOLVED_TOPIC_PREFIX)
      );
    default:
      // `followed` and any future keyword: undecidable here.
      return undefined;
  }
}

// Evaluate one narrow term (ignoring negation) against the message.
// Returns `true` / `false` for terms this predicate can decide, or
// `undefined` for undecidable terms (the caller treats those as a
// match — see the file header).
function matchesTerm(
  term: NarrowTerm,
  message: Message,
  context: MatchContext,
): boolean | undefined {
  switch (term.operator) {
    case "channel":
    case "stream": {
      const id = operandToId(term.operand);
      if (id === undefined) {
        return undefined;
      }
      return message.type === "stream" && message.stream_id === id;
    }

    case "topic": {
      if (message.type !== "stream" || Array.isArray(term.operand)) {
        return message.type === "stream" ? undefined : false;
      }
      return message.subject === String(term.operand);
    }

    case "dm":
    case "pm-with": {
      const ids = operandToIdList(term.operand);
      const participants = dmParticipantIds(message);
      if (ids === undefined || participants === undefined) {
        return participants === undefined ? false : undefined;
      }
      // The operand may or may not include the viewer's own id; Zulip's
      // `display_recipient` always lists every participant including
      // the viewer. Compare as sets after folding in the viewer id, so
      // both operand conventions match the same conversation.
      const wanted = new Set<UserId>(ids);
      if (context.ownUserId !== undefined) {
        wanted.add(context.ownUserId);
      }
      if (wanted.size !== participants.size) {
        return false;
      }
      for (const id of wanted) {
        if (!participants.has(id)) {
          return false;
        }
      }
      return true;
    }

    case "dm-including": {
      const id = operandToId(term.operand);
      const participants = dmParticipantIds(message);
      if (participants === undefined) {
        return false;
      }
      if (id === undefined) {
        return undefined;
      }
      return participants.has(id);
    }

    case "sender": {
      // `sender` operands are strings in the URL codec; the reserved
      // literal `me` resolves against the viewer id.
      if (term.operand === "me") {
        return context.ownUserId === undefined
          ? undefined
          : message.sender_id === context.ownUserId;
      }
      const id = operandToId(term.operand);
      if (id === undefined) {
        return undefined;
      }
      return message.sender_id === id;
    }

    case "is": {
      if (Array.isArray(term.operand)) {
        return undefined;
      }
      return matchesIsKeyword(String(term.operand), message, context);
    }

    // `has`, `search`, `near`, `id`, `with`: not decidable from a
    // `Message` alone — permissive.
    default:
      return undefined;
  }
}

/**
 * Whether `message` belongs in `narrow`, for the live-append decision.
 *
 * A narrow is the conjunction of its terms: every term must match. A
 * term this predicate cannot evaluate (see the file header) is treated
 * as matching, so a live message is appended rather than wrongly
 * dropped — the server-fetched window stays authoritative. The empty
 * narrow (Combined feed) matches every message.
 *
 * `context` supplies the viewer id and per-message flags some terms
 * need; omit it (or its fields) and the terms that need them fall back
 * to the permissive default.
 */
export function matchesNarrow(
  message: Message,
  narrow: Narrow,
  context: MatchContext = {},
): boolean {
  for (const term of narrow) {
    const result = matchesTerm(term, message, context);
    // Undecidable term → treat as a match (permissive).
    if (result === undefined) {
      continue;
    }
    const satisfied = term.negated ? !result : result;
    if (!satisfied) {
      return false;
    }
  }
  return true;
}
