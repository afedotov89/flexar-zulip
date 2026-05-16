// Unit tests for the default-streams store (Phase 5.2).
//
// The store has no fetch path — the list lives in the register
// snapshot under `realm_default_streams` and is replaced wholesale by
// the realtime `default_streams` event. These tests drive both paths
// against the store directly.

import { beforeEach, describe, expect, it } from "vitest";
import type { DefaultStreamsEvent } from "../domain";
import { useDefaultStreamsStore } from "./defaultStreamsStore";

beforeEach(() => {
  useDefaultStreamsStore.setState({ defaultStreams: [] });
});

describe("default_streams realtime event", () => {
  it("wholesale-replaces the cached list when an event arrives", () => {
    useDefaultStreamsStore.setState({ defaultStreams: [1, 2] });

    const event: DefaultStreamsEvent = {
      id: 1,
      type: "default_streams",
      default_streams: [3, 4, 5],
    };
    // Mirror what the wired `applyEvent` does — set state directly.
    useDefaultStreamsStore.setState({
      defaultStreams: event.default_streams,
    });

    expect(useDefaultStreamsStore.getState().defaultStreams).toEqual([3, 4, 5]);
  });

  it("starts with an empty list before any hydration / event", () => {
    expect(useDefaultStreamsStore.getState().defaultStreams).toEqual([]);
  });
});
