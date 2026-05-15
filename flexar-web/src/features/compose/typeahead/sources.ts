// Flexar Hub Web — typeahead data sources (Phase 2.3).
//
// Pure helpers that map a query string to a ranked list of typeahead
// rows. One source per typeahead kind. Co-located so the UI layer reads
// `mentionRows(query, users)` and gets back `{ id, label, ... }[]`
// without doing any sorting itself.
//
// Ranking rule (shared shape):
//   1. exact prefix matches first (case-insensitive),
//   2. then substring matches,
//   3. tie-break by alphabetical label order.
// Special-case nudges (pinned channels, viewer's own subscriptions) are
// applied as a stable secondary key, before the prefix/substring split.
//
// All matching is case-insensitive; we lowercase once via
// `String.prototype.toLowerCase()` (locale-aware enough for the current
// stand; the `localeCompare` in tie-breaks does the locale work).

import type {
  Stream,
  StreamId,
  Subscription,
  Topic,
  User,
  UserId,
} from "../../../domain";
import type { EmojiEntry } from "../../../lib/emoji";

/** Visible row count cap for every typeahead. */
export const TYPEAHEAD_MAX_ROWS = 8;

/** Common shape every typeahead row carries. */
interface TypeaheadRowBase {
  /** Stable DOM id used by `aria-activedescendant`. */
  id: string;
  /** Plain-text accessible name (announced by screen readers). */
  label: string;
}

export interface MentionRow extends TypeaheadRowBase {
  user: User;
  /** The text spliced into the textarea on selection (`@**Full Name**`). */
  insertText: string;
}

export interface ChannelRow extends TypeaheadRowBase {
  stream: { stream_id: StreamId; name: string };
  /** Whether the viewer is subscribed (used for sort + a subtle indicator). */
  subscribed: boolean;
  /** Whether the viewer pinned this channel (subscribed-only). */
  pinned: boolean;
  /** The text spliced into the textarea on selection (`#**channel**`). */
  insertText: string;
}

export interface EmojiRow extends TypeaheadRowBase {
  entry: EmojiEntry;
  /** The text spliced into the textarea on selection (`:shortcode:`). */
  insertText: string;
}

export interface TopicRow extends TypeaheadRowBase {
  topic: Topic;
  /** The text spliced into the topic input on selection — the topic name. */
  insertText: string;
}

// ── Ranking primitives ─────────────────────────────────────────────

type MatchTier = 0 | 1 | 2;

/** Lower is better. 0 = exact prefix; 1 = substring; 2 = no match. */
function matchTier(label: string, queryLower: string): MatchTier {
  if (queryLower === "") {
    return 0;
  }
  const lower = label.toLowerCase();
  if (lower.startsWith(queryLower)) {
    return 0;
  }
  if (lower.includes(queryLower)) {
    return 1;
  }
  return 2;
}

function compareLabels(a: string, b: string): number {
  return a.localeCompare(b);
}

// ── Mentions ───────────────────────────────────────────────────────

export function mentionRows(
  query: string,
  users: Record<UserId, User>,
): MentionRow[] {
  const q = query.toLowerCase();
  const out: { row: MentionRow; tier: MatchTier }[] = [];
  for (const user of Object.values(users)) {
    if (!user.is_active) {
      continue;
    }
    // Match on full name OR email — the email is what some users
    // remember best, especially in larger orgs.
    const nameTier = matchTier(user.full_name, q);
    const emailTier = matchTier(user.email, q);
    const tier = (Math.min(nameTier, emailTier) as MatchTier);
    if (tier === 2) {
      continue;
    }
    out.push({
      row: {
        id: `typeahead-mention-${user.user_id}`,
        label: user.full_name,
        user,
        insertText: `@**${user.full_name}**`,
      },
      tier,
    });
  }
  out.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    return compareLabels(a.row.label, b.row.label);
  });
  return out.slice(0, TYPEAHEAD_MAX_ROWS).map((entry) => entry.row);
}

// ── Channels ───────────────────────────────────────────────────────

export function channelRows(
  query: string,
  streams: Record<StreamId, Stream>,
  subscriptions: Record<StreamId, Subscription>,
): ChannelRow[] {
  const q = query.toLowerCase();
  const out: { row: ChannelRow; tier: MatchTier; subscribed: boolean; pinned: boolean }[] = [];
  // Iterate over the union of streams + subscribed channels (some
  // subscriptions may not appear in `streams` if the directory is
  // partial — be defensive).
  const seen = new Set<StreamId>();
  for (const stream of Object.values(streams)) {
    seen.add(stream.stream_id);
    const tier = matchTier(stream.name, q);
    if (tier === 2) {
      continue;
    }
    const sub = subscriptions[stream.stream_id];
    out.push({
      row: {
        id: `typeahead-channel-${stream.stream_id}`,
        label: stream.name,
        stream: { stream_id: stream.stream_id, name: stream.name },
        subscribed: sub !== undefined,
        pinned: sub?.pin_to_top ?? false,
        insertText: `#**${stream.name}**`,
      },
      tier,
      subscribed: sub !== undefined,
      pinned: sub?.pin_to_top ?? false,
    });
  }
  for (const sub of Object.values(subscriptions)) {
    if (seen.has(sub.stream_id)) {
      continue;
    }
    const tier = matchTier(sub.name, q);
    if (tier === 2) {
      continue;
    }
    out.push({
      row: {
        id: `typeahead-channel-${sub.stream_id}`,
        label: sub.name,
        stream: { stream_id: sub.stream_id, name: sub.name },
        subscribed: true,
        pinned: sub.pin_to_top,
        insertText: `#**${sub.name}**`,
      },
      tier,
      subscribed: true,
      pinned: sub.pin_to_top,
    });
  }
  out.sort((a, b) => {
    // Pinned subscriptions float above other subscriptions, which
    // float above non-subscribed streams; within each group the
    // tier+label ordering applies.
    const aRank = a.pinned ? 0 : a.subscribed ? 1 : 2;
    const bRank = b.pinned ? 0 : b.subscribed ? 1 : 2;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    return compareLabels(a.row.label, b.row.label);
  });
  return out.slice(0, TYPEAHEAD_MAX_ROWS).map((entry) => entry.row);
}

// ── Emoji ──────────────────────────────────────────────────────────

export function emojiRows(
  query: string,
  corpus: readonly EmojiEntry[],
): EmojiRow[] {
  const q = query.toLowerCase();
  const out: { row: EmojiRow; tier: MatchTier }[] = [];
  for (const entry of corpus) {
    const tier = matchTier(entry.shortcode, q);
    if (tier === 2) {
      continue;
    }
    out.push({
      row: {
        id: `typeahead-emoji-${entry.shortcode}`,
        label: `:${entry.shortcode}:`,
        entry,
        insertText: `:${entry.shortcode}:`,
      },
      tier,
    });
  }
  out.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    return compareLabels(a.row.entry.shortcode, b.row.entry.shortcode);
  });
  return out.slice(0, TYPEAHEAD_MAX_ROWS).map((entry) => entry.row);
}

// ── Topics ─────────────────────────────────────────────────────────

export function topicRows(query: string, topics: readonly Topic[]): TopicRow[] {
  const q = query.toLowerCase();
  const out: { row: TopicRow; tier: MatchTier; maxId: number }[] = [];
  for (const topic of topics) {
    const tier = matchTier(topic.name, q);
    if (tier === 2) {
      continue;
    }
    out.push({
      row: {
        id: `typeahead-topic-${topic.max_id}-${topic.name}`,
        label: topic.name === "" ? "(general)" : topic.name,
        topic,
        insertText: topic.name,
      },
      tier,
      maxId: topic.max_id,
    });
  }
  out.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    // Recency-first within the same tier, matching how topics behave
    // everywhere else in the UI.
    return b.maxId - a.maxId;
  });
  return out.slice(0, TYPEAHEAD_MAX_ROWS).map((entry) => entry.row);
}
