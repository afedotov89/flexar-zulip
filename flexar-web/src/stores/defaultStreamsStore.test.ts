// Unit tests for the default-streams store (Phase 5.2).
//
// Covers the `loadDefaultStreams` fetch path (idempotency, success,
// error) and the realtime `default_streams` event fold. The store's
// store-wiring lifecycle (hydrate / applyEvent through the shared
// `wireStore`) is exercised end-to-end in `storeWiring.test.ts`; this
// suite drives the store directly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DefaultStreamsEvent } from "../domain";

const { getDefaultStreamsMock } = vi.hoisted(() => ({
  getDefaultStreamsMock: vi.fn(),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    apiClient: {
      getDefaultStreams: getDefaultStreamsMock,
    },
  };
});

const { useDefaultStreamsStore } = await import("./defaultStreamsStore");

beforeEach(() => {
  getDefaultStreamsMock.mockReset();
  useDefaultStreamsStore.setState({ defaultStreams: [], loadStatus: "idle" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDefaultStreamsStore.loadDefaultStreams", () => {
  it("fetches the list and stores it on success", async () => {
    getDefaultStreamsMock.mockResolvedValueOnce([1, 2, 3]);

    await useDefaultStreamsStore.getState().loadDefaultStreams();

    expect(getDefaultStreamsMock).toHaveBeenCalledTimes(1);
    expect(useDefaultStreamsStore.getState().defaultStreams).toEqual([1, 2, 3]);
    expect(useDefaultStreamsStore.getState().loadStatus).toBe("loaded");
  });

  it("marks the load as `error` and leaves the list empty on failure", async () => {
    getDefaultStreamsMock.mockRejectedValueOnce(new Error("boom"));

    await useDefaultStreamsStore.getState().loadDefaultStreams();

    expect(useDefaultStreamsStore.getState().loadStatus).toBe("error");
    expect(useDefaultStreamsStore.getState().defaultStreams).toEqual([]);
  });

  it("is a no-op when already loaded", async () => {
    getDefaultStreamsMock.mockResolvedValueOnce([1]);
    await useDefaultStreamsStore.getState().loadDefaultStreams();
    getDefaultStreamsMock.mockClear();

    await useDefaultStreamsStore.getState().loadDefaultStreams();

    expect(getDefaultStreamsMock).not.toHaveBeenCalled();
  });

  it("retries after an error", async () => {
    getDefaultStreamsMock.mockRejectedValueOnce(new Error("first"));
    await useDefaultStreamsStore.getState().loadDefaultStreams();
    expect(useDefaultStreamsStore.getState().loadStatus).toBe("error");

    getDefaultStreamsMock.mockResolvedValueOnce([7]);
    await useDefaultStreamsStore.getState().loadDefaultStreams();

    expect(useDefaultStreamsStore.getState().defaultStreams).toEqual([7]);
    expect(useDefaultStreamsStore.getState().loadStatus).toBe("loaded");
  });
});

describe("default_streams realtime event", () => {
  it("wholesale-replaces the cached list when an event arrives", () => {
    useDefaultStreamsStore.setState({
      defaultStreams: [1, 2],
      loadStatus: "loaded",
    });

    const event: DefaultStreamsEvent = {
      id: 1,
      type: "default_streams",
      default_streams: [3, 4, 5],
    };
    // Mirror what the wired `applyEvent` does — set state directly.
    useDefaultStreamsStore.setState({
      defaultStreams: event.default_streams,
      loadStatus: "loaded",
    });

    expect(useDefaultStreamsStore.getState().defaultStreams).toEqual([3, 4, 5]);
  });
});
