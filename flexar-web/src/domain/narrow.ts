// Narrows — Zulip's filter language for selecting a subset of messages.
//
// On the wire a narrow is a JSON array of `[operator, operand]` pairs,
// each optionally negated. The same structure is used both to fetch
// message history and to filter the events delivered to an event
// queue.

/**
 * Operators recognized in a narrow filter. This covers the operators a
 * chat client realistically constructs; the server tolerates unknown
 * operators, so consumers should not assume this list is exhaustive
 * when *parsing* a narrow received from elsewhere.
 */
export type NarrowOperator =
  | "channel"
  | "stream"
  | "topic"
  | "dm"
  | "dm-including"
  | "pm-with"
  | "sender"
  | "is"
  | "has"
  | "near"
  | "id"
  | "with"
  | "search";

/**
 * A single narrow condition. `negated` defaults to `false` when
 * omitted. `operand` is usually a string (channel name, topic, search
 * term) but is a number or array for ID- and user-based operators.
 */
export interface NarrowTerm {
  operator: NarrowOperator;
  operand: string | number | Array<string | number>;
  negated?: boolean;
}

/** A complete narrow: the conjunction of its terms. */
export type Narrow = NarrowTerm[];

/**
 * The raw `[operator, operand]` tuple form a narrow takes on the wire.
 * The API client is responsible for converting between `NarrowTerm`
 * and this representation.
 */
export type NarrowTuple = [string, string];
