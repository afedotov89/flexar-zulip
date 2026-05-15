// Flexar Hub Web — shared reaction toggle hook (Phase 3.2).
//
// Both `ReactionsRow` (chip clicks + inline "+" picker) and
// `MessageRow`'s hover-toolbar picker need the same write-path
// behaviour: optimistic update → REST call → revert + error on
// failure. This hook owns it once.
//
// Contract:
//
//   - `toggle(emoji, currentlyActive)` — flip the viewer's reaction on
//     `messageId`. If `currentlyActive` is `true`, the call removes;
//     otherwise adds. Optimistic update happens immediately when the
//     viewer's id is known; on REST failure the change is reverted and
//     `errorMessage` becomes non-null.
//   - `errorMessage` — the most recent failure's text, or `null`.
//     Cleared on the next successful toggle.
//
// Own-user resolution: the toggle uses `authStore.session.userId` for
// the optimistic update. If the id is `undefined` (older Zulip servers)
// the REST call still goes out (the server knows who is calling); the
// optimistic step is skipped and the realtime `reaction` event
// reconciles the cache when it arrives.

import { useCallback, useState } from "react";
import { apiClient } from "../../api";
import type { EmojiIdentity, MessageId } from "../../domain";
import { describeApiError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";
import { useMessagesStore } from "../../stores/messagesStore";

export interface UseReactionToggle {
  toggle: (emoji: EmojiIdentity, currentlyActive: boolean) => Promise<void>;
  errorMessage: string | null;
  clearError: () => void;
}

export function useReactionToggle(messageId: MessageId): UseReactionToggle {
  const viewerId = useAuthStore((state) => state.session?.userId);
  const applyOptimistic = useMessagesStore((s) => s.applyOptimisticReaction);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tryOptimistic = useCallback(
    (op: "add" | "remove", emoji: EmojiIdentity): void => {
      if (viewerId === undefined) {
        return;
      }
      applyOptimistic({ message_id: messageId, op, user_id: viewerId, emoji });
    },
    [applyOptimistic, messageId, viewerId],
  );

  const toggle = useCallback(
    async (emoji: EmojiIdentity, currentlyActive: boolean): Promise<void> => {
      const op: "add" | "remove" = currentlyActive ? "remove" : "add";
      tryOptimistic(op, emoji);
      try {
        if (op === "add") {
          await apiClient.addReaction(messageId, {
            emojiName: emoji.emoji_name,
            emojiCode: emoji.emoji_code,
            reactionType: emoji.reaction_type,
          });
        } else {
          await apiClient.removeReaction(messageId, {
            emojiName: emoji.emoji_name,
            emojiCode: emoji.emoji_code,
            reactionType: emoji.reaction_type,
          });
        }
        // The realtime `reaction` event lands shortly after; the event
        // reducer is idempotent on the same `(user, type, code)`
        // triple, so it harmonises with the optimistic state without a
        // flicker. Clear any prior error.
        setErrorMessage(null);
      } catch (cause) {
        // Revert by running the inverse op through the same reducer.
        const inverse: "add" | "remove" = op === "add" ? "remove" : "add";
        tryOptimistic(inverse, emoji);
        setErrorMessage(describeApiError(cause, "Не удалось обновить реакцию."));
      }
    },
    [messageId, tryOptimistic],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  return { toggle, errorMessage, clearError };
}
