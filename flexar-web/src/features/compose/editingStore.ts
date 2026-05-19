// Compose-box edit-mode state (Telegram-style unified input).
//
// One global slot — at most one message can be in edit mode at a
// time, because there is only ever one compose box on screen. When
// `editingMessageId` is non-null, the bottom compose box switches
// from "send a new message" to "edit message #id":
//
//   - it pre-fills its textarea with the raw Markdown source of
//     that message (fetched via `apiClient.getRawContent`),
//   - it renders Save + Cancel where SendMenu would normally be,
//   - it hides the recipient row (edit doesn't change destination),
//   - it tags the form with a "Редактирование сообщения" caption.
//
// This replaces the old inline `EditMessageForm` that mounted
// inside the message row. Users keep one mental model for "the
// input where I write"; editing and sending share the toolbar,
// emoji picker, shortcuts, focus management.

import { create } from "zustand";

interface EditingState {
  /** The message currently in edit mode, or null when sending. */
  editingMessageId: number | null;
  /**
   * Start editing the given message. The compose box will fetch the
   * raw Markdown source itself (it has the apiClient wired in) — we
   * only carry the id here to keep the store tiny.
   */
  startEditing: (messageId: number) => void;
  /** Leave edit mode (cancel, save, or escape). */
  stopEditing: () => void;
}

export const useComposeEditingStore = create<EditingState>((set) => ({
  editingMessageId: null,
  startEditing: (messageId) => set({ editingMessageId: messageId }),
  stopEditing: () => set({ editingMessageId: null }),
}));
