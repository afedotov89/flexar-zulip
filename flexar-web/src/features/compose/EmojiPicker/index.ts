// Public surface of the compose emoji picker (Phase 3.6).
//
// Two pieces: the picker contents (`ComposeEmojiPicker`) and the
// `Popover`-wrapped trigger button (`EmojiPickerButton`) that
// `ComposeBox` mounts in its actions row.

export {
  ComposeEmojiPicker,
  type ComposeEmojiPickerProps,
} from "./ComposeEmojiPicker";
export {
  EmojiPickerButton,
  type EmojiPickerButtonProps,
} from "./EmojiPickerButton";
