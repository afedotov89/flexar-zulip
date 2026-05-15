// Unit tests for the realm-emoji store (Phase 3.6).
//
// Covers the selectors. The hydrate/applyEvent wiring is exercised
// alongside the other server-state stores in `storeWiring.test`.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RealmEmoji } from "../domain";
import { useRealmEmojiStore } from "./realmEmojiStore";

function emoji(overrides: Partial<RealmEmoji>): RealmEmoji {
  return {
    id: "1",
    name: "rocket",
    source_url: "/static/realm/1.png",
    still_url: null,
    deactivated: false,
    author_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  useRealmEmojiStore.setState({ emojiById: {} });
});

afterEach(() => {
  useRealmEmojiStore.setState({ emojiById: {} });
});

describe("useRealmEmojiStore selectors", () => {
  it("listActive returns only non-deactivated entries, sorted by name", () => {
    useRealmEmojiStore.setState({
      emojiById: {
        "1": emoji({ id: "1", name: "rocket" }),
        "2": emoji({ id: "2", name: "wave" }),
        "3": emoji({ id: "3", name: "old", deactivated: true }),
      },
    });
    expect(useRealmEmojiStore.getState().listActive().map((e) => e.name)).toEqual(
      ["rocket", "wave"],
    );
  });

  it("getByName returns the entry by its `:name:` and skips deactivated", () => {
    useRealmEmojiStore.setState({
      emojiById: {
        "1": emoji({ id: "1", name: "rocket" }),
        "2": emoji({ id: "2", name: "old", deactivated: true }),
      },
    });
    const state = useRealmEmojiStore.getState();
    expect(state.getByName("rocket")?.id).toBe("1");
    expect(state.getByName("old")).toBeUndefined();
    expect(state.getByName("missing")).toBeUndefined();
  });

  it("returns an empty list when no entries are loaded", () => {
    expect(useRealmEmojiStore.getState().listActive()).toEqual([]);
    expect(useRealmEmojiStore.getState().getByName("any")).toBeUndefined();
  });
});
