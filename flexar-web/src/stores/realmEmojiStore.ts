// Server-state store: custom realm emoji (Phase 3.6).
//
// Holds the organization's custom uploaded emoji — what users see in
// the compose-box emoji picker and the `:` typeahead alongside the
// bundled Unicode corpus, and what `MessageContent` already renders as
// `<img class="emoji emoji-realm-{id}">` from the server's
// `rendered_content`.
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `realm_emoji` map at connect time and re-hydrates on every
// re-register. Server-side mutations of the realm emoji set arrive as
// `realm_emoji` `update` events in the long tail of `ServerEvent` not
// yet typed through the orchestrator (`UnknownEvent`); a re-register
// catches those changes in the meantime.
//
// No `persist`: server state is re-fetched on every connect and must
// not survive a reload as stale data.

import { create } from "zustand";
import type { RealmEmoji } from "../domain";
import type { InitialState } from "../realtime";
import { wireStore } from "./wireStore";

/**
 * The shape of `register`'s `realm_emoji` snapshot: a map keyed by
 * emoji id (the same string that appears in `RealmEmoji.id`). Modelled
 * locally — this is an envelope, not a domain entity.
 */
type RealmEmojiSnapshot = Record<string, RealmEmoji>;

export interface RealmEmojiState {
  /** Every realm emoji the server returned, keyed by `id`. */
  emojiById: Readonly<Record<string, RealmEmoji>>;
  /**
   * Look up a realm emoji by name (excluding deactivated entries).
   * Names round-trip through `:name:` syntax so this is the lookup the
   * picker / typeahead use.
   */
  getByName: (name: string) => RealmEmoji | undefined;
  /**
   * The active realm emoji list, sorted by `name` for stable display.
   * Deactivated entries are filtered out — they cannot be added to new
   * messages, so surfacing them in pickers would be misleading.
   */
  listActive: () => RealmEmoji[];
}

function activeOf(
  emojiById: Readonly<Record<string, RealmEmoji>>,
): RealmEmoji[] {
  const out: RealmEmoji[] = [];
  for (const emoji of Object.values(emojiById)) {
    if (!emoji.deactivated) {
      out.push(emoji);
    }
  }
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return out;
}

export const useRealmEmojiStore = create<RealmEmojiState>()((_set, get) => ({
  emojiById: {},
  getByName: (name) => {
    for (const emoji of Object.values(get().emojiById)) {
      if (emoji.name === name && !emoji.deactivated) {
        return emoji;
      }
    }
    return undefined;
  },
  listActive: () => activeOf(get().emojiById),
}));

/**
 * Pull the realm-emoji snapshot from a register payload, defending
 * against the field being absent (the server omits keys when the
 * register call did not request them) or malformed.
 */
function realmEmojiFromInitialState(
  state: InitialState,
): RealmEmojiSnapshot {
  const raw = state.realm_emoji;
  if (raw == null || typeof raw !== "object") {
    return {};
  }
  return raw as RealmEmojiSnapshot;
}

// Wire to the realtime layer at module load — before `start()` runs.
// No event reducer: realm-emoji-update events are in the long tail not
// yet typed; re-register hydration bounds staleness in the meantime.
wireStore({
  hydrate: (state) => {
    useRealmEmojiStore.setState({
      emojiById: realmEmojiFromInitialState(state),
    });
  },
  applyEvent: () => {
    // Realm-emoji events not yet modelled; see the file header.
  },
});
