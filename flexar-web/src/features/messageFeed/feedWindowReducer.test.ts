// Unit tests for the feed window reducer (Phase 1.6).
//
// The reducer owns the feed's per-narrow ordered id list and the
// pagination cursors. These tests cover: the initial state, the
// initial-fetch lifecycle (start / success / error), older- and
// newer-page merges (sorted, de-duplicated, the right cursor updated),
// pagination errors, the live-message append rule (only when
// `foundNewest`, idempotent), and message removal.

import { describe, expect, it } from "vitest";
import {
  applyInitialFetch,
  applyInitialFetchError,
  applyLiveMessage,
  applyNewerPage,
  applyOlderPage,
  applyPageFetchError,
  initialFeedWindowState,
  removeMessage,
  startInitialFetch,
  startPageFetch,
  type FetchPageResult,
} from "./feedWindowReducer";

function page(
  ids: number[],
  overrides: Partial<FetchPageResult> = {},
): FetchPageResult {
  return {
    ids,
    foundOldest: false,
    foundNewest: false,
    historyLimited: false,
    ...overrides,
  };
}

describe("initialFeedWindowState", () => {
  it("is an empty, idle window", () => {
    const state = initialFeedWindowState();
    expect(state.orderedIds).toEqual([]);
    expect(state.status).toBe("idle");
    expect(state.foundOldest).toBe(false);
    expect(state.foundNewest).toBe(false);
    expect(state.loadingOlder).toBe(false);
    expect(state.loadingNewer).toBe(false);
  });
});

describe("initial fetch lifecycle", () => {
  it("startInitialFetch moves to loading and clears any error", () => {
    const state = applyInitialFetchError(
      initialFeedWindowState(),
      "boom",
    );
    const next = startInitialFetch(state);
    expect(next.status).toBe("loading");
    expect(next.error).toBeUndefined();
  });

  it("applyInitialFetch sets the ordered list and cursors", () => {
    const next = applyInitialFetch(
      startInitialFetch(initialFeedWindowState()),
      page([3, 1, 2], { foundOldest: true, foundNewest: true }),
    );
    expect(next.orderedIds).toEqual([1, 2, 3]);
    expect(next.status).toBe("ready");
    expect(next.foundOldest).toBe(true);
    expect(next.foundNewest).toBe(true);
  });

  it("applyInitialFetch carries through historyLimited", () => {
    const next = applyInitialFetch(
      initialFeedWindowState(),
      page([1], { historyLimited: true }),
    );
    expect(next.historyLimited).toBe(true);
  });

  it("applyInitialFetchError records the error, keeps any prior window", () => {
    const ready = applyInitialFetch(initialFeedWindowState(), page([1, 2]));
    const next = applyInitialFetchError(ready, "network down");
    expect(next.status).toBe("error");
    expect(next.error).toBe("network down");
    expect(next.orderedIds).toEqual([1, 2]);
  });
});

describe("older-page pagination", () => {
  it("merges older ids ahead of the window, sorted and de-duplicated", () => {
    const base = applyInitialFetch(initialFeedWindowState(), page([5, 6, 7]));
    const loading = startPageFetch(base, "older");
    expect(loading.loadingOlder).toBe(true);
    const next = applyOlderPage(loading, page([3, 4, 5], { foundOldest: true }));
    expect(next.orderedIds).toEqual([3, 4, 5, 6, 7]);
    expect(next.foundOldest).toBe(true);
    expect(next.loadingOlder).toBe(false);
  });

  it("leaves foundNewest untouched", () => {
    const base = applyInitialFetch(
      initialFeedWindowState(),
      page([5, 6], { foundNewest: true }),
    );
    const next = applyOlderPage(base, page([4]));
    expect(next.foundNewest).toBe(true);
  });

  it("applyPageFetchError clears the older in-flight flag", () => {
    const loading = startPageFetch(initialFeedWindowState(), "older");
    expect(applyPageFetchError(loading, "older").loadingOlder).toBe(false);
  });
});

describe("newer-page pagination", () => {
  it("merges newer ids into the window and updates foundNewest", () => {
    const base = applyInitialFetch(initialFeedWindowState(), page([1, 2, 3]));
    const loading = startPageFetch(base, "newer");
    expect(loading.loadingNewer).toBe(true);
    const next = applyNewerPage(loading, page([3, 4, 5], { foundNewest: true }));
    expect(next.orderedIds).toEqual([1, 2, 3, 4, 5]);
    expect(next.foundNewest).toBe(true);
    expect(next.loadingNewer).toBe(false);
  });

  it("leaves foundOldest untouched", () => {
    const base = applyInitialFetch(
      initialFeedWindowState(),
      page([1, 2], { foundOldest: true }),
    );
    const next = applyNewerPage(base, page([3]));
    expect(next.foundOldest).toBe(true);
  });
});

describe("applyLiveMessage", () => {
  it("appends a matching message when the window reaches the newest end", () => {
    const base = applyInitialFetch(
      initialFeedWindowState(),
      page([1, 2], { foundNewest: true }),
    );
    const next = applyLiveMessage(base, 3);
    expect(next.orderedIds).toEqual([1, 2, 3]);
  });

  it("drops the event when the window does not reach the newest end", () => {
    const base = applyInitialFetch(
      initialFeedWindowState(),
      page([1, 2], { foundNewest: false }),
    );
    const next = applyLiveMessage(base, 3);
    expect(next).toBe(base);
  });

  it("is idempotent for an id already in the window", () => {
    const base = applyInitialFetch(
      initialFeedWindowState(),
      page([1, 2], { foundNewest: true }),
    );
    const next = applyLiveMessage(base, 2);
    expect(next).toBe(base);
  });
});

describe("removeMessage", () => {
  it("drops an id that is in the window", () => {
    const base = applyInitialFetch(initialFeedWindowState(), page([1, 2, 3]));
    expect(removeMessage(base, 2).orderedIds).toEqual([1, 3]);
  });

  it("is a no-op for an id not in the window", () => {
    const base = applyInitialFetch(initialFeedWindowState(), page([1, 2, 3]));
    expect(removeMessage(base, 9)).toBe(base);
  });
});
