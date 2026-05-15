// Navbar trigger for the status editor (Phase 4.4).
//
// Renders the signed-in user's status as a small chip (emoji + text)
// and opens `StatusEditor` on click. Falls back to "Set status" when
// no status is set.

import { useState } from "react";
import { Popover } from "../../components/Popover";
import { useAuthStore } from "../../stores/authStore";
import { useUserStatusesStore } from "../../stores/userStatusesStore";
import { glyphFromUnicodeEmojiCode } from "../../lib/emoji/identity";
import { StatusEditor } from "./StatusEditor";
import styles from "./StatusButton.module.css";

export function StatusButton(): React.JSX.Element | null {
  const ownUserId = useAuthStore((s) => s.session?.userId);
  const status = useUserStatusesStore((s) =>
    ownUserId === undefined ? undefined : s.statuses[ownUserId],
  );
  const [open, setOpen] = useState(false);

  if (ownUserId === undefined) {
    return null;
  }

  const trigger = (
    <button
      type="button"
      className={styles.trigger}
      aria-label={
        status === undefined
          ? "Установить статус"
          : "Изменить статус"
      }
    >
      {renderInline(status)}
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      placement="bottom"
      open={open}
      onOpenChange={setOpen}
      aria-label="Редактор статуса"
    >
      <StatusEditor current={status} onClose={() => setOpen(false)} />
    </Popover>
  );
}

function renderInline(
  status: import("../../domain").UserStatus | undefined,
): React.ReactNode {
  if (status === undefined) {
    return <span className={styles.placeholder}>Установить статус</span>;
  }
  const emoji = renderEmoji(status);
  return (
    <span className={styles.value}>
      {emoji && <span className={styles.emoji}>{emoji}</span>}
      {status.status_text !== undefined && status.status_text !== "" && (
        <span className={styles.text}>{status.status_text}</span>
      )}
    </span>
  );
}

function renderEmoji(
  status: import("../../domain").UserStatus,
): string | null {
  if (
    status.reaction_type === "unicode_emoji" &&
    status.emoji_code !== undefined &&
    status.emoji_code !== ""
  ) {
    return glyphFromUnicodeEmojiCode(status.emoji_code);
  }
  if (status.emoji_name !== undefined && status.emoji_name !== "") {
    return `:${status.emoji_name}:`;
  }
  return null;
}
