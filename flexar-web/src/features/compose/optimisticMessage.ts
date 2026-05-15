// Flexar Hub Web — build the optimistic-echo `Message` for a compose
// send (Phase 2.2).
//
// When the compose box sends, the user's message must show in the feed
// before the REST response — that is local echo. The compose layer
// builds a temporary `Message` with the right shape, writes it into
// `messagesStore` under a *local* id, and then reconciles it with the
// real server-assigned message when the response (or the live `message`
// event) arrives.
//
// Local id strategy: monotonically *decreasing* negative integers. Real
// Zulip message ids are positive integers, so a negative id can never
// collide with one — and the reconciliation helper in
// `messagesReducer` uses the negative id solely as a key to drop. The
// counter is module-local; it survives across compose box mounts so a
// fresh compose box never reuses a local id another in-flight send is
// already using.
//
// Domain note: `Message` has many required fields (`recipient_id`,
// `client`, `submessages`, …) that this echo cannot know without a
// server round-trip. We fill them with conventional placeholders so the
// row renders correctly; they are replaced by canonical values when the
// real message lands. `content` is the plain user-typed text wrapped in
// a `<p>` so `MessageContent`'s sanitised-HTML pipeline renders it
// without mode-switching — a tiny duplication of Zulip's renderer
// behaviour for the pre-server preview state.

import type {
  DirectMessageRecipient,
  Message,
  MessageId,
  MessageType,
  StreamId,
  User,
  UserId,
} from "../../domain";

let nextLocalIdSeed = -1;

/**
 * Reserve a fresh local id for an optimistic-echo message. Strictly
 * decreasing across the lifetime of the module, so concurrent in-flight
 * sends never collide.
 */
export function nextLocalId(): MessageId {
  const id = nextLocalIdSeed;
  nextLocalIdSeed -= 1;
  return id;
}

/** Test-only: reset the local-id counter so id ordering is deterministic. */
export function __resetLocalIdSeedForTests(): void {
  nextLocalIdSeed = -1;
}

/** What the compose layer knows about the destination on send. */
export type OptimisticDestination =
  | {
      type: "channel";
      streamId: StreamId;
      /** Channel display name; falls back to `Channel <id>` if unknown. */
      streamName: string | undefined;
      topic: string;
    }
  | {
      type: "direct";
      /**
       * Recipient ids the user is sending to (others only — the viewer
       * is added back here for the `display_recipient`, mirroring
       * Zulip's own DM message shape).
       */
      recipientIds: readonly UserId[];
      /**
       * Resolver for `display_recipient` participant entries.
       * Compose owns the resolver because users are looked up via
       * `usersStore`, which the pure helper does not depend on.
       */
      lookupUser: (userId: UserId) => User | undefined;
    };

/** What the compose layer knows about the sender. */
export interface OptimisticSender {
  userId: UserId;
  email: string;
  fullName: string;
  /** Realm short identifier; safe to leave `""` if unknown. */
  realmStr: string;
  /** Sender avatar URL (matches `User.avatar_url` semantics). */
  avatarUrl: string | null;
}

/**
 * Build an optimistic-echo `Message` ready to drop into `messagesStore`
 * under `localId`. The body `content` is a sanitiser-friendly `<p>`
 * wrap of the user's text; ordering / sender / recipient fields are
 * filled from `sender` and `destination`.
 *
 * `nowMs` is `Date.now()` by default; tests pass a fixed value.
 */
export function buildOptimisticMessage({
  localId,
  content,
  sender,
  destination,
  nowMs = Date.now(),
}: {
  localId: MessageId;
  content: string;
  sender: OptimisticSender;
  destination: OptimisticDestination;
  nowMs?: number;
}): Message {
  const timestamp = Math.floor(nowMs / 1000);

  const base = {
    id: localId,
    content: wrapAsParagraph(content),
    content_type: "text/html" as const,
    topic_links: [],
    sender_id: sender.userId,
    sender_email: sender.email,
    sender_full_name: sender.fullName,
    sender_realm_str: sender.realmStr,
    avatar_url: sender.avatarUrl,
    timestamp,
    client: "flexar-hub-web",
    is_me_message: false,
    reactions: [],
    submessages: [],
  };

  if (destination.type === "channel") {
    const channelMessage: Message = {
      ...base,
      type: "stream" satisfies MessageType,
      subject: destination.topic,
      stream_id: destination.streamId,
      display_recipient:
        destination.streamName ?? `Channel ${destination.streamId}`,
      // Optimistic recipient_id placeholder. `0` is impossible for a
      // real server id; the reconcile step replaces this with the
      // canonical one (or drops the entry entirely if the live event
      // raced ahead).
      recipient_id: 0,
    };
    return channelMessage;
  }

  // Direct message: `display_recipient` includes the viewer (sender).
  // Zulip's own DM shape lists every participant — we mirror that.
  const participantIds = uniqueUserIds([
    sender.userId,
    ...destination.recipientIds,
  ]);
  const dmMessage: Message = {
    ...base,
    type: "private" satisfies MessageType,
    subject: "",
    display_recipient: participantIds.map<DirectMessageRecipient>((id) => {
      if (id === sender.userId) {
        return {
          id: sender.userId,
          email: sender.email,
          full_name: sender.fullName,
          is_mirror_dummy: false,
        };
      }
      const user = destination.lookupUser(id);
      return {
        id,
        email: user?.email ?? "",
        full_name: user?.full_name ?? `User ${id}`,
        is_mirror_dummy: false,
      };
    }),
    recipient_id: 0,
  };
  return dmMessage;
}

// Wrap plain text in a `<p>` element matching Zulip's renderer
// behaviour for the simple no-Markdown case. Special characters are
// escaped so the sanitiser sees safe HTML; complex Markdown stays
// unrendered (intentional — the optimistic echo is plaintext-grade).
function wrapAsParagraph(content: string): string {
  return `<p>${escapeHtml(content)}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function uniqueUserIds(ids: readonly UserId[]): UserId[] {
  const seen = new Set<UserId>();
  const out: UserId[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
