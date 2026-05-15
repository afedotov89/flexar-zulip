// Unit tests for `groupReactions`.

import { describe, expect, it } from "vitest";
import type { Reaction } from "../../domain";
import { groupReactions } from "./groupReactions";

function r(
  user_id: number,
  emoji_code: string,
  emoji_name = `name-${emoji_code}`,
): Reaction {
  return { user_id, emoji_code, emoji_name, reaction_type: "unicode_emoji" };
}

describe("groupReactions", () => {
  it("returns no chips for an empty input", () => {
    expect(groupReactions([], 1)).toEqual([]);
  });

  it("groups identical (type, code) entries into one chip", () => {
    const chips = groupReactions(
      [r(1, "1f44d"), r(2, "1f44d"), r(3, "1f389")],
      undefined,
    );
    expect(chips).toHaveLength(2);
    expect(chips[0].emojiCode).toBe("1f44d");
    expect(chips[0].count).toBe(2);
    expect(chips[0].userIds).toEqual([1, 2]);
    expect(chips[1].emojiCode).toBe("1f389");
    expect(chips[1].count).toBe(1);
  });

  it("preserves first-occurrence order of distinct emojis", () => {
    const chips = groupReactions(
      [r(1, "1f389"), r(2, "1f44d"), r(3, "1f389")],
      undefined,
    );
    expect(chips.map((c) => c.emojiCode)).toEqual(["1f389", "1f44d"]);
  });

  it("flags viewerReacted when the viewer is among the reactors", () => {
    const chips = groupReactions([r(1, "1f44d"), r(7, "1f44d")], 7);
    expect(chips[0].viewerReacted).toBe(true);
  });

  it("never flags viewerReacted when the viewer id is undefined", () => {
    const chips = groupReactions([r(1, "1f44d"), r(7, "1f44d")], undefined);
    expect(chips[0].viewerReacted).toBe(false);
  });

  it("keeps reaction_type as part of the group key", () => {
    const a: Reaction = {
      user_id: 1,
      emoji_code: "abc",
      emoji_name: "x",
      reaction_type: "unicode_emoji",
    };
    const b: Reaction = {
      user_id: 2,
      emoji_code: "abc",
      emoji_name: "x",
      reaction_type: "realm_emoji",
    };
    const chips = groupReactions([a, b], undefined);
    expect(chips).toHaveLength(2);
    expect(chips.map((c) => c.reactionType).sort()).toEqual([
      "realm_emoji",
      "unicode_emoji",
    ]);
  });

  it("keeps the first reactor's emoji_name when names diverge", () => {
    const chips = groupReactions(
      [r(1, "x", "first"), r(2, "x", "second")],
      undefined,
    );
    expect(chips[0].emojiName).toBe("first");
  });
});
