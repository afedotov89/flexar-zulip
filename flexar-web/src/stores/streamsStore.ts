// Server-state store: channels and the viewer's subscriptions
// (Phase 1.3, persist added 2-redesign).
//
// Holds two keyed collections for the read-path UI:
//   - `streams`        — every channel visible to the user (the
//                        channel browser, channel metadata lookups).
//   - `subscriptions`  — the channels the user is subscribed to, with
//                        their personal settings (the channel sidebar).
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `streams` / `subscriptions` / `unsubscribed` / `never_subscribed`
// keys at connect time, re-hydrates on every re-register, and folds
// `stream` and `subscription` events on top. The pure reducers live in
// `./streamsReducer`.
//
// `persist`: the directory is mirrored to `localStorage` so a hard
// reload renders the sidebar channel list instantly from cache.
// Register overwrites the cache as soon as it lands; the staleness
// window is the few-second delay before the new snapshot arrives.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Stream, StreamId, Subscription } from "../domain";
import { isStreamEvent, isSubscriptionEvent } from "./eventGuards";
import {
  applyStreamEvent,
  applySubscriptionEvent,
  streamsFromInitialState,
  type StreamMap,
  type SubscriptionMap,
} from "./streamsReducer";
import { wireStore } from "./wireStore";

export interface StreamsState {
  /** Every channel visible to the user, keyed by `stream_id`. */
  streams: StreamMap;
  /** The viewer's current subscriptions, keyed by `stream_id`. */
  subscriptions: SubscriptionMap;
  /** Look up a channel's metadata by id. */
  getStream: (streamId: StreamId) => Stream | undefined;
  /** Look up the viewer's subscription to a channel by id. */
  getSubscription: (streamId: StreamId) => Subscription | undefined;
  /** Whether the viewer is currently subscribed to a channel. */
  isSubscribed: (streamId: StreamId) => boolean;
}

export const useStreamsStore = create<StreamsState>()(
  persist(
    (_set, get) => ({
      streams: {},
      subscriptions: {},
      getStream: (streamId) => get().streams[streamId],
      getSubscription: (streamId) => get().subscriptions[streamId],
      isSubscribed: (streamId) => streamId in get().subscriptions,
    }),
    {
      name: "flexar-hub-streams",
      partialize: (state) => ({
        streams: state.streams,
        subscriptions: state.subscriptions,
      }),
    },
  ),
);

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useStreamsStore.setState(streamsFromInitialState(state));
  },
  applyEvent: (event) => {
    if (isStreamEvent(event)) {
      useStreamsStore.setState((state) =>
        applyStreamEvent(
          { streams: state.streams, subscriptions: state.subscriptions },
          event,
        ),
      );
      return;
    }
    if (isSubscriptionEvent(event)) {
      useStreamsStore.setState((state) =>
        applySubscriptionEvent(
          { streams: state.streams, subscriptions: state.subscriptions },
          event,
        ),
      );
    }
  },
});
