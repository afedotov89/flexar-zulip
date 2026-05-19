// Per-channel topics policy resolver.
//
// Zulip lets each channel pick its own topics policy (mandatory /
// optional / single empty-topic chat), with `inherit` deferring to the
// realm-level setting. Our `Realm` type still only models the legacy
// `realm_mandatory_topics` boolean, so `inherit` resolves through that:
// `true` → mandatory, `false`/absent → optional.
//
// The compose surface speaks in three concrete modes, not the four-
// valued enum: the input is shown or hidden, and an empty topic is
// either rejected, allowed, or required. `resolveTopicsPolicy` flattens
// the channel + realm pair into that small set.

import type { ChannelBase, Realm } from "../domain";

/** What the compose surface needs to know about topics for a channel. */
export type ResolvedTopicsPolicy =
  /** A non-empty topic is required to send. */
  | "mandatory"
  /** A topic is optional — empty is allowed alongside named topics. */
  | "optional"
  /** No topics at all — every message lands in the single empty topic. */
  | "empty_only";

export function resolveTopicsPolicy(
  channel: Pick<ChannelBase, "topics_policy"> | undefined,
  realm: Pick<Realm, "realm_mandatory_topics"> | undefined,
): ResolvedTopicsPolicy {
  switch (channel?.topics_policy) {
    case "disable_empty_topic":
      return "mandatory";
    case "allow_empty_topic":
      return "optional";
    case "empty_topic_only":
      return "empty_only";
    case "inherit":
    case undefined:
      return realm?.realm_mandatory_topics === true ? "mandatory" : "optional";
  }
}
