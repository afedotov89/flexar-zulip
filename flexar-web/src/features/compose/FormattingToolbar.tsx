// Compose formatting toolbar — horizontally-scrollable strip of
// icon-buttons grouped by purpose (preview / attach / insert /
// inline format / block format / widgets / help).
//
// The actual textarea manipulation lives in `markdownInsert` (pure
// helpers); this component is the chrome + a `command` callback that
// the parent runs against the current value+selection.
//
// Most actions are disabled while preview mode is on (you're not
// editing). Poll / Todo are additionally gated on an empty compose
// (Zulip rule: widgets can't be inserted into mid-message text).
//
// Horizontal overflow is handled with `overflow-x: auto` + a thin
// scrollbar in CSS; explicit scroller buttons (`<`/`>` arrows like
// Zulip has) are a polish iteration if it becomes uncomfortable.

import { type ReactElement } from "react";
import { IconButton } from "../../components/IconButton";
import type { IconName } from "../../icons";
import { Tooltip } from "../../components/Tooltip";
import styles from "./FormattingToolbar.module.css";

export type FormattingCommand =
  | "preview-toggle"
  | "upload"
  | "emoji"
  | "link"
  | "bold"
  | "italic"
  | "strikethrough"
  | "ordered-list"
  | "unordered-list"
  | "quote"
  | "spoiler"
  | "code-block"
  | "math"
  | "poll"
  | "todo"
  | "help";

export interface FormattingToolbarProps {
  /** Whether the preview pane is currently shown. */
  previewOpen: boolean;
  /** Whether the compose textarea is empty (gates poll/todo). */
  composeEmpty: boolean;
  /** Whether sending is in flight (disables everything). */
  disabled?: boolean;
  /** Whether the compose pane is in the maximized writing mode. */
  maximized: boolean;
  /** Toggle the maximized writing mode. */
  onMaximizeToggle: () => void;
  /** Invoked with the chosen command. */
  onCommand: (command: FormattingCommand) => void;
  /** Slot for the emoji / upload popover triggers — they own their
   *  own popovers, the toolbar just gives them a row position.
   *  Schedule lives in the Send split-button (`SendMenu`), not here. */
  slots: {
    upload: ReactElement;
    emoji: ReactElement;
  };
}

interface ToolbarButton {
  id: FormattingCommand;
  icon: IconName;
  label: string;
  /** When `true`, the button stays usable in preview mode. */
  inPreview?: boolean;
  /** When `true`, the button is only enabled on an empty compose. */
  emptyOnly?: boolean;
}

const INLINE_FORMAT: ToolbarButton[] = [
  { id: "link", icon: "link", label: "Ссылка" },
  { id: "bold", icon: "bold", label: "Жирный" },
  { id: "italic", icon: "italic", label: "Курсив" },
  { id: "strikethrough", icon: "strikethrough", label: "Зачёркнутый" },
];

const BLOCK_FORMAT: ToolbarButton[] = [
  { id: "ordered-list", icon: "ordered-list", label: "Нумерованный список" },
  { id: "unordered-list", icon: "unordered-list", label: "Маркированный список" },
  { id: "quote", icon: "quote", label: "Цитата" },
  { id: "spoiler", icon: "eye-off", label: "Спойлер" },
  { id: "code-block", icon: "code-block", label: "Блок кода" },
  { id: "math", icon: "math", label: "Математика (LaTeX)" },
];

const WIDGETS: ToolbarButton[] = [
  { id: "poll", icon: "poll", label: "Опрос", emptyOnly: true },
  { id: "todo", icon: "todo", label: "Список задач", emptyOnly: true },
];

function ToolbarIconButton({
  button,
  previewOpen,
  composeEmpty,
  disabled,
  onCommand,
}: {
  button: ToolbarButton;
  previewOpen: boolean;
  composeEmpty: boolean;
  disabled: boolean;
  onCommand: (command: FormattingCommand) => void;
}): React.JSX.Element {
  const isDisabled =
    disabled ||
    (!button.inPreview && previewOpen) ||
    (button.emptyOnly === true && !composeEmpty);
  return (
    <Tooltip content={button.label}>
      <IconButton
        icon={button.icon}
        size="sm"
        variant="ghost"
        aria-label={button.label}
        disabled={isDisabled}
        onClick={() => onCommand(button.id)}
      />
    </Tooltip>
  );
}

export function FormattingToolbar({
  previewOpen,
  composeEmpty,
  disabled = false,
  maximized,
  onMaximizeToggle,
  onCommand,
  slots,
}: FormattingToolbarProps): React.JSX.Element {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Форматирование сообщения"
    >
      {/* Preview toggle: always enabled (it _is_ the way out of preview). */}
      <Tooltip content={previewOpen ? "Выйти из превью" : "Превью"}>
        <IconButton
          icon={previewOpen ? "pen" : "eye"}
          size="sm"
          variant="ghost"
          aria-label={previewOpen ? "Выйти из превью" : "Превью"}
          aria-pressed={previewOpen}
          disabled={disabled}
          onClick={() => onCommand("preview-toggle")}
        />
      </Tooltip>

      {/* Upload — opens system file picker (UploadButton owns it). */}
      {slots.upload}

      <div className={styles.divider} aria-hidden="true" />

      {/* Insert section. Emoji is a popover-owning slot. */}
      {slots.emoji}

      <div className={styles.divider} aria-hidden="true" />

      {/* Inline format. */}
      {INLINE_FORMAT.map((b) => (
        <ToolbarIconButton
          key={b.id}
          button={b}
          previewOpen={previewOpen}
          composeEmpty={composeEmpty}
          disabled={disabled}
          onCommand={onCommand}
        />
      ))}

      <div className={styles.divider} aria-hidden="true" />

      {/* Block format. */}
      {BLOCK_FORMAT.map((b) => (
        <ToolbarIconButton
          key={b.id}
          button={b}
          previewOpen={previewOpen}
          composeEmpty={composeEmpty}
          disabled={disabled}
          onCommand={onCommand}
        />
      ))}

      <div className={styles.divider} aria-hidden="true" />

      {/* Widgets (poll / todo) — empty-compose only. */}
      {WIDGETS.map((b) => (
        <ToolbarIconButton
          key={b.id}
          button={b}
          previewOpen={previewOpen}
          composeEmpty={composeEmpty}
          disabled={disabled}
          onCommand={onCommand}
        />
      ))}

      <div className={styles.spacer} aria-hidden="true" />

      <Tooltip
        content={maximized ? "Свернуть compose" : "Развернуть compose"}
      >
        <IconButton
          icon="maximize"
          size="sm"
          variant="ghost"
          aria-label={maximized ? "Свернуть compose" : "Развернуть compose"}
          aria-pressed={maximized}
          disabled={disabled}
          onClick={onMaximizeToggle}
        />
      </Tooltip>

      <Tooltip content="Подсказка по форматированию">
        <IconButton
          icon="help-circle"
          size="sm"
          variant="ghost"
          aria-label="Подсказка по форматированию"
          disabled={disabled}
          onClick={() => onCommand("help")}
        />
      </Tooltip>
    </div>
  );
}
