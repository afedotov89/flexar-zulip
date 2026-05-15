// Schedule-send popover (Phase 4.5).
//
// Panel content of the compose box's schedule-send button. Offers the
// four standard presets ("Tomorrow morning" etc.) and a `<input
// type="datetime-local">` for picking an arbitrary moment. On confirm
// it calls `onSchedule(date)` and the parent dispatches the API call.
//
// Pure UI: no API calls, no store reads. The parent (`ScheduleSendButton`)
// owns the network round-trip, error reporting, and popover open/close.
//
// Date math, presets, and the input-format glue live in
// `./schedulePresets` so they unit-test on their own.

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import {
  formatDateTimeLocal,
  parseDateTimeLocal,
  presetTimes,
  type SchedulePreset,
} from "./schedulePresets";
import styles from "./SchedulePopover.module.css";

export interface SchedulePopoverProps {
  /** Called with the user's chosen send time. Parent fires the API call. */
  onSchedule: (date: Date) => void;
  /** Called when the popover should close (Cancel / Esc). */
  onCancel: () => void;
  /** Whether the parent is mid-request (disables the confirm button). */
  busy?: boolean;
  /** Override "now" for testability; defaults to `new Date()`. */
  nowProvider?: () => Date;
}

export function SchedulePopover({
  onSchedule,
  onCancel,
  busy = false,
  nowProvider = () => new Date(),
}: SchedulePopoverProps): React.JSX.Element {
  // Recompute presets and `min` whenever the popover opens. Keeping
  // them inside `useMemo`'d off `now` makes the snapshot stable across
  // renders without staling if the popover sits open for a while.
  const now = useMemo(() => nowProvider(), [nowProvider]);
  const presets = useMemo(() => presetTimes(now), [now]);
  // The earliest selectable moment in the picker is "one minute from now"
  // so the user cannot submit a time the server would reject as past.
  const minDate = useMemo(() => {
    const next = new Date(now);
    next.setMinutes(next.getMinutes() + 1);
    next.setSeconds(0, 0);
    return next;
  }, [now]);

  // Custom-time input value, controlled. Empty string = no choice yet.
  const [customValue, setCustomValue] = useState("");

  // Move focus to the first preset on mount; the popover wraps this in
  // a `<div role="dialog">` and we want keyboard users on the action,
  // not on the empty datetime input.
  useEffect(() => {
    // The Popover primitive does its own initial focus, but it picks
    // the first tabbable — which is fine here. No imperative work
    // needed; this comment documents the contract.
  }, []);

  const handlePreset = (preset: SchedulePreset): void => {
    onSchedule(preset.date);
  };

  const handleCustom = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const date = parseDateTimeLocal(customValue);
    if (date === null || date.getTime() < minDate.getTime()) {
      return;
    }
    onSchedule(date);
  };

  const customDate = parseDateTimeLocal(customValue);
  const customValid =
    customDate !== null && customDate.getTime() >= minDate.getTime();

  return (
    <div className={styles.popover}>
      <p className={styles.heading}>Отправить позже</p>
      <ul className={styles.presetList}>
        {presets.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              className={styles.presetButton}
              onClick={() => handlePreset(preset)}
              disabled={busy}
            >
              {preset.label}
            </button>
          </li>
        ))}
      </ul>
      <form className={styles.customRow} onSubmit={handleCustom}>
        <label className={styles.customLabel} htmlFor="schedule-custom">
          Своё время
        </label>
        <Input
          id="schedule-custom"
          type="datetime-local"
          value={customValue}
          min={formatDateTimeLocal(minDate)}
          onChange={(event) => setCustomValue(event.currentTarget.value)}
          disabled={busy}
          aria-invalid={customValue !== "" && !customValid}
        />
        <div className={styles.customActions}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!customValid || busy}
            loading={busy}
          >
            Запланировать
          </Button>
        </div>
      </form>
    </div>
  );
}
