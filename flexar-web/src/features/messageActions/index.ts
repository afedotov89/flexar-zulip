// Flexar Hub Web — message actions feature public surface (Phase 3.3).
//
// `MessageRow` mounts the actions menu, the inline edit form, and the
// delete-confirm modal; the parent owns the open/close state for the
// edit and delete affordances and the inline-error / inline-notice
// surface near the toolbar.

export {
  MessageActionsMenu,
  type MessageActionsMenuProps,
} from "./MessageActionsMenu";
export {
  EditMessageForm,
  type EditMessageFormProps,
} from "./EditMessageForm";
export {
  DeleteConfirmModal,
  type DeleteConfirmModalProps,
} from "./DeleteConfirmModal";
export {
  EditHistoryModal,
  type EditHistoryModalProps,
} from "./EditHistoryModal";
export { buildMessageLink, type MessageLinkContext } from "./messageLink";
