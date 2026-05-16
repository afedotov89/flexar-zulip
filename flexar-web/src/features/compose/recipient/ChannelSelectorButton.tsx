// Channel selector for the compose recipient row.
//
// Visually a pill-shaped ghost button — `# channel-name ▾`, or
// `Выберите канал ▾` when nothing is set. Clicking opens a Popover
// with a filterable list of channels. Selecting one calls `onChange`
// and closes the popover; the form-level autofocus then jumps to the
// topic input so the user keeps typing without clicking.
//
// This replaces the previous `<Input>`-with-text-name model. The
// pill-button matches the Zulip dropdown_widget pattern and modern
// messenger conventions; it also removes a class of typos (the old
// model accepted any string and silently mismatched when the channel
// name didn't exactly resolve).

import { useMemo, useState, useEffect, useRef } from "react";
import { Input } from "../../../components/Input";
import { Icon } from "../../../components/Icon";
import { Popover } from "../../../components/Popover";
import { useStreamsStore } from "../../../stores/streamsStore";
import styles from "./ChannelSelectorButton.module.css";

export interface ChannelSelectorButtonProps {
  /** Currently selected channel id, or `undefined` for "not chosen". */
  streamId: number | undefined;
  /** Called with the chosen channel id + name when the user picks one. */
  onChange: (streamId: number, name: string) => void;
  /** Disables the trigger (sending in flight, etc.). */
  disabled?: boolean;
  /** Optional label override for the empty state. */
  emptyLabel?: string;
}

export function ChannelSelectorButton({
  streamId,
  onChange,
  disabled,
  emptyLabel = "Выберите канал",
}: ChannelSelectorButtonProps): React.JSX.Element {
  const streams = useStreamsStore((s) => s.streams);
  const subscriptions = useStreamsStore((s) => s.subscriptions);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const currentName =
    streamId !== undefined ? streams[streamId]?.name : undefined;

  // Subscribed channels first, then unsubscribed public ones; alphabet
  // within each bucket. Matches the sidebar's mental model.
  const ranked = useMemo(() => {
    const all = Object.values(streams);
    const trimmed = query.trim().toLowerCase();
    const matched =
      trimmed === ""
        ? all
        : all.filter((s) => s.name.toLowerCase().includes(trimmed));
    return matched.sort((a, b) => {
      const aSub = subscriptions[a.stream_id] !== undefined ? 0 : 1;
      const bSub = subscriptions[b.stream_id] !== undefined ? 0 : 1;
      if (aSub !== bSub) {
        return aSub - bSub;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [streams, subscriptions, query]);

  // Refocus the search input each time the popover opens so the user
  // can start typing immediately.
  useEffect(() => {
    if (open) {
      // setTimeout to wait for the portal to mount the input node.
      const handle = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(handle);
    }
    setQuery("");
    return undefined;
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="top"
      aria-label="Выбор канала"
      trigger={
        <button
          type="button"
          className={styles.trigger}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={
            currentName !== undefined ? `Канал #${currentName}` : emptyLabel
          }
        >
          <Icon name="hash" size="sm" />
          <span className={styles.label}>{currentName ?? emptyLabel}</span>
          <Icon name="chevron-down" size="sm" />
        </button>
      }
    >
      <div className={styles.panel} role="dialog" aria-label="Каналы">
        <div className={styles.searchRow}>
          <Input
            ref={searchInputRef}
            size="sm"
            type="search"
            iconLeft="search"
            placeholder="Поиск канала"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <ul className={styles.list} role="listbox" aria-label="Каналы">
          {ranked.length === 0 ? (
            <li className={styles.empty}>Ничего не найдено.</li>
          ) : (
            ranked.map((stream) => {
              const isSubscribed = subscriptions[stream.stream_id] !== undefined;
              const isActive = stream.stream_id === streamId;
              return (
                <li key={stream.stream_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={[
                      styles.option,
                      isActive && styles.optionActive,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      onChange(stream.stream_id, stream.name);
                      setOpen(false);
                    }}
                  >
                    <Icon name="hash" size="sm" />
                    <span className={styles.optionName}>{stream.name}</span>
                    {!isSubscribed && (
                      <span className={styles.optionMuted}>не подписан</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Popover>
  );
}
