// Flexar Hub Web — reaction picker trigger (Phase 3.2).
//
// A small Popover wrapper around `ReactionPicker`. Two visual variants:
//
//   - `toolbar` — the IconButton that lives in the message-row hover
//     toolbar (replaces Phase 1.6's placeholder);
//   - `inline`  — the "+" chip-shaped affordance that appears at the end
//     of the reactions row when at least one reaction already exists.
//
// In both variants, picking an emoji calls `onPick` and closes the
// popover. The button itself owns no domain knowledge — `MessageRow`
// passes the message id-bound `onPick` callback that handles the
// optimistic add and the API call.

import { useCallback, useState } from "react";
import { IconButton } from "../../components/IconButton";
import { Popover } from "../../components/Popover";
import type { EmojiIdentity } from "../../domain";
import { ReactionPicker } from "./ReactionPicker";
import styles from "./ReactionPickerButton.module.css";

export type ReactionPickerVariant = "toolbar" | "inline";

export interface ReactionPickerButtonProps {
  /** Called with the picked emoji's identity triple before the popover closes. */
  onPick: (identity: EmojiIdentity) => void;
  /** Visual treatment — see file header. Defaults to `toolbar`. */
  variant?: ReactionPickerVariant;
}

export function ReactionPickerButton({
  onPick,
  variant = "toolbar",
}: ReactionPickerButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  const handlePick = useCallback(
    (identity: EmojiIdentity) => {
      onPick(identity);
      setOpen(false);
    },
    [onPick],
  );

  const trigger =
    variant === "toolbar" ? (
      <IconButton
        icon="smile"
        size="sm"
        variant="ghost"
        aria-label="Добавить реакцию"
      />
    ) : (
      <button
        type="button"
        className={styles.inlineTrigger}
        aria-label="Добавить реакцию"
      >
        <span className={styles.inlineGlyph} aria-hidden="true">
          +
        </span>
      </button>
    );

  return (
    <Popover
      trigger={trigger}
      placement="top"
      open={open}
      onOpenChange={setOpen}
      aria-label="Добавить реакцию"
    >
      <ReactionPicker onPick={handlePick} />
    </Popover>
  );
}
