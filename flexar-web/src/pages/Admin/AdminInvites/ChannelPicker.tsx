// Channel picker for the invite modals (Phase 5.4).
//
// Renders an alphabetised, scrollable list of checkboxes — one per
// channel from `useStreamsStore` — for the "auto-subscribe new
// invitee to these channels" picker. Selection is controlled by the
// caller, who owns the `Set<StreamId>` so it can pass it to
// `apiClient.sendInvites` / `createReusableInviteLink`.

import { useMemo } from "react";
import { Checkbox } from "../../../components/Checkbox";
import type { StreamId } from "../../../domain";
import { useStreamsStore } from "../../../stores/streamsStore";
import styles from "./ChannelPicker.module.css";

export interface ChannelPickerProps {
  /** Currently selected channel ids. */
  selected: ReadonlySet<StreamId>;
  /** Toggle one channel id; the parent owns the Set. */
  onToggle: (streamId: StreamId) => void;
  /** Disabled while the parent form is in flight. */
  disabled?: boolean;
}

export function ChannelPicker({
  selected,
  onToggle,
  disabled = false,
}: ChannelPickerProps): React.JSX.Element {
  const streamsMap = useStreamsStore((s) => s.streams);

  const sorted = useMemo(() => {
    return Object.values(streamsMap).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [streamsMap]);

  if (sorted.length === 0) {
    return <p className={styles.empty}>Нет доступных каналов.</p>;
  }

  return (
    <div className={styles.list} role="group" aria-label="Каналы">
      {sorted.map((stream) => (
        <Checkbox
          key={stream.stream_id}
          label={stream.name}
          checked={selected.has(stream.stream_id)}
          onChange={() => onToggle(stream.stream_id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
