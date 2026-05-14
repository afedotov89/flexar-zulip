// Conversion between the domain `Narrow` representation and the wire
// form the Zulip API expects.
//
// On the wire a narrow is a JSON array of objects
// `{ operator, operand, negated? }`. The API accepts the legacy
// `[operator, operand]` tuple form too, but the object form is the one
// the server documents and the only one that can carry `negated`, so
// that is what the client emits. The whole array is then JSON-encoded
// into a single query/body parameter.

import type { Narrow, NarrowTerm } from "../domain";

/** A single narrow term in the object form the API consumes. */
interface WireNarrowTerm {
  operator: string;
  operand: NarrowTerm["operand"];
  negated?: boolean;
}

/** Convert a domain narrow into the JSON-encodable wire array. */
export function narrowToWire(narrow: Narrow): WireNarrowTerm[] {
  return narrow.map((term) => {
    const wire: WireNarrowTerm = {
      operator: term.operator,
      operand: term.operand,
    };
    if (term.negated) {
      wire.negated = true;
    }
    return wire;
  });
}
