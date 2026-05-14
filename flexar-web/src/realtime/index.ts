// Public surface of the realtime layer (Phase 1.2).
//
// This layer keeps a live Zulip event queue and fans events out to
// subscribers — the *pipe*. The *stores* that reduce events into
// server state are Phase 1.3 and plug in here via
// `realtimeConnection.subscribe(...)`.
//
// Consumers import `realtimeConnection` (the app-wide instance) and the
// listener/status types from `src/realtime` — not from the individual
// modules. `wireRealtimeToAuth` is the lifecycle binding, called once
// from `App`.

export { RealtimeConnection, DEFAULT_EVENT_TYPES } from "./connection";
export type {
  ConnectionStatus,
  EventListener,
  StatusListener,
  Unsubscribe,
  RealtimeConnectionOptions,
} from "./connection";

export { realtimeConnection, wireRealtimeToAuth } from "./lifecycle";

export { DEFAULT_BACKOFF } from "./backoff";
export type { BackoffOptions } from "./backoff";
