// Schedule-send trigger button (Phase 4.5).
//
// Sits in the compose box's actions row, next to Send. Opens
// `SchedulePopover`; when the user picks a time, builds the
// `CreateScheduledMessageParams` from the same compose state Send uses
// and calls `apiClient.createScheduledMessage`. Success → notify the
// parent (it clears the body) and close the popover; failure → keep
// the popover open and surface the error to the parent.
//
// Validation policy: matches Send. We refuse to schedule when
// the compose box could not send for the same reason (no channel,
// no topic, no recipients, empty body). The parent computes
// `canSchedule` from the same source as `canSend`.

import { useCallback, useState } from "react";
import { IconButton } from "../../../components/IconButton";
import { Popover } from "../../../components/Popover";
import { apiClient } from "../../../api";
import type { CreateScheduledMessageParams } from "../../../api/types";
import { SchedulePopover } from "./SchedulePopover";
import { toUnixSeconds } from "./schedulePresets";

export interface ScheduleSendButtonProps {
  /**
   * Snapshot the destination + content from the compose form into a
   * `createScheduledMessage` params object — the popover stamps the
   * `scheduledDeliveryTimestamp` itself. Returns `null` when the
   * form is not in a sendable state; the schedule trigger guards
   * against this with `canSchedule` so this is a defensive fallback.
   */
  buildParams: () => CreateScheduledMessageParams | null;
  /** Whether the compose form is sendable. Disables the trigger when not. */
  canSchedule: boolean;
  /** Called once the API confirms the scheduled message was created. */
  onScheduled: () => void;
  /** Called with a human-readable error to surface to the user. */
  onError: (message: string) => void;
}

export function ScheduleSendButton({
  buildParams,
  canSchedule,
  onScheduled,
  onError,
}: ScheduleSendButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSchedule = useCallback(
    async (date: Date) => {
      const params = buildParams();
      if (params === null) {
        // Defensive: the trigger is already disabled when this is true.
        return;
      }
      setBusy(true);
      try {
        await apiClient.createScheduledMessage({
          ...params,
          scheduledDeliveryTimestamp: toUnixSeconds(date),
        });
        setBusy(false);
        setOpen(false);
        onScheduled();
      } catch (cause) {
        setBusy(false);
        onError(describeError(cause));
      }
    },
    [buildParams, onScheduled, onError],
  );

  const trigger = (
    <IconButton
      icon="schedule"
      size="sm"
      variant="ghost"
      aria-label="Schedule send"
      disabled={!canSchedule}
    />
  );

  return (
    <Popover
      trigger={trigger}
      placement="top"
      open={open}
      onOpenChange={setOpen}
      aria-label="Schedule send"
    >
      <SchedulePopover
        onSchedule={handleSchedule}
        onCancel={() => setOpen(false)}
        busy={busy}
      />
    </Popover>
  );
}

function describeError(cause: unknown): string {
  if (cause instanceof Error && cause.message !== "") {
    return cause.message;
  }
  return "Не удалось запланировать сообщение.";
}
