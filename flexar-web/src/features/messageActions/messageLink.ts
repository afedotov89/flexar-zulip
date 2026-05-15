// Flexar Hub Web — message permalink builder (Phase 3.3).
//
// "Copy link to message" needs the canonical URL Zulip uses for a
// single message. The legacy hash form — `#narrow/.../near/<id>` — is
// the form Zulip itself produces and the form other Zulip clients can
// open, so we mirror it here even though our own app uses path-based
// narrow URLs (`src/lib/narrow/scheme.ts`). A user can paste the link
// into another Zulip client (web/desktop/mobile) and it just works.
//
// Channel messages get the channel/topic narrow:
//
//     <realmUrl>/#narrow/channel/<streamId>/topic/<encodedTopic>/near/<id>
//
// Direct messages get the dm narrow with the participant ids (the
// other participants — Zulip's narrow excludes the viewer; for self-DM
// the single participant is the viewer):
//
//     <realmUrl>/#narrow/dm/<id1,id2>/near/<id>
//
// `encodeTopicSegment` mirrors Zulip's web client encoding: spaces and
// most punctuation are percent-encoded, but `.` is left bare (Zulip
// treats `.` as a topic separator in its hash routes).
//
// Pure: no DOM, no clipboard, no I/O. Returns `undefined` if the inputs
// can't form a meaningful URL (no `realmUrl`; channel message without a
// `stream_id`; DM with no participants).

import type { Message, UserId } from "../../domain";

/** Inputs the URL builder needs from outside the message. */
export interface MessageLinkContext {
  /** The realm's base URL (e.g. `https://chat.example.com`). */
  realmUrl: string | undefined;
  /** The viewer's user id, used to compute the DM participant set. */
  viewerId: UserId | undefined;
}

/**
 * Build the permalink to a single message, in Zulip's canonical
 * `#narrow/.../near/<id>` form. Returns `undefined` when the inputs are
 * insufficient to form a meaningful URL.
 */
export function buildMessageLink(
  message: Message,
  context: MessageLinkContext,
): string | undefined {
  const base = trimTrailingSlash(context.realmUrl);
  if (base === undefined) {
    return undefined;
  }

  if (message.type === "stream") {
    if (message.stream_id === undefined) {
      return undefined;
    }
    const topicSegment = encodeTopicSegment(message.subject);
    return (
      `${base}/#narrow/channel/${message.stream_id}` +
      `/topic/${topicSegment}/near/${message.id}`
    );
  }

  // Direct message: encode the participant ids the conventional way
  // (other participants only; for self-DMs that leaves the viewer).
  const participantIds = dmParticipantIds(message, context.viewerId);
  if (participantIds.length === 0) {
    return undefined;
  }
  const idsSegment = participantIds.join(",");
  return `${base}/#narrow/dm/${idsSegment}/near/${message.id}`;
}

/**
 * Compute the DM narrow's participant id list for a message: the set
 * of participants in `display_recipient` minus the viewer (Zulip's
 * convention). For self-DMs the only participant *is* the viewer, so
 * we keep them rather than emit an empty list.
 */
function dmParticipantIds(
  message: Message,
  viewerId: UserId | undefined,
): UserId[] {
  if (typeof message.display_recipient === "string") {
    // A string display_recipient is for channel messages — DMs always
    // have an array — so this branch is defensive.
    return [];
  }
  const allIds = message.display_recipient.map((r) => r.id);
  if (viewerId === undefined || allIds.length <= 1) {
    return [...allIds].sort((a, b) => a - b);
  }
  const others = allIds.filter((id) => id !== viewerId);
  return (others.length === 0 ? allIds : others).sort((a, b) => a - b);
}

/**
 * Encode a topic for Zulip's hash narrow segments. Zulip's web client
 * (`web/src/internal_url.ts: encodeHashComponent`) uses `.` as a
 * single-byte stand-in for `%` to dodge browsers that eagerly decode
 * `window.location.hash`, then escapes a handful of extra characters so
 * the source `.` literals in the topic still round-trip cleanly. We
 * mirror that exact substitution table so the links we emit are
 * indistinguishable from the ones Zulip's own clients produce.
 */
function encodeTopicSegment(topic: string): string {
  return encodeURIComponent(topic).replace(
    /[%!'()*.]/g,
    (ch) => HASH_REPLACEMENTS[ch],
  );
}

const HASH_REPLACEMENTS: Record<string, string> = {
  "%": ".",
  "!": ".21",
  "'": ".27",
  "(": ".28",
  ")": ".29",
  "*": ".2A",
  ".": ".2E",
};

/** Drop a single trailing slash from a URL, if present; pass undefined through. */
function trimTrailingSlash(url: string | undefined): string | undefined {
  if (url === undefined) {
    return undefined;
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
