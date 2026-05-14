// Unit tests for `matchesNarrow` (Phase 1.6).
//
// `matchesNarrow` is the live-append predicate: given a `Message` and a
// `Narrow`, does the message belong in that narrow. These tests cover
// every operator the predicate decides (channel, topic, dm, pm-with,
// dm-including, sender, the `is:` flags), negation, the conjunction
// semantics, the empty-narrow case, and the permissive fallback for
// operators it deliberately cannot evaluate (`search`, `has`, …).

import { describe, expect, it } from "vitest";
import type { Message } from "../../domain";
import { matchesNarrow } from "./matchesNarrow";

// A minimal valid channel `Message`, overridable per field. Mirrors the
// store fixtures but kept local so the narrow module has no test-only
// dependency on `src/stores`.
function channelMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    type: "stream",
    content: "<p>hi</p>",
    content_type: "text/html",
    subject: "general",
    topic_links: [],
    stream_id: 7,
    display_recipient: "engineering",
    recipient_id: 100,
    sender_id: 42,
    sender_email: "user42@example.com",
    sender_full_name: "User 42",
    sender_realm_str: "flexar",
    avatar_url: null,
    timestamp: 1_700_000_000,
    client: "test",
    is_me_message: false,
    reactions: [],
    submessages: [],
    ...overrides,
  };
}

// A minimal valid direct `Message` between the given participant ids.
function dmMessage(
  participantIds: number[],
  overrides: Partial<Message> = {},
): Message {
  return channelMessage({
    type: "private",
    subject: "",
    stream_id: undefined,
    display_recipient: participantIds.map((id) => ({
      id,
      email: `user${id}@example.com`,
      full_name: `User ${id}`,
      is_mirror_dummy: false,
    })),
    ...overrides,
  });
}

describe("matchesNarrow — empty narrow", () => {
  it("matches every message (Combined feed)", () => {
    expect(matchesNarrow(channelMessage(), [])).toBe(true);
    expect(matchesNarrow(dmMessage([1, 2]), [])).toBe(true);
  });
});

describe("matchesNarrow — channel / stream", () => {
  it("matches a channel message in the operand channel", () => {
    expect(
      matchesNarrow(channelMessage({ stream_id: 7 }), [
        { operator: "channel", operand: 7 },
      ]),
    ).toBe(true);
  });

  it("rejects a channel message in a different channel", () => {
    expect(
      matchesNarrow(channelMessage({ stream_id: 9 }), [
        { operator: "channel", operand: 7 },
      ]),
    ).toBe(false);
  });

  it("rejects a direct message", () => {
    expect(
      matchesNarrow(dmMessage([1, 2]), [{ operator: "channel", operand: 7 }]),
    ).toBe(false);
  });

  it("accepts the legacy `stream` operator and string operands", () => {
    expect(
      matchesNarrow(channelMessage({ stream_id: 7 }), [
        { operator: "stream", operand: "7" },
      ]),
    ).toBe(true);
  });
});

describe("matchesNarrow — topic", () => {
  it("matches by exact topic on a channel message", () => {
    const narrow = [
      { operator: "channel" as const, operand: 7 },
      { operator: "topic" as const, operand: "general" },
    ];
    expect(matchesNarrow(channelMessage({ subject: "general" }), narrow)).toBe(
      true,
    );
    expect(matchesNarrow(channelMessage({ subject: "other" }), narrow)).toBe(
      false,
    );
  });

  it("rejects a direct message for a topic term", () => {
    expect(
      matchesNarrow(dmMessage([1, 2]), [
        { operator: "topic", operand: "general" },
      ]),
    ).toBe(false);
  });
});

describe("matchesNarrow — dm / pm-with", () => {
  it("matches a direct message with the same participant set", () => {
    expect(
      matchesNarrow(dmMessage([1, 2, 3]), [
        { operator: "dm", operand: [1, 2, 3] },
      ]),
    ).toBe(true);
  });

  it("folds in the viewer id so an operand omitting self still matches", () => {
    // `display_recipient` lists every participant including the viewer;
    // a `dm` operand built without self should still match.
    expect(
      matchesNarrow(
        dmMessage([1, 2, 5]),
        [{ operator: "dm", operand: [1, 2] }],
        { ownUserId: 5 },
      ),
    ).toBe(true);
  });

  it("rejects a direct message with a different participant set", () => {
    expect(
      matchesNarrow(dmMessage([1, 2]), [
        { operator: "dm", operand: [1, 2, 3] },
      ]),
    ).toBe(false);
  });

  it("rejects a channel message for a dm term", () => {
    expect(
      matchesNarrow(channelMessage(), [{ operator: "dm", operand: [1, 2] }]),
    ).toBe(false);
  });

  it("treats pm-with identically to dm", () => {
    expect(
      matchesNarrow(dmMessage([4, 8]), [
        { operator: "pm-with", operand: [4, 8] },
      ]),
    ).toBe(true);
  });
});

describe("matchesNarrow — dm-including", () => {
  it("matches when the operand id is among the participants", () => {
    expect(
      matchesNarrow(dmMessage([1, 2, 3]), [
        { operator: "dm-including", operand: 2 },
      ]),
    ).toBe(true);
  });

  it("rejects when the operand id is not a participant", () => {
    expect(
      matchesNarrow(dmMessage([1, 2, 3]), [
        { operator: "dm-including", operand: 9 },
      ]),
    ).toBe(false);
  });

  it("rejects a channel message", () => {
    expect(
      matchesNarrow(channelMessage(), [
        { operator: "dm-including", operand: 2 },
      ]),
    ).toBe(false);
  });
});

describe("matchesNarrow — sender", () => {
  it("matches by numeric sender id", () => {
    expect(
      matchesNarrow(channelMessage({ sender_id: 42 }), [
        { operator: "sender", operand: 42 },
      ]),
    ).toBe(true);
  });

  it("resolves the `me` literal against the viewer id", () => {
    const narrow = [{ operator: "sender" as const, operand: "me" }];
    expect(
      matchesNarrow(channelMessage({ sender_id: 42 }), narrow, {
        ownUserId: 42,
      }),
    ).toBe(true);
    expect(
      matchesNarrow(channelMessage({ sender_id: 7 }), narrow, {
        ownUserId: 42,
      }),
    ).toBe(false);
  });

  it("treats `sender:me` as permissive when the viewer id is unknown", () => {
    expect(
      matchesNarrow(channelMessage({ sender_id: 42 }), [
        { operator: "sender", operand: "me" },
      ]),
    ).toBe(true);
  });
});

describe("matchesNarrow — is: flags", () => {
  it("matches is:dm / is:private for direct messages", () => {
    expect(
      matchesNarrow(dmMessage([1, 2]), [{ operator: "is", operand: "dm" }]),
    ).toBe(true);
    expect(
      matchesNarrow(channelMessage(), [
        { operator: "is", operand: "private" },
      ]),
    ).toBe(false);
  });

  it("matches is:mentioned / is:starred from the flags context", () => {
    expect(
      matchesNarrow(
        channelMessage(),
        [{ operator: "is", operand: "mentioned" }],
        { flags: ["mentioned"] },
      ),
    ).toBe(true);
    expect(
      matchesNarrow(
        channelMessage(),
        [{ operator: "is", operand: "starred" }],
        { flags: ["read"] },
      ),
    ).toBe(false);
  });

  it("matches is:unread as the absence of the read flag", () => {
    expect(
      matchesNarrow(channelMessage(), [{ operator: "is", operand: "unread" }], {
        flags: [],
      }),
    ).toBe(true);
    expect(
      matchesNarrow(channelMessage(), [{ operator: "is", operand: "unread" }], {
        flags: ["read"],
      }),
    ).toBe(false);
  });

  it("matches is:resolved by the resolved-topic prefix", () => {
    expect(
      matchesNarrow(channelMessage({ subject: "✔ done" }), [
        { operator: "is", operand: "resolved" },
      ]),
    ).toBe(true);
    expect(
      matchesNarrow(channelMessage({ subject: "done" }), [
        { operator: "is", operand: "resolved" },
      ]),
    ).toBe(false);
  });

  it("is permissive for flag-derived is: terms with no flags context", () => {
    // No flags supplied → undecidable → treated as a match.
    expect(
      matchesNarrow(channelMessage(), [
        { operator: "is", operand: "mentioned" },
      ]),
    ).toBe(true);
  });

  it("is permissive for is:followed (undecidable)", () => {
    expect(
      matchesNarrow(channelMessage(), [
        { operator: "is", operand: "followed" },
      ]),
    ).toBe(true);
  });
});

describe("matchesNarrow — negation", () => {
  it("inverts a decidable term", () => {
    expect(
      matchesNarrow(channelMessage({ stream_id: 7 }), [
        { operator: "channel", operand: 7, negated: true },
      ]),
    ).toBe(false);
    expect(
      matchesNarrow(channelMessage({ stream_id: 9 }), [
        { operator: "channel", operand: 7, negated: true },
      ]),
    ).toBe(true);
  });

  it("leaves an undecidable term permissive even when negated", () => {
    // Undecidable terms are skipped before negation is applied.
    expect(
      matchesNarrow(channelMessage(), [
        { operator: "search", operand: "hello", negated: true },
      ]),
    ).toBe(true);
  });
});

describe("matchesNarrow — conjunction and undecidable operators", () => {
  it("requires every term to match", () => {
    const narrow = [
      { operator: "channel" as const, operand: 7 },
      { operator: "topic" as const, operand: "general" },
    ];
    expect(
      matchesNarrow(channelMessage({ stream_id: 7, subject: "general" }), narrow),
    ).toBe(true);
    expect(
      matchesNarrow(channelMessage({ stream_id: 7, subject: "other" }), narrow),
    ).toBe(false);
  });

  it("treats search / has / near / id / with as permissive", () => {
    for (const operator of ["search", "has", "near", "id", "with"] as const) {
      expect(
        matchesNarrow(channelMessage(), [{ operator, operand: "x" }]),
      ).toBe(true);
    }
  });

  it("still enforces decidable terms alongside undecidable ones", () => {
    const narrow = [
      { operator: "channel" as const, operand: 7 },
      { operator: "search" as const, operand: "anything" },
    ];
    expect(matchesNarrow(channelMessage({ stream_id: 7 }), narrow)).toBe(true);
    expect(matchesNarrow(channelMessage({ stream_id: 9 }), narrow)).toBe(false);
  });
});
