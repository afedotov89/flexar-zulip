// Tests for the topics store's lazy-load action (`src/stores/topicsStore`).
//
// The store's hydrate/applyEvent wiring is covered by `storeWiring.test`;
// the reducers by `topicsReducer.test`. What is unique to this store is
// `loadTopics`: a per-channel, idempotent fetch through `apiClient`,
// with a `loadStatus` the sidebar reads to show a spinner / error.
//
// `../api` and `../realtime` are both mocked so the suite runs fully
// offline — no `fetch`, no real connection.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Topic } from "../domain";

// A controllable fake `apiClient.getTopics`.
const { getTopicsMock } = vi.hoisted(() => ({
  getTopicsMock: vi.fn<(streamId: number) => Promise<Topic[]>>(),
}));

vi.mock("../api", () => ({
  apiClient: { getTopics: getTopicsMock },
}));

// The realtime layer is inert here — the store still wires to it at
// module load, but these tests drive `loadTopics` directly.
vi.mock("../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const { useTopicsStore } = await import("./topicsStore");

beforeEach(() => {
  getTopicsMock.mockReset();
  useTopicsStore.setState({ topicsByChannel: {}, loadStatus: {} });
});

describe("loadTopics", () => {
  it("fetches a channel's topics and caches them most-recent-first", async () => {
    getTopicsMock.mockResolvedValueOnce([
      { name: "old", max_id: 5 },
      { name: "fresh", max_id: 40 },
    ]);

    await useTopicsStore.getState().loadTopics(10);

    expect(getTopicsMock).toHaveBeenCalledTimes(1);
    expect(getTopicsMock).toHaveBeenCalledWith(10);
    expect(useTopicsStore.getState().getTopics(10)).toEqual([
      { name: "fresh", max_id: 40 },
      { name: "old", max_id: 5 },
    ]);
    expect(useTopicsStore.getState().getLoadStatus(10)).toBe("loaded");
  });

  it("sets the loading status while the fetch is in flight", async () => {
    let resolve: (topics: Topic[]) => void = () => {};
    getTopicsMock.mockReturnValueOnce(
      new Promise<Topic[]>((r) => {
        resolve = r;
      }),
    );

    const pending = useTopicsStore.getState().loadTopics(10);
    expect(useTopicsStore.getState().getLoadStatus(10)).toBe("loading");

    resolve([]);
    await pending;
    expect(useTopicsStore.getState().getLoadStatus(10)).toBe("loaded");
  });

  it("does not re-fetch a channel already loaded", async () => {
    getTopicsMock.mockResolvedValueOnce([{ name: "t", max_id: 1 }]);
    await useTopicsStore.getState().loadTopics(10);
    expect(getTopicsMock).toHaveBeenCalledTimes(1);

    await useTopicsStore.getState().loadTopics(10);
    expect(getTopicsMock).toHaveBeenCalledTimes(1);
  });

  it("does not start a second fetch while one is in flight", async () => {
    let resolve: (topics: Topic[]) => void = () => {};
    getTopicsMock.mockReturnValueOnce(
      new Promise<Topic[]>((r) => {
        resolve = r;
      }),
    );

    const first = useTopicsStore.getState().loadTopics(10);
    const second = useTopicsStore.getState().loadTopics(10);
    resolve([]);
    await Promise.all([first, second]);

    expect(getTopicsMock).toHaveBeenCalledTimes(1);
  });

  it("records an error status when the fetch fails, and retries on the next call", async () => {
    getTopicsMock.mockRejectedValueOnce(new Error("network down"));
    await useTopicsStore.getState().loadTopics(10);
    expect(useTopicsStore.getState().getLoadStatus(10)).toBe("error");

    // A later call retries — `error` is not a terminal cached state.
    getTopicsMock.mockResolvedValueOnce([{ name: "t", max_id: 1 }]);
    await useTopicsStore.getState().loadTopics(10);
    expect(useTopicsStore.getState().getLoadStatus(10)).toBe("loaded");
    expect(getTopicsMock).toHaveBeenCalledTimes(2);
  });

  it("tracks channels independently", async () => {
    getTopicsMock
      .mockResolvedValueOnce([{ name: "a", max_id: 1 }])
      .mockResolvedValueOnce([{ name: "b", max_id: 2 }]);

    await useTopicsStore.getState().loadTopics(10);
    await useTopicsStore.getState().loadTopics(11);

    expect(useTopicsStore.getState().getTopics(10)).toEqual([
      { name: "a", max_id: 1 },
    ]);
    expect(useTopicsStore.getState().getTopics(11)).toEqual([
      { name: "b", max_id: 2 },
    ]);
    expect(useTopicsStore.getState().getLoadStatus(12)).toBeUndefined();
  });
});
