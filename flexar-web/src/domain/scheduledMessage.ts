// Scheduled messages — Phase 4.5.
//
// A scheduled message is a `Message`-shaped object the server holds and
// will deliver at a future `scheduled_delivery_timestamp`. The user
// composed it now and asked the server to send it later. Once sent, it
// becomes an ordinary `Message` and the scheduled record is dropped.
//
// The shape mirrors `ScheduledMessageBase` in the OpenAPI:
// `to` is a single channel id for `type: "stream"` and a list of user
// ids for `type: "private"`. The server still uses the legacy `private`
// label here even though the create endpoint accepts the modern
// `direct` synonym.

import type { StreamId, UnixTimestamp, UserId } from "./primitives";

/** Discriminator on a scheduled message's destination. */
export type ScheduledMessageType = "stream" | "private";

/**
 * A scheduled message as returned by `GET /scheduled_messages` and the
 * `scheduled_messages` realtime event.
 */
export interface ScheduledMessage {
  /** Server-assigned id, used for edit/delete and for the remove event. */
  scheduled_message_id: number;
  type: ScheduledMessageType;
  /** Channel id for `stream`; recipient user ids for `private`. */
  to: StreamId | UserId[];
  /** Topic; present only when `type === "stream"`. */
  topic?: string;
  /** Markdown source the user composed. */
  content: string;
  /** Server-rendered HTML of `content`. */
  rendered_content: string;
  /** Unix seconds (UTC) when the server will attempt to deliver. */
  scheduled_delivery_timestamp: UnixTimestamp;
  /** True when the server already tried to send and failed. */
  failed: boolean;
}

