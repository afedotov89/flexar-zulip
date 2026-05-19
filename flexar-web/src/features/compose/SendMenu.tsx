// Send / Schedule split-button. Primary button on the left fires a
// regular send; chevron-button on the right opens a `DropdownMenu`
// with context-aware quick presets (see `schedulePresets`) and an
// "Своё время…" entry that opens a Modal with a native
// `<input type="datetime-local">` picker for any other moment.
//
// The split-button shape is shared with Slack / Linear / Notion; the
// presets follow modern messenger convention ("Через час", "Завтра в
// 9:00", …) rather than Zulip's legacy four-row fixed grid.

import { useCallback, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { DropdownMenu } from "../../components/DropdownMenu";
import type { DropdownMenuEntry } from "../../components/DropdownMenu";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { apiClient } from "../../api";
import type { CreateScheduledMessageParams } from "../../api/types";
import { describeApiError } from "../../lib/errors";
import {
  formatDateTimeLocal,
  parseDateTimeLocal,
  presetTimes,
  toUnixSeconds,
} from "./Schedule/schedulePresets";
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
  const [customOpen, setCustomOpen] = useState(false);
  // Seed the custom picker with "Завтра в 09:00" so the user only has
  // to tweak the few fields they actually want to change. Re-seeded
  // each time the modal opens to avoid showing a stale day if the
  // compose box stayed mounted across days.
  const [customValue, setCustomValue] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

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
        setCustomOpen(false);
        onScheduled();
      } catch (cause) {
        onError(describeApiError(cause, "Не удалось запланировать сообщение."));
      }
    },
    [buildScheduleParams, onScheduled, onError],
  );

  const openCustom = useCallback(() => {
    const tomorrow09 = new Date();
    tomorrow09.setDate(tomorrow09.getDate() + 1);
    tomorrow09.setHours(9, 0, 0, 0);
    setCustomValue(formatDateTimeLocal(tomorrow09));
    setCustomError(null);
    setCustomOpen(true);
    setMenuOpen(false);
  }, []);

  const submitCustom = useCallback(() => {
    const date = parseDateTimeLocal(customValue);
    if (date === null) {
      setCustomError("Введите корректную дату и время.");
      return;
    }
    if (date.getTime() <= Date.now()) {
      setCustomError("Время должно быть в будущем.");
      return;
    }
    void fireSchedule(date);
  }, [customValue, fireSchedule]);

  const items = useMemo<DropdownMenuEntry[]>(() => {
    const presets: DropdownMenuEntry[] = presetTimes().map((preset) => ({
      id: preset.id,
      label: preset.label,
      icon: "schedule",
      disabled: !canSend,
      onSelect: () => void fireSchedule(preset.date),
    }));
    return [
      ...presets,
      { id: "sep", separator: true },
      {
        id: "custom",
        label: "Своё время…",
        icon: "schedule",
        disabled: !canSend,
        onSelect: openCustom,
      },
    ];
  }, [canSend, fireSchedule, openCustom]);

  // Local-time minimum for the picker — block selecting the past from
  // the browser-native widget before the user even submits.
  const customMin = formatDateTimeLocal(new Date());

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

      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Запланировать отправку"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setCustomOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={submitCustom}
              disabled={customValue === ""}
            >
              Запланировать
            </Button>
          </>
        }
      >
        <div className={styles.customForm}>
          <label className={styles.customLabel} htmlFor="schedule-custom">
            Дата и время
          </label>
          <input
            id="schedule-custom"
            className={styles.customInput}
            type="datetime-local"
            value={customValue}
            min={customMin}
            onChange={(e) => {
              setCustomValue(e.currentTarget.value);
              setCustomError(null);
            }}
          />
          {customError !== null && (
            <p className={styles.customError} role="alert">
              {customError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
