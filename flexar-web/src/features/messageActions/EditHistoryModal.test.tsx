// Unit tests for the edit-history modal (Phase 4.6).
//
// Most of the modal is render-around-fetch glue — the meaningful
// pure piece is `summariseEntry`. Tested here exhaustively; the
// fetch+render path is covered by smoke checks.

import { describe, expect, it } from "vitest";
import type { MessageEdit } from "../../domain";
import { summariseEntry } from "./EditHistoryModal";

const channelName = (id: number | undefined): string =>
  id === undefined ? "" : `Channel${id}`;

function entry(overrides: Partial<MessageEdit>): MessageEdit {
  return {
    user_id: 1,
    timestamp: 0,
    ...overrides,
  };
}

describe("summariseEntry", () => {
  it("returns 'Original message' for a snapshot with no `prev_*` fields", () => {
    expect(summariseEntry(entry({}), channelName)).toBe("Original message");
  });

  it("describes a content edit", () => {
    expect(
      summariseEntry(entry({ prev_content: "old text" }), channelName),
    ).toBe("edited content");
  });

  it("describes a topic move with both before and after", () => {
    expect(
      summariseEntry(
        entry({ prev_topic: "old", topic: "new" }),
        channelName,
      ),
    ).toBe('moved from topic "old" to "new"');
  });

  it("describes a channel move using the resolver", () => {
    expect(
      summariseEntry(
        entry({ prev_stream: 11, stream: 22 }),
        channelName,
      ),
    ).toBe("moved from #Channel11 to #Channel22");
  });

  it("joins multiple changes with `·`", () => {
    expect(
      summariseEntry(
        entry({
          prev_content: "x",
          prev_topic: "old",
          topic: "new",
        }),
        channelName,
      ),
    ).toBe('edited content · moved from topic "old" to "new"');
  });
});
