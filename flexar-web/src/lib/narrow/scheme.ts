// Flexar Hub Web — narrow ↔ URL codec (Phase 1.4).
//
// A *narrow* (domain `Narrow` = `NarrowTerm[]`) is how the app
// addresses "which messages am I looking at". This module makes a
// narrow addressable in the browser URL and back, losslessly.
//
// ── URL scheme ──────────────────────────────────────────────────────
//
// This is a clean React-Router app, so we use a readable, path-based
// scheme rooted at `/narrow` — NOT Zulip's legacy `#narrow/...` hash.
//
// A narrow path is a sequence of `/<operator>/<operand>` segments:
//
//     /narrow/<op>/<operand>/<op>/<operand>/...
//
// The empty narrow (Combined feed) is just `/narrow`.
//
// Operators map to URL segment names:
//
//   channel        → `channel`   (operand: `<id>` or `<id>-<slug>`)
//   stream         → `channel`   (alias; `stream` is the legacy name —
//                                 it round-trips back as `channel`)
//   topic          → `topic`     (operand: percent-encoded text)
//   dm             → `dm`        (operand: dash-joined sorted user ids,
//                                 e.g. `dm/4,7,12`)
//   dm-including   → `dm-including`
//   pm-with        → `pm-with`   (alias kept distinct from `dm`)
//   sender         → `sender`    (operand: `<id>` or the literal `me`)
//   is             → `is`        (operand: a keyword, e.g. `mentioned`)
//   has            → `has`       (operand: a keyword, e.g. `reaction`)
//   near           → `near`      (operand: a message id)
//   id             → `id`        (operand: a message id)
//   with           → `with`      (operand: a message id)
//   search         → `search`    (operand: percent-encoded query text)
//
// A *negated* term prefixes the operator segment with `not-`, e.g.
// `/narrow/not-is/starred`.
//
// ── Identifier encoding ─────────────────────────────────────────────
//
// Channels are encoded as their numeric `stream_id`, optionally
// followed by `-<slug>` for human readability (Zulip's `7-general`
// convention). The slug is purely decorative: parsing reads only the
// leading integer, so a renamed channel still resolves. `narrowToPath`
// emits the bare id unless a `resolveChannelSlug` callback is supplied.
//
// DM operands are the participant user ids, sorted ascending and
// joined with `,`. `sender` takes a single user id, except the
// reserved literal `me` which round-trips verbatim.
//
// ── Operand types ───────────────────────────────────────────────────
//
// The domain `NarrowTerm.operand` is `string | number | Array<...>`.
// To round-trip exactly, the codec must restore the original JS type:
//
//   - `dm` / `dm-including` / `pm-with` → `number[]` (user ids)
//   - `near` / `id` / `with`            → `number`   (message id)
//   - everything else                   → `string`
//
// `sender` stays a `string` because of the `me` literal; a numeric
// sender id is preserved as its decimal string, which is what the API
// wire layer accepts.
//
// ── Malformed input ─────────────────────────────────────────────────
//
// `parseNarrowPath` never throws on user-controlled URL strings. It
// returns a `NarrowParseResult`: `{ ok: true, narrow }` on success, or
// `{ ok: false, reason }` when the path is not a valid narrow path
// (wrong prefix, dangling operator with no operand, unknown operator
// segment, malformed numeric operand). Callers decide how to recover
// (typically: fall back to the Combined feed).
//
// ── Round-trip guarantee ────────────────────────────────────────────
//
// `parseNarrowPath(narrowToPath(n))` deep-equals `n` for every narrow
// built from the operators above. Operators outside the documented set
// are rejected by `narrowToPath` (it throws — this is a programming
// error, narrows are app-constructed) and treated as malformed by
// `parseNarrowPath` (it is not — that is untrusted input).

import type { Narrow, NarrowOperator, NarrowTerm } from "../../domain";

/** Root path under which every narrow-addressed route lives. */
export const NARROW_ROOT = "/narrow";

/** Outcome of parsing a URL path into a narrow. */
export type NarrowParseResult =
  | { ok: true; narrow: Narrow }
  | { ok: false; reason: string };

// Operators whose operand is a list of user ids.
const USER_LIST_OPERATORS = new Set<NarrowOperator>([
  "dm",
  "dm-including",
  "pm-with",
]);

// Operators whose operand is a single message id (a number).
const MESSAGE_ID_OPERATORS = new Set<NarrowOperator>(["near", "id", "with"]);

// Every operator the codec recognises as a URL segment name. `stream`
// is accepted on input but normalised to `channel` on output.
const KNOWN_OPERATORS = new Set<NarrowOperator>([
  "channel",
  "stream",
  "topic",
  "dm",
  "dm-including",
  "pm-with",
  "sender",
  "is",
  "has",
  "near",
  "id",
  "with",
  "search",
]);

function isKnownOperator(value: string): value is NarrowOperator {
  return KNOWN_OPERATORS.has(value as NarrowOperator);
}

/**
 * Optional hook to attach a readable slug to a channel id, producing
 * `7-general` instead of a bare `7`. Given the channel's `stream_id`,
 * return its name, or `undefined` to emit the bare id.
 */
export type ChannelSlugResolver = (channelId: number) => string | undefined;

// Turn a channel name into a URL-safe slug: lowercase, non-alphanumerics
// collapsed to single dashes, trimmed. Purely decorative — never read
// back — so a lossy transform is fine.
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug;
}

// Encode one operand into a single path segment, by operator family.
function encodeOperand(
  term: NarrowTerm,
  resolveChannelSlug?: ChannelSlugResolver,
): string {
  const { operator, operand } = term;

  if (USER_LIST_OPERATORS.has(operator)) {
    if (!Array.isArray(operand)) {
      throw new Error(
        `narrow operator "${operator}" expects a user-id array operand`,
      );
    }
    const ids = operand.map((id) => {
      const n = typeof id === "number" ? id : Number(id);
      if (!Number.isInteger(n)) {
        throw new Error(
          `narrow operator "${operator}" has a non-integer user id`,
        );
      }
      return n;
    });
    return [...ids].sort((a, b) => a - b).join(",");
  }

  if (operator === "channel" || operator === "stream") {
    const id = typeof operand === "number" ? operand : Number(operand);
    if (!Number.isInteger(id)) {
      throw new Error(
        `narrow operator "${operator}" expects an integer channel id`,
      );
    }
    const name = resolveChannelSlug?.(id);
    const slug = name ? slugify(name) : "";
    return slug ? `${id}-${slug}` : String(id);
  }

  if (MESSAGE_ID_OPERATORS.has(operator)) {
    const n = typeof operand === "number" ? operand : Number(operand);
    if (!Number.isInteger(n)) {
      throw new Error(
        `narrow operator "${operator}" expects an integer message id`,
      );
    }
    return String(n);
  }

  // topic / sender / is / has / search — free-form string operands.
  if (Array.isArray(operand)) {
    throw new Error(
      `narrow operator "${operator}" does not take an array operand`,
    );
  }
  return encodeURIComponent(String(operand));
}

// Decode one path segment back into a typed operand for `operator`.
// Returns `undefined` when the segment is malformed for that operator.
function decodeOperand(
  operator: NarrowOperator,
  segment: string,
): NarrowTerm["operand"] | undefined {
  if (USER_LIST_OPERATORS.has(operator)) {
    if (segment === "") {
      return undefined;
    }
    const ids: number[] = [];
    for (const part of segment.split(",")) {
      const n = Number(part);
      if (part === "" || !Number.isInteger(n)) {
        return undefined;
      }
      ids.push(n);
    }
    return [...ids].sort((a, b) => a - b);
  }

  if (operator === "channel" || operator === "stream") {
    // `7` or `7-general`: read the leading integer, ignore the slug.
    const match = /^(\d+)(?:-.*)?$/.exec(segment);
    if (!match) {
      return undefined;
    }
    return Number(match[1]);
  }

  if (MESSAGE_ID_OPERATORS.has(operator)) {
    const n = Number(segment);
    if (segment === "" || !Number.isInteger(n)) {
      return undefined;
    }
    return n;
  }

  // topic / sender / is / has / search.
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Malformed percent-encoding in a user-controlled URL.
    return undefined;
  }
  return decoded;
}

/**
 * Serialise a narrow into a URL path string (always starting with
 * `NARROW_ROOT`). The empty narrow yields exactly `NARROW_ROOT`.
 *
 * Throws if the narrow contains an operator outside the documented
 * set, or an operand whose JS type does not match its operator — both
 * are programming errors, since narrows are constructed by the app.
 *
 * Pass `resolveChannelSlug` to emit readable `channel/7-general`
 * segments; without it, channels serialise as bare ids.
 */
export function narrowToPath(
  narrow: Narrow,
  resolveChannelSlug?: ChannelSlugResolver,
): string {
  const segments: string[] = [];
  for (const term of narrow) {
    if (!isKnownOperator(term.operator)) {
      throw new Error(`unknown narrow operator "${term.operator}"`);
    }
    // Normalise the legacy `stream` operator to `channel` on output.
    const opName = term.operator === "stream" ? "channel" : term.operator;
    const opSegment = term.negated ? `not-${opName}` : opName;
    segments.push(opSegment, encodeOperand(term, resolveChannelSlug));
  }
  return segments.length === 0
    ? NARROW_ROOT
    : `${NARROW_ROOT}/${segments.join("/")}`;
}

/**
 * Parse a URL path into a narrow. Never throws: untrusted, malformed
 * input yields `{ ok: false, reason }`. The empty narrow path
 * (`NARROW_ROOT`, with or without a trailing slash) yields the empty
 * narrow.
 */
export function parseNarrowPath(path: string): NarrowParseResult {
  // Drop any query string / hash the caller may have left attached.
  const pathname = path.split(/[?#]/, 1)[0];

  if (pathname !== NARROW_ROOT && !pathname.startsWith(`${NARROW_ROOT}/`)) {
    return { ok: false, reason: `path does not start with ${NARROW_ROOT}` };
  }

  const rest = pathname.slice(NARROW_ROOT.length).replace(/^\/+|\/+$/g, "");
  if (rest === "") {
    return { ok: true, narrow: [] };
  }

  const segments = rest.split("/");
  if (segments.length % 2 !== 0) {
    return { ok: false, reason: "operator without an operand" };
  }

  const narrow: Narrow = [];
  for (let i = 0; i < segments.length; i += 2) {
    let opSegment = segments[i];
    const operandSegment = segments[i + 1];

    let negated = false;
    if (opSegment.startsWith("not-")) {
      negated = true;
      opSegment = opSegment.slice("not-".length);
    }

    if (!isKnownOperator(opSegment)) {
      return { ok: false, reason: `unknown operator segment "${opSegment}"` };
    }
    // Normalise the legacy `stream` operator to `channel`.
    const operator: NarrowOperator =
      opSegment === "stream" ? "channel" : opSegment;

    const operand = decodeOperand(operator, operandSegment);
    if (operand === undefined) {
      return {
        ok: false,
        reason: `malformed operand for operator "${operator}"`,
      };
    }

    const term: NarrowTerm = { operator, operand };
    if (negated) {
      term.negated = true;
    }
    narrow.push(term);
  }

  return { ok: true, narrow };
}
