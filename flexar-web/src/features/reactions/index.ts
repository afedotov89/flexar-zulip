// Flexar Hub Web — reactions feature public surface (Phase 3.2).
//
// `MessageRow` calls `useReactionToggle(messageId)` once per message,
// then mounts `ReactionsRow` (chip rendering + the inline "+" picker)
// and `ReactionPickerButton` (the toolbar trigger), wiring both to the
// hook's `toggle` so the optimistic update / REST call / error handling
// lives in exactly one place.

export { ReactionsRow, type ReactionsRowProps } from "./ReactionsRow";
export {
  ReactionPickerButton,
  type ReactionPickerButtonProps,
  type ReactionPickerVariant,
} from "./ReactionPickerButton";
export { useReactionToggle, type UseReactionToggle } from "./useReactionToggle";
