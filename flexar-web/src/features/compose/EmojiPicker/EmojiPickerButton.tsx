// Flexar Hub Web — compose emoji picker trigger (Phase 3.6).
//
// The smiley-face IconButton that opens the compose emoji picker
// popover. Picking an emoji calls `onPick` with the `:shortcode:`
// markdown to insert into the textarea, then closes the popover. The
// button owns no domain knowledge — `ComposeBox` passes the textarea-
// aware `onPick` callback that splices the shortcode at the caret.

import { useCallback, useState } from "react";
import { IconButton } from "../../../components/IconButton";
import { Popover } from "../../../components/Popover";
import { ComposeEmojiPicker } from "./ComposeEmojiPicker";

export interface EmojiPickerButtonProps {
  /** Called with the `:shortcode:` markdown to insert at the caret. */
  onPick: (shortcodeMarkdown: string) => void;
  /** Whether the trigger is disabled (e.g. while sending). */
  disabled?: boolean;
}

export function EmojiPickerButton({
  onPick,
  disabled,
}: EmojiPickerButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  const handlePick = useCallback(
    (shortcodeMarkdown: string) => {
      onPick(shortcodeMarkdown);
      setOpen(false);
    },
    [onPick],
  );

  const trigger = (
    <IconButton
      icon="smile"
      size="sm"
      variant="ghost"
      aria-label="Insert emoji"
      disabled={disabled}
    />
  );

  return (
    <Popover
      trigger={trigger}
      placement="top"
      open={open}
      onOpenChange={setOpen}
      aria-label="Insert emoji"
    >
      <ComposeEmojiPicker onPick={handlePick} />
    </Popover>
  );
}
