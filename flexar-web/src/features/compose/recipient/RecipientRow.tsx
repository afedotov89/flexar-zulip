// Compose recipient row — one compact line above the textarea.
//
// Two shapes depending on `mode`:
//   - `channel` → [# channel ▾] › [topic input] ✕(clear if non-empty)
//   - `direct`  → Кому: [chip ×] [chip ×] + [add input]
//
// Both shapes participate in the `low-attention` styling: when the
// compose-form is not in `:focus-within`, the whole row dims to
// `opacity: 0.55` so it stays visually present but quiet. Returns to
// full opacity on focus-within. This matches Zulip's
// `low-attention-recipient-row` mechanic.

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import { Icon } from "../../../components/Icon";
import { ChannelSelectorButton } from "./ChannelSelectorButton";
import { RecipientPills } from "./RecipientPills";
import { TopicRowContent, TypeaheadPanel, useTopicTypeahead } from "../typeahead";
import { useTopicsStore } from "../../../stores/topicsStore";
import type { UserId } from "../../../domain";
import styles from "./RecipientRow.module.css";

export interface RecipientRowHandle {
  /** Focus the topic input (or the DM-add input, in DM mode). */
  focusTopic: () => void;
}

export type RecipientRowProps =
  | {
      mode: "channel";
      streamId: number | undefined;
      onChannelChange: (streamId: number, name: string) => void;
      topic: string;
      onTopicChange: (topic: string) => void;
      disabled?: boolean;
    }
  | {
      mode: "direct";
      recipientIds: UserId[];
      onRecipientsChange: (next: UserId[]) => void;
      disabled?: boolean;
    };

export const RecipientRow = forwardRef<RecipientRowHandle, RecipientRowProps>(
  function RecipientRow(props, handleRef): React.JSX.Element {
    const topicInputRef = useRef<HTMLInputElement | null>(null);
    const dmRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(handleRef, () => ({
      focusTopic: () => {
        if (props.mode === "channel") {
          topicInputRef.current?.focus();
        } else {
          dmRef.current?.focus();
        }
      },
    }), [props.mode]);

    if (props.mode === "direct") {
      return (
        <div className={styles.row}>
          <RecipientPills
            recipientIds={props.recipientIds}
            onChange={props.onRecipientsChange}
            disabled={props.disabled}
          />
        </div>
      );
    }

    return (
      <ChannelTopicRow
        streamId={props.streamId}
        onChannelChange={props.onChannelChange}
        topic={props.topic}
        onTopicChange={props.onTopicChange}
        disabled={props.disabled}
        topicInputRef={topicInputRef}
      />
    );
  },
);

interface ChannelTopicRowProps {
  streamId: number | undefined;
  onChannelChange: (streamId: number, name: string) => void;
  topic: string;
  onTopicChange: (topic: string) => void;
  disabled?: boolean;
  topicInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

function ChannelTopicRow({
  streamId,
  onChannelChange,
  topic,
  onTopicChange,
  disabled,
  topicInputRef,
}: ChannelTopicRowProps): React.JSX.Element {
  const topicsByChannel = useTopicsStore((s) => s.topicsByChannel);
  const loadTopics = useTopicsStore((s) => s.loadTopics);
  const topicsForChannel = useMemo(
    () => (streamId !== undefined ? topicsByChannel[streamId] ?? [] : []),
    [streamId, topicsByChannel],
  );

  // Wire up the topic typeahead. The `onApply` returns the new value;
  // the parent's controlled state updates and the cursor lands at the
  // end of the new value (replicating the existing behaviour from the
  // pre-refactor compose).
  const pendingTopicCursor = useRef<number | null>(null);
  const typeahead = useTopicTypeahead({
    value: topic,
    streamId,
    topics: topicsForChannel,
    loadTopics,
    onApply: useCallback(
      (next: string) => {
        pendingTopicCursor.current = next.length;
        onTopicChange(next);
      },
      [onTopicChange],
    ),
  });

  // Commit pending caret to the DOM after the value lands.
  const node = topicInputRef.current;
  if (pendingTopicCursor.current !== null && node !== null) {
    const target = pendingTopicCursor.current;
    pendingTopicCursor.current = null;
    queueMicrotask(() => {
      node.setSelectionRange(target, target);
      node.focus();
    });
  }

  const onTopicKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      typeahead.handleKeyDown(event);
    },
    [typeahead],
  );

  const clear = useCallback(() => {
    onTopicChange("");
    topicInputRef.current?.focus();
  }, [onTopicChange, topicInputRef]);

  return (
    <div className={styles.row}>
      <ChannelSelectorButton
        streamId={streamId}
        onChange={onChannelChange}
        disabled={disabled}
      />
      <Icon name="chevron-right" size="sm" className={styles.divider} />
      <div className={styles.topicWrap}>
        <input
          ref={topicInputRef}
          className={styles.topicInput}
          type="text"
          value={topic}
          onChange={(event) => onTopicChange(event.currentTarget.value)}
          onKeyDown={onTopicKeyDown}
          onFocus={typeahead.handleFocus}
          onBlur={typeahead.handleBlur}
          placeholder="Тема"
          disabled={disabled || streamId === undefined}
          aria-label="Тема"
          aria-autocomplete="list"
          aria-controls={
            typeahead.state.open ? typeahead.state.panelId : undefined
          }
          aria-activedescendant={typeahead.state.activeId ?? undefined}
          aria-expanded={typeahead.state.open}
        />
        {topic !== "" && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={clear}
            tabIndex={-1}
            aria-label="Очистить тему"
          >
            <Icon name="close" size="sm" />
          </button>
        )}
        <TypeaheadPanel
          panelId={typeahead.state.panelId}
          anchor={topicInputRef.current}
          open={typeahead.state.open}
          rows={typeahead.state.rows.map((row) => ({
            id: row.id,
            label: row.label,
            render: () => <TopicRowContent row={row} />,
          }))}
          activeId={typeahead.state.activeId}
          onSelect={typeahead.onSelect}
          onHover={typeahead.onHover}
          ariaLabel="Подсказки тем"
        />
      </div>
    </div>
  );
}
