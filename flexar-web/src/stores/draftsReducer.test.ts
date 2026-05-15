// Unit tests for the drafts reducers (`src/stores/draftsReducer`).
//
// The reducers are tiny but the ordering contract of `listDrafts` is
// load-bearing for the Drafts page (most-recent-first), and the
// `deleteDraft` no-op-on-unknown contract is what lets the compose box
// call it unconditionally.

import { describe, expect, it } from "vitest";
import {
  deleteDraft,
  listDrafts,
  saveDraft,
  type Draft,
  type DraftMap,
} from "./draftsReducer";

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    key: "channel:7:deploys",
    destination: { type: "channel", streamId: 7, topic: "deploys" },
    content: "hi",
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("saveDraft", () => {
  it("inserts a new draft under its key", () => {
    const next = saveDraft({}, makeDraft());
    expect(next["channel:7:deploys"]).toEqual(makeDraft());
  });

  it("replaces an existing draft under the same key", () => {
    const initial: DraftMap = { "channel:7:deploys": makeDraft() };
    const next = saveDraft(
      initial,
      makeDraft({ content: "updated", updatedAt: 1_700_000_001_000 }),
    );
    expect(next["channel:7:deploys"].content).toBe("updated");
    expect(next["channel:7:deploys"].updatedAt).toBe(1_700_000_001_000);
  });

  it("does not mutate the input map", () => {
    const initial: DraftMap = {};
    saveDraft(initial, makeDraft());
    expect(initial).toEqual({});
  });
});

describe("deleteDraft", () => {
  it("removes a known key", () => {
    const initial: DraftMap = { "channel:7:deploys": makeDraft() };
    const next = deleteDraft(initial, "channel:7:deploys");
    expect(next).toEqual({});
  });

  it("is a no-op for an unknown key (returns the same reference)", () => {
    const initial: DraftMap = { "channel:7:deploys": makeDraft() };
    const next = deleteDraft(initial, "channel:9:other");
    expect(next).toBe(initial);
  });

  it("does not mutate the input map", () => {
    const initial: DraftMap = { "channel:7:deploys": makeDraft() };
    deleteDraft(initial, "channel:7:deploys");
    expect(initial["channel:7:deploys"]).toBeDefined();
  });
});

describe("listDrafts", () => {
  it("orders by updatedAt descending (most recent first)", () => {
    const map: DraftMap = {
      a: makeDraft({ key: "a", updatedAt: 100 }),
      b: makeDraft({ key: "b", updatedAt: 300 }),
      c: makeDraft({ key: "c", updatedAt: 200 }),
    };
    expect(listDrafts(map).map((d) => d.key)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by key ascending so order is deterministic", () => {
    const map: DraftMap = {
      z: makeDraft({ key: "z", updatedAt: 100 }),
      a: makeDraft({ key: "a", updatedAt: 100 }),
      m: makeDraft({ key: "m", updatedAt: 100 }),
    };
    expect(listDrafts(map).map((d) => d.key)).toEqual(["a", "m", "z"]);
  });

  it("returns the empty list when there are no drafts", () => {
    expect(listDrafts({})).toEqual([]);
  });
});
