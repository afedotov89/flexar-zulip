// Server-state store: the realm's default-channel list (Phase 5.2).
//
// "Default channels" are the channels new accounts are auto-subscribed
// to. The list IS in the register snapshot, as `realm_default_streams`
// (server-side it's gated on `default_streams` being in
// `fetch_event_types`, which `DEFAULT_EVENT_TYPES` already includes).
// There is no `GET /default_streams` endpoint on the Zulip server — it
// only exposes `POST /default_streams` and `DELETE /default_streams`
// for the add/remove mutations. The snapshot + realtime
// `default_streams` event are the only read paths.
//
// Lifecycle, mirroring the other server-state stores:
//
//   - On (re-)register, hydrate from the snapshot. Admin actions that
//     happened during a queue gap are reflected in the next snapshot.
//   - Realtime `default_streams` events carry the *full* new list (not
//     a delta), so the reducer is a wholesale replace.
//
// No `persist`: server state is re-fetched on every connect and must
// not survive a reload as stale data.

import { create } from "zustand";
import type { StreamId } from "../domain";
import { isDefaultStreamsEvent } from "./eventGuards";
import { wireStore } from "./wireStore";

export interface DefaultStreamsState {
  /** Channel ids the realm auto-subscribes new users to. */
  defaultStreams: StreamId[];
}

const EMPTY_LIST: StreamId[] = [];

export const useDefaultStreamsStore = create<DefaultStreamsState>()(() => ({
  defaultStreams: EMPTY_LIST,
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (snapshot) => {
    // `realm_default_streams` is the snapshot key when
    // `default_streams` is in `fetch_event_types` (see
    // `realtime/connection.ts`). Older server versions or unexpected
    // shapes degrade to an empty list.
    const raw = snapshot["realm_default_streams"];
    const ids = Array.isArray(raw)
      ? raw.filter((id): id is number => typeof id === "number")
      : EMPTY_LIST;
    useDefaultStreamsStore.setState({ defaultStreams: ids });
  },
  applyEvent: (event) => {
    if (!isDefaultStreamsEvent(event)) {
      return;
    }
    // Server sends the full new list, not a delta — wholesale replace.
    useDefaultStreamsStore.setState({
      defaultStreams: event.default_streams,
    });
  },
});
