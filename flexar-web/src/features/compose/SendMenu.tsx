// Send / Schedule split-button. Primary button on the left fires a
// regular send; chevron-button on the right opens a `DropdownMenu`
// with the schedule presets. This mirrors Slack/Linear/Notion's
// split-action pattern.
//
// Custom datetime picking lives in the separate schedule popover in
// the toolbar area (not duplicated here); the menu only exposes the
// quick presets that cover ~99% of "send later" UX.

import { useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { DropdownMenu } from "../../components/DropdownMenu";
import type { DropdownMenuEntry } from "../../components/DropdownMenu";
import { Icon } from "../../components/Icon";
import { apiClient } from "../../api";
import type { CreateScheduledMessageParams } from "../../api/types";
import { describeApiError } from "../../lib/errors";
import { presetTimes, toUnixSeconds } from "./Schedule/schedulePresets";
import styles from "./SendMenu.module.css";

export interface SendMenuProps {
  /** Whether send is currently allowed (has content + valid recipient). */
  canSend: boolean;
  /** Whether a send is in flight (shows the spinner). */
  sending: boolean;
  /** Fires a regular send. */
  onSend: () => void;
  /**
   * Build the schedule-message params from the current compose state.
   * Returns `null` if the form isn't schedule-able.
   */
  buildScheduleParams: () => CreateScheduledMessageParams | null;
  /** Invoked after a successful schedule API call. */
  onScheduled: () => void;
  /** Invoked with a human-readable error to surface to the user. */
  onError: (message: string) => void;
}

export function SendMenu({
  canSend,
  sending,
  onSend,
  buildScheduleParams,
  onScheduled,
  onError,
}: SendMenuProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  const fireSchedule = useCallback(
    async (date: Date): Promise<void> => {
      const params = buildScheduleParams();
      if (params === null) {
        return;
      }
      try {
        await apiClient.createScheduledMessage({
          ...params,
          scheduledDeliveryTimestamp: toUnixSeconds(date),
        });
        setMenuOpen(false);
        onScheduled();
      } catch (cause) {
        onError(describeApiError(cause, "Не удалось запланировать сообщение."));
      }
    },
    [buildScheduleParams, onScheduled, onError],
  );

  // The clock icon and the dropdown's "Варианты отправки" aria-label
  // already carry the "schedule" framing — the row label can be just
  // the time so the menu stays compact and scannable.
  const items: DropdownMenuEntry[] = presetTimes().map((preset) => ({
    id: preset.id,
    label: preset.label,
    icon: "schedule",
    disabled: !canSend,
    onSelect: () => void fireSchedule(preset.date),
  }));

  return (
    <div className={styles.group}>
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={sending}
        disabled={!canSend}
        iconLeft="send"
        className={styles.sendButton}
        onClick={(event) => {
          // The button is `type="submit"`, so the form's onSubmit runs.
          // The fallback below covers the rare case the button is used
          // outside a <form> (e.g. testing scaffolds).
          if (event.currentTarget.form === null) {
            event.preventDefault();
            onSend();
          }
        }}
      >
        Отправить
      </Button>

      <DropdownMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        placement="top"
        aria-label="Варианты отправки"
        items={items}
        trigger={
          <button
            type="button"
            className={styles.chevron}
            disabled={!canSend || sending}
            aria-label="Варианты отправки"
          >
            <Icon name="chevron-down" size="sm" />
          </button>
        }
      />
    </div>
  );
}
