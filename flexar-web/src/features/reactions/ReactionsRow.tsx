// Flexar Hub Web — reactions row under a message (Phase 3.2).
//
// Owns the chip rendering for one message's reactions:
//
//   - groups `Message.reactions` into chips (`groupReactions`);
//   - renders each chip with the displayable glyph (or `:colons:`
//     fallback for non-unicode namespaces — see `reactionDisplayGlyph`);
//   - clicking a chip toggles the viewer's reaction via the `toggle`
//     callback the parent (`MessageRow`) supplies (the same callback
//     drives the toolbar's picker, so the optimistic update / REST
//     call / error handling lives in one place — `useReactionToggle`);
//   - exposes a "+" picker affordance at the end of the row so the
//     user can add a different emoji without going to the toolbar.
//
// The error line under the chips is rendered when `errorMessage` is
// non-null; the row stays mounted on failure so the user can retry.

import { useCallback } from "react";
import type { EmojiIdentity, Message, ReactionType, UserId } from "../../domain";
import { reactionDisplayGlyph } from "../../lib/emoji";
import { ReactionChip } from "./ReactionChip";
import { ReactionPickerButton } from "./ReactionPickerButton";
import { groupReactions, type ReactionChipModel } from "./groupReactions";
import { useChipTooltipLabel } from "./useChipTooltipLabel";
import styles from "./ReactionsRow.module.css";

export interface ReactionsRowProps {
  message: Message;
  /** The signed-in user's id, or `undefined` when the server did not report it. */
  viewerId: UserId | undefined;
  /** Toggle the viewer's reaction; `currentlyActive` decides add vs remove. */
  toggle: (emoji: EmojiIdentity, currentlyActive: boolean) => Promise<void>;
  /** Most-recent failure text, or `null`. Cleared by the next successful toggle. */
  errorMessage: string | null;
}

export function ReactionsRow({
  message,
  viewerId,
  toggle,
  errorMessage,
}: ReactionsRowProps): React.JSX.Element | null {
  const tooltipLabel = useChipTooltipLabel(viewerId);
  const chips = groupReactions(message.reactions, viewerId);

  const handleChipClick = useCallback(
    (chip: ReactionChipModel) => {
      void toggle(
        {
          emoji_name: chip.emojiName,
          emoji_code: chip.emojiCode,
          reaction_type: chip.reactionType,
        },
        chip.viewerReacted,
      );
    },
    [toggle],
  );

  const handlePick = useCallback(
    (identity: EmojiIdentity) => {
      // The picker may pick an emoji the viewer already reacted with —
      // honour it as a toggle (remove), matching Zulip's web behaviour.
      const existing = chips.find(
        (chip) =>
          chip.reactionType === identity.reaction_type &&
          chip.emojiCode === identity.emoji_code,
      );
      void toggle(identity, existing?.viewerReacted ?? false);
    },
    [chips, toggle],
  );

  if (chips.length === 0 && errorMessage === null) {
    return null;
  }

  return (
    <div className={styles.row}>
      {chips.map((chip) => (
        <ReactionChip
          key={chip.key}
          chip={chip}
          glyph={glyphForChip(chip)}
          tooltipLabel={tooltipLabel(chip)}
          onClick={() => handleChipClick(chip)}
        />
      ))}
      {chips.length > 0 && (
        <ReactionPickerButton variant="inline" onPick={handlePick} />
      )}
      {errorMessage !== null && (
        <span className={styles.error} role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}

function glyphForChip(chip: ReactionChipModel): string {
  return reactionDisplayGlyph({
    emoji_name: chip.emojiName,
    emoji_code: chip.emojiCode,
    reaction_type: chip.reactionType satisfies ReactionType,
  });
}
