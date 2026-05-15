// Flexar Hub Web — search query → narrow parser (Phase 3.1).
//
// Turns a user-typed search query like
//
//   from:alice channel:engineering is:starred topic:design hello world
//
// into the `Narrow` the message feed already knows how to drive — the
// server's `/messages?narrow=…&search=…` endpoint applies the search.
// Any free-text remainder is collapsed into a single `search` operator
// (the wire shape Zulip uses for full-text search).
//
// Recognised operators (mirroring the Zulip search syntax):
//
//   from:<value>          → sender
//   sender:<value>        → sender (alias of `from:`)
//   channel:<value>       → channel (operand: numeric stream id when
//   stream:<value>          the value is numeric, otherwise the name
//                           string — the Zulip server resolves both)
//   topic:<value>         → topic
//   dm:<value>            → dm (operand: comma-separated user-id list
//                           when numeric tokens, otherwise the raw
//                           email string the server resolves)
//   pm-with:<value>       → dm (alias)
//   dm-including:<value>  → dm-including
//   is:<value>            → is (starred / mentioned / dm / unread / …)
//   has:<value>           → has (link / image / attachment / reaction)
//   near:<id>             → near
//   id:<id>               → id
//
// Each operator may be negated by prefixing `-` (e.g. `-is:starred`).
// A value containing whitespace can be quoted with double quotes.
// Tokens that do not match an operator pattern fall into the
// free-text bucket and are joined into one `search` term.

import type { Narrow, NarrowOperator, NarrowTerm } from "../../domain";

/** The set of operators the parser recognises. */
const OPERATOR_ALIASES: Record<string, NarrowOperator> = {
  from: "sender",
  sender: "sender",
  channel: "channel",
  stream: "channel",
  topic: "topic",
  dm: "dm",
  "pm-with": "dm",
  "dm-including": "dm-including",
  "group-pm-with": "dm-including",
  is: "is",
  has: "has",
  near: "near",
  id: "id",
} as const;

/**
 * Parse a search query into a `Narrow`. Empty / whitespace input
 * yields the empty narrow (the combined feed).
 */
export function parseSearchQuery(input: string): Narrow {
  const tokens = tokenise(input);
  const terms: NarrowTerm[] = [];
  const free: string[] = [];

  for (const token of tokens) {
    const parsed = parseToken(token);
    if (parsed === null) {
      free.push(token.replace(/^-/, "").replace(/^"|"$/g, ""));
      continue;
    }
    terms.push(parsed);
  }

  if (free.length > 0) {
    terms.push({ operator: "search", operand: free.join(" ") });
  }
  return terms;
}

// Split `input` into shell-like tokens, respecting double-quoted
// substrings so `topic:"design review"` stays one token.
function tokenise(input: string): string[] {
  const out: string[] = [];
  let i = 0;
  let current = "";
  let inQuotes = false;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '"') {
      current += ch;
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current !== "") {
        out.push(current);
        current = "";
      }
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current !== "") {
    out.push(current);
  }
  return out;
}

// Try to parse one token as an operator term. Returns `null` when the
// token has no recognised `op:value` shape.
function parseToken(rawToken: string): NarrowTerm | null {
  let negated = false;
  let token = rawToken;
  if (token.startsWith("-")) {
    negated = true;
    token = token.slice(1);
  }
  const colon = token.indexOf(":");
  if (colon <= 0) {
    return null;
  }
  const opRaw = token.slice(0, colon).toLowerCase();
  const valueRaw = token.slice(colon + 1);
  const operator = OPERATOR_ALIASES[opRaw];
  if (operator === undefined) {
    return null;
  }
  const value = stripQuotes(valueRaw);
  if (value === "") {
    return null;
  }
  return buildTerm(operator, value, negated);
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

// Build the typed term for one (operator, value) pair.
function buildTerm(
  operator: NarrowOperator,
  value: string,
  negated: boolean,
): NarrowTerm {
  if (operator === "channel") {
    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      return makeTerm(operator, asNumber, negated);
    }
    return makeTerm(operator, value, negated);
  }
  if (operator === "near" || operator === "id") {
    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      return makeTerm(operator, asNumber, negated);
    }
    // Fall through — the server will reject a non-numeric `near:` /
    // `id:` operand; surfacing the bad input is more honest than
    // silently dropping it.
    return makeTerm(operator, value, negated);
  }
  if (operator === "dm" || operator === "dm-including") {
    // A comma-separated list of numeric user ids becomes the sorted
    // array operand the codec/wire expect; otherwise the raw string
    // (an email or a fuzzy name the server resolves).
    const parts = value.split(",").map((p) => p.trim()).filter((p) => p !== "");
    const numbers = parts.map((p) => Number(p));
    if (parts.length > 0 && numbers.every((n) => Number.isInteger(n) && n > 0)) {
      numbers.sort((a, b) => a - b);
      return makeTerm(operator, numbers, negated);
    }
    return makeTerm(operator, value, negated);
  }
  return makeTerm(operator, value, negated);
}

function makeTerm(
  operator: NarrowOperator,
  operand: NarrowTerm["operand"],
  negated: boolean,
): NarrowTerm {
  if (negated) {
    return { operator, operand, negated: true };
  }
  return { operator, operand };
}
