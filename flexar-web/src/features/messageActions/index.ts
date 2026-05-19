// Flexar Hub Web — message actions feature public surface (Phase 3.3).
//
// `MessageRow` mounts the actions menu and the delete-confirm modal;
// edit, since the Telegram-style unification, goes through the
// global `useComposeEditingStore` and is handled by the compose box
// at the bottom of the screen, not an inline form.

export {
  MessageActionsMenu,
  type MessageActionsMenuProps,
} from "./MessageActionsMenu";
export {
  DeleteConfirmModal,
  type DeleteConfirmModalProps,
} from "./DeleteConfirmModal";
export {
  EditHistoryModal,
  type EditHistoryModalProps,
} from "./EditHistoryModal";
export { buildMessageLink, type MessageLinkContext } from "./messageLink";
