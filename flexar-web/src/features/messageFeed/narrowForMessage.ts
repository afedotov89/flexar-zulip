// Derive the narrow that holds a given message — used by the
// hover-toolbar's "reply" action to navigate the user to the
// message's conversation before focusing the compose box.
//
// Channel message → `[channel:<id>, topic:<subject>]`.
// Direct message  → `[dm:<participant ids>]`.
//
// Returns an empty narrow as a defensive fallback when the message
// shape is unexpected (no `stream_id` on a channel message, or
// `display_recipient` that isn't an array). An empty narrow lands on
// the combined feed — visible UX, not a crash.

import type { DirectMessageRecipient, Message, Narrow } from "../../domain";

export function narrowForMessage(message: Message): Narrow {
  if (message.type === "stream") {
    if (message.stream_id === undefined) {
      return [];
    }
    return [
      { operator: "channel", operand: message.stream_id },
      { operator: "topic", operand: message.subject },
    ];
  }
  // Direct message. `display_recipient` lists every participant
  // (including the viewer). The DM narrow operand is the sorted ids.
  if (!Array.isArray(message.display_recipient)) {
    return [];
  }
  const ids = (message.display_recipient as DirectMessageRecipient[])
    .map((r) => r.id)
    .filter((id): id is number => typeof id === "number")
    .sort((a, b) => a - b);
  return [{ operator: "dm", operand: ids }];
}
