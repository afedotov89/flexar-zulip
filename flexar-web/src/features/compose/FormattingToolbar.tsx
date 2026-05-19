// Compose formatting toolbar — lives inside the editor frame.
//
// Layout (Telegram/Slack-style, left → right):
//
//   [📎 attach] [😊 emoji] | [B] [I] [🔗 link] | [⋮ more]   spacer
//   [👁 preview] [⤢ maximize]   [LimitIndicator] [Send ▾]
//
// "More" hides the long-tail formatting commands (strike, lists,
// quote, spoiler, code, math, poll, todo) behind a single popover so
// the always-visible row stays scannable. The KeyboardHelpOverlay
// (`?` shortcut) is the discoverability path for the markdown help
// that used to sit in this toolbar.
//
// Send and the character-count indicator are slots — the parent owns
// their state. Putting them inside the toolbar means the writer's
// eye doesn't have to leave the input frame to find Send.

import { useState, type ReactElement, type ReactNode } from "react";
import { IconButton } from "../../components/IconButton";
import { Popover } from "../../components/Popover";
import { Icon } from "../../components/Icon";
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
   *  own popovers, the toolbar just gives them a row position. The
   *  upload slot is optional: the edit-message form reuses this
   *  toolbar but doesn't expose attachment uploads. */
  slots: {
    upload?: ReactElement;
    emoji: ReactElement;
  };
  /** Right-aligned cluster: character-limit indicator + Send (compose)
   *  or Cancel + Save (edit). */
  trailing: ReactNode;
}

interface PrimaryButton {
  id: FormattingCommand;
  icon: IconName;
  label: string;
}

interface SecondaryItem {
  id: FormattingCommand;
  icon: IconName;
  label: string;
  /** When `true`, the item is only enabled on an empty compose. */
  emptyOnly?: boolean;
}

const PRIMARY: PrimaryButton[] = [
  { id: "bold", icon: "bold", label: "Жирный" },
  { id: "italic", icon: "italic", label: "Курсив" },
  { id: "link", icon: "link", label: "Ссылка" },
];

const SECONDARY: SecondaryItem[] = [
  { id: "strikethrough", icon: "strikethrough", label: "Зачёркнутый" },
  { id: "ordered-list", icon: "ordered-list", label: "Нумерованный список" },
  { id: "unordered-list", icon: "unordered-list", label: "Маркированный список" },
  { id: "quote", icon: "quote", label: "Цитата" },
  { id: "spoiler", icon: "eye-off", label: "Спойлер" },
  { id: "code-block", icon: "code-block", label: "Блок кода" },
  { id: "math", icon: "math", label: "Математика (LaTeX)" },
  { id: "poll", icon: "poll", label: "Опрос", emptyOnly: true },
  { id: "todo", icon: "todo", label: "Список задач", emptyOnly: true },
];

export function FormattingToolbar({
  previewOpen,
  composeEmpty,
  disabled = false,
  maximized,
  onMaximizeToggle,
  onCommand,
  slots,
  trailing,
}: FormattingToolbarProps): React.JSX.Element {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Форматирование сообщения"
    >
      {/* Insert section — first because they are the most-frequent
          actions (attach / emoji are picked many times per session,
          formatting is intermittent). */}
      {slots.emoji}
      {slots.upload ?? null}

      <div className={styles.divider} aria-hidden="true" />

      {/* Inline formatting — the basics everyone uses. */}
      {PRIMARY.map((b) => (
        <Tooltip key={b.id} content={b.label}>
          <IconButton
            icon={b.icon}
            size="sm"
            variant="ghost"
            aria-label={b.label}
            disabled={disabled || previewOpen}
            onClick={() => onCommand(b.id)}
          />
        </Tooltip>
      ))}

      <div className={styles.divider} aria-hidden="true" />

      {/* Long-tail formatting — strike, lists, quote, spoiler, code,
          math, poll, todo. Behind one popover so the always-visible
          row stays short. */}
      <MoreMenu
        composeEmpty={composeEmpty}
        previewOpen={previewOpen}
        disabled={disabled}
        onCommand={onCommand}
      />

      <span className={styles.spacer} aria-hidden="true" />

      {/* View toggles — preview & maximize. Preview gets the
          characteristic eye/pen pair and stays enabled while in
          preview (it's the way out). */}
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

      <div className={styles.divider} aria-hidden="true" />

      {/* Send + character-limit cluster — provided by the parent so
          the toolbar doesn't need to know about send state. */}
      {trailing}
    </div>
  );
}

function MoreMenu({
  composeEmpty,
  previewOpen,
  disabled,
  onCommand,
}: {
  composeEmpty: boolean;
  previewOpen: boolean;
  disabled: boolean;
  onCommand: (command: FormattingCommand) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="top"
      aria-label="Дополнительное форматирование"
      trigger={
        // Popover clones its trigger to attach ref + click + aria —
        // wrapping the IconButton in Tooltip swallows those props at
        // the Tooltip layer, and the popover never opens. The
        // aria-label is descriptive enough; the tooltip is a polish
        // add-on we can wire back via Popover's own future tooltip
        // slot if it becomes needed.
        <IconButton
          icon="dots-vertical"
          size="sm"
          variant="ghost"
          aria-label="Ещё форматирование"
          title="Ещё форматирование"
          disabled={disabled || previewOpen}
        />
      }
    >
      <div className={styles.moreMenu} role="menu">
        {SECONDARY.map((item) => {
          const itemDisabled =
            disabled ||
            previewOpen ||
            (item.emptyOnly === true && !composeEmpty);
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.moreItem}
              disabled={itemDisabled}
              onClick={() => {
                onCommand(item.id);
                setOpen(false);
              }}
            >
              <Icon name={item.icon} size="sm" aria-hidden />
              <span className={styles.moreItemLabel}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
