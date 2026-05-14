// Unit tests for the narrow ↔ URL codec (`src/lib/narrow/scheme`).
//
// The core property is round-trip correctness:
// `parseNarrowPath(narrowToPath(n))` deep-equals `n` for every
// supported narrow shape. Beyond that we cover the exact path strings
// emitted, channel-slug handling, negation, and graceful handling of
// every malformed-input class.

import { describe, expect, it } from "vitest";
import type { Narrow } from "../../domain";
import { NARROW_ROOT, narrowToPath, parseNarrowPath } from "./scheme";

// Assert a narrow survives a path round-trip unchanged.
function expectRoundTrip(narrow: Narrow): void {
  const path = narrowToPath(narrow);
  const result = parseNarrowPath(path);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.narrow).toEqual(narrow);
  }
}

describe("narrowToPath", () => {
  it("serialises the empty narrow to the bare root", () => {
    expect(narrowToPath([])).toBe(NARROW_ROOT);
  });

  it("serialises a channel narrow as a bare id by default", () => {
    expect(narrowToPath([{ operator: "channel", operand: 7 }])).toBe(
      "/narrow/channel/7",
    );
  });

  it("normalises the legacy stream operator to channel", () => {
    expect(narrowToPath([{ operator: "stream", operand: 7 }])).toBe(
      "/narrow/channel/7",
    );
  });

  it("appends a readable slug when a resolver is supplied", () => {
    const path = narrowToPath(
      [{ operator: "channel", operand: 7 }],
      (id) => (id === 7 ? "General Chat" : undefined),
    );
    expect(path).toBe("/narrow/channel/7-general-chat");
  });

  it("serialises a channel + topic narrow", () => {
    const narrow: Narrow = [
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "lunch plans" },
    ];
    expect(narrowToPath(narrow)).toBe(
      "/narrow/channel/7/topic/lunch%20plans",
    );
  });

  it("serialises a DM narrow with sorted user ids", () => {
    expect(
      narrowToPath([{ operator: "dm", operand: [12, 4, 7] }]),
    ).toBe("/narrow/dm/4,7,12");
  });

  it("serialises a search narrow", () => {
    expect(
      narrowToPath([{ operator: "search", operand: "quarterly report" }]),
    ).toBe("/narrow/search/quarterly%20report");
  });

  it("serialises a channel + topic + search combination", () => {
    const narrow: Narrow = [
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "design" },
      { operator: "search", operand: "logo" },
    ];
    expect(narrowToPath(narrow)).toBe(
      "/narrow/channel/7/topic/design/search/logo",
    );
  });

  it("prefixes negated terms with not-", () => {
    expect(
      narrowToPath([{ operator: "is", operand: "starred", negated: true }]),
    ).toBe("/narrow/not-is/starred");
  });

  it("throws on an operator outside the documented set", () => {
    expect(() =>
      narrowToPath([
        // @ts-expect-error — deliberately invalid operator for the test.
        { operator: "bogus", operand: "x" },
      ]),
    ).toThrow(/unknown narrow operator/);
  });

  it("throws when an operand type does not match its operator", () => {
    expect(() =>
      narrowToPath([{ operator: "dm", operand: "not-an-array" }]),
    ).toThrow(/user-id array/);
    expect(() =>
      narrowToPath([{ operator: "channel", operand: "not-a-number" }]),
    ).toThrow(/integer channel id/);
  });
});

describe("parseNarrowPath round-trip", () => {
  it("round-trips the empty narrow", () => {
    expectRoundTrip([]);
  });

  it("round-trips a channel narrow", () => {
    expectRoundTrip([{ operator: "channel", operand: 7 }]);
  });

  it("round-trips a channel + topic narrow", () => {
    expectRoundTrip([
      { operator: "channel", operand: 42 },
      { operator: "topic", operand: "release 1.0" },
    ]);
  });

  it("round-trips a single-user DM narrow", () => {
    expectRoundTrip([{ operator: "dm", operand: [9] }]);
  });

  it("round-trips a multi-user DM narrow", () => {
    expectRoundTrip([{ operator: "dm", operand: [4, 7, 12] }]);
  });

  it("round-trips a search narrow", () => {
    expectRoundTrip([{ operator: "search", operand: "hello world" }]);
  });

  it("round-trips a channel + topic + search narrow", () => {
    expectRoundTrip([
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "design" },
      { operator: "search", operand: "logo mark" },
    ]);
  });

  it("round-trips negated terms", () => {
    expectRoundTrip([
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "noise", negated: true },
    ]);
  });

  it("round-trips is / has keyword narrows", () => {
    expectRoundTrip([{ operator: "is", operand: "mentioned" }]);
    expectRoundTrip([
      { operator: "has", operand: "reaction" },
      { operator: "sender", operand: "me" },
    ]);
  });

  it("round-trips message-id operators as numbers", () => {
    expectRoundTrip([{ operator: "near", operand: 12345 }]);
    expectRoundTrip([{ operator: "id", operand: 99 }]);
    expectRoundTrip([{ operator: "with", operand: 7 }]);
  });

  it("round-trips operands with characters that need escaping", () => {
    expectRoundTrip([{ operator: "search", operand: "a/b?c#d e&f" }]);
    expectRoundTrip([{ operator: "topic", operand: "100% done" }]);
  });

  it("round-trips a channel narrow emitted with a slug", () => {
    const path = narrowToPath(
      [{ operator: "channel", operand: 7 }],
      () => "general",
    );
    const result = parseNarrowPath(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.narrow).toEqual([{ operator: "channel", operand: 7 }]);
    }
  });

  it("normalises a stream-operator path back to channel", () => {
    const result = parseNarrowPath("/narrow/stream/7");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.narrow).toEqual([{ operator: "channel", operand: 7 }]);
    }
  });
});

describe("parseNarrowPath edge cases", () => {
  it("treats the bare root as the empty narrow", () => {
    expect(parseNarrowPath(NARROW_ROOT)).toEqual({ ok: true, narrow: [] });
  });

  it("tolerates a trailing slash on the root", () => {
    expect(parseNarrowPath(`${NARROW_ROOT}/`)).toEqual({
      ok: true,
      narrow: [],
    });
  });

  it("ignores a query string and hash on the path", () => {
    const result = parseNarrowPath("/narrow/channel/7?foo=bar#frag");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.narrow).toEqual([{ operator: "channel", operand: 7 }]);
    }
  });

  it("sorts DM ids on parse regardless of URL order", () => {
    const result = parseNarrowPath("/narrow/dm/12,4,7");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.narrow).toEqual([{ operator: "dm", operand: [4, 7, 12] }]);
    }
  });
});

describe("parseNarrowPath malformed input", () => {
  it("rejects a path that does not start with the narrow root", () => {
    const result = parseNarrowPath("/inbox");
    expect(result.ok).toBe(false);
  });

  it("rejects a path with a prefix that only looks like the root", () => {
    // `/narrowing` must not be mistaken for the `/narrow` space.
    const result = parseNarrowPath("/narrowing/channel/7");
    expect(result.ok).toBe(false);
  });

  it("rejects an operator with no operand segment", () => {
    const result = parseNarrowPath("/narrow/channel");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/operand/);
    }
  });

  it("rejects an unknown operator segment", () => {
    const result = parseNarrowPath("/narrow/bogus/value");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/unknown operator/);
    }
  });

  it("rejects a non-integer channel operand", () => {
    const result = parseNarrowPath("/narrow/channel/abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/malformed operand/);
    }
  });

  it("rejects a non-integer message id operand", () => {
    expect(parseNarrowPath("/narrow/near/12.5").ok).toBe(false);
    expect(parseNarrowPath("/narrow/id/notanumber").ok).toBe(false);
  });

  it("rejects a DM operand with a non-integer participant", () => {
    expect(parseNarrowPath("/narrow/dm/4,foo,7").ok).toBe(false);
    expect(parseNarrowPath("/narrow/dm/4,,7").ok).toBe(false);
  });

  it("rejects an empty DM operand", () => {
    expect(parseNarrowPath("/narrow/dm/").ok).toBe(false);
  });

  it("rejects malformed percent-encoding in a string operand", () => {
    const result = parseNarrowPath("/narrow/search/%E0%A4%A");
    expect(result.ok).toBe(false);
  });

  it("rejects a not- prefix on an unknown operator", () => {
    expect(parseNarrowPath("/narrow/not-bogus/x").ok).toBe(false);
  });
});
