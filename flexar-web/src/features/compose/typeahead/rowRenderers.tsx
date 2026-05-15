// Flexar Hub Web — typeahead row renderers (Phase 2.3).
//
// Pure presentational row contents for the four typeahead kinds.
// Co-located with the panel because they only ever render inside it
// (and inherit the panel's row layout from `TypeaheadPanel.module.css`).

import { Avatar } from "../../../components/Avatar";
import { Icon } from "../../../components/Icon";
import type {
  ChannelRow,
  EmojiRow,
  MentionRow,
  TopicRow,
} from "./sources";
import styles from "./TypeaheadPanel.module.css";

export function MentionRowContent({ row }: { row: MentionRow }): React.JSX.Element {
  const { user } = row;
  return (
    <>
      <Avatar
        src={user.avatar_url ?? undefined}
        name={user.full_name}
        size="sm"
      />
      <span className={styles.rowMain}>
        <span className={styles.rowLabel}>{user.full_name}</span>
        <span className={styles.rowSubLabel}>{user.email}</span>
      </span>
    </>
  );
}

export function ChannelRowContent({
  row,
}: {
  row: ChannelRow;
}): React.JSX.Element {
  return (
    <>
      <Icon name="hash" size="sm" className={styles.rowIcon} />
      <span className={styles.rowMain}>
        <span className={styles.rowLabel}>{row.stream.name}</span>
      </span>
    </>
  );
}

export function EmojiRowContent({ row }: { row: EmojiRow }): React.JSX.Element {
  return (
    <>
      <span className={styles.rowGlyph} aria-hidden="true">
        {row.entry.glyph}
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowLabel}>:{row.entry.shortcode}:</span>
      </span>
    </>
  );
}

export function TopicRowContent({ row }: { row: TopicRow }): React.JSX.Element {
  return (
    <span className={styles.rowMain}>
      <span className={styles.rowLabel}>{row.label}</span>
    </span>
  );
}
