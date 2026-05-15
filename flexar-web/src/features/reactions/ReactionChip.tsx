// Flexar Hub Web — reaction chip (Phase 3.2).
//
// One chip in the reactions row: the displayable glyph (or :colons:
// fallback for non-unicode namespaces), the count, and a `Tooltip` with
// the list of reactor names. The chip is a real `<button>` so it is
// keyboard-reachable and screen readers announce it via the
// `aria-label` (the same human string the tooltip shows visually).
//
// Visual states:
//   - default      — bordered chip on the surface;
//   - viewerReacted — accent border + tinted background, signalling
//     "your reaction is part of this group";
//   - hover/focus  — subtle elevation cue.

import { Tooltip } from "../../components/Tooltip";
import type { ReactionChipModel } from "./groupReactions";
import styles from "./ReactionChip.module.css";

export interface ReactionChipProps {
  chip: ReactionChipModel;
  /** Pre-resolved displayable glyph (Unicode, or `:colons:` fallback). */
  glyph: string;
  /** Human label used as both `aria-label` and tooltip content. */
  tooltipLabel: string;
  onClick: () => void;
}

export function ReactionChip({
  chip,
  glyph,
  tooltipLabel,
  onClick,
}: ReactionChipProps): React.JSX.Element {
  const className = [styles.chip, chip.viewerReacted && styles.chipActive]
    .filter(Boolean)
    .join(" ");
  return (
    <Tooltip content={tooltipLabel}>
      <button
        type="button"
        className={className}
        aria-label={tooltipLabel}
        aria-pressed={chip.viewerReacted}
        onClick={onClick}
      >
        <span className={styles.glyph} aria-hidden="true">
          {glyph}
        </span>
        <span className={styles.count}>{chip.count}</span>
      </button>
    </Tooltip>
  );
}
