// User-status editor (Phase 4.4).
//
// Popover content for editing the signed-in user's status: a 60-char
// text input, an emoji picker (the same `ComposeEmojiPicker`), Save
// and Clear actions. Lives in the navbar; the trigger is the
// account email pill.
//
// Pure UI for the form; the API call goes through `apiClient.
// updateOwnUserStatus`. The realtime `user_status` event echoes the
// change back through `useUserStatusesStore` so other UI surfaces
// (right sidebar, etc.) update without imperative wiring.

import { useEffect, useState } from "react";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/Input";
import { Popover } from "../../components/Popover";
import { ComposeEmojiPicker } from "../compose/EmojiPicker/ComposeEmojiPicker";
import { apiClient } from "../../api";
import type { UpdateOwnUserStatusParams } from "../../api";
import type { UserStatus } from "../../domain";
import { describeApiError } from "../../lib/errors";
import {
  emojiCodeFromGlyph,
  glyphFromUnicodeEmojiCode,
} from "../../lib/emoji/identity";
import { EMOJI_CORPUS } from "../../lib/emoji/corpus";
import styles from "./StatusEditor.module.css";

/** Server-side limit per the OpenAPI spec. */
const MAX_STATUS_TEXT = 60;

export interface StatusEditorProps {
  /** Current status; `undefined` when the user has none set. */
  current: UserStatus | undefined;
  /** Called once the popover should close. */
  onClose: () => void;
}

interface EmojiChoice {
  /** `:shortcode:` minus colons — the wire field. */
  emojiName: string;
  emojiCode: string;
  reactionType: "unicode_emoji";
  /** Glyph for the inline preview. */
  glyph: string;
}

export function StatusEditor({
  current,
  onClose,
}: StatusEditorProps): React.JSX.Element {
  const [text, setText] = useState(current?.status_text ?? "");
  const [emoji, setEmoji] = useState<EmojiChoice | null>(
    initialEmojiChoice(current),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form when the current status changes underneath us
  // (e.g. another session of the same user updated it).
  useEffect(() => {
    setText(current?.status_text ?? "");
    setEmoji(initialEmojiChoice(current));
  }, [current]);

  const handlePickEmoji = (shortcodeMarkdown: string): void => {
    // The picker emits `:shortcode:` so consumers can splice it into
    // a textarea. For the status form we want the pure shortcode.
    const name = shortcodeMarkdown.replace(/^:|:$/g, "");
    const entry = EMOJI_CORPUS.find((e) => e.shortcode === name);
    if (entry === undefined) {
      // Fall back to just the name; the realm-emoji branch of the
      // picker is not modelled here yet.
      setEmoji({
        emojiName: name,
        emojiCode: "",
        reactionType: "unicode_emoji",
        glyph: "",
      });
    } else {
      setEmoji({
        emojiName: entry.shortcode,
        emojiCode: emojiCodeFromGlyph(entry.glyph),
        reactionType: "unicode_emoji",
        glyph: entry.glyph,
      });
    }
    setPickerOpen(false);
  };

  const handleSave = async (): Promise<void> => {
    if (text.length > MAX_STATUS_TEXT) {
      setError(`Статус не должен превышать ${MAX_STATUS_TEXT} символов.`);
      return;
    }
    const params: UpdateOwnUserStatusParams = {
      statusText: text,
      emojiName: emoji?.emojiName ?? "",
      emojiCode: emoji?.emojiCode ?? "",
      reactionType: emoji === null ? "" : emoji.reactionType,
    };
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateOwnUserStatus(params);
      setBusy(false);
      onClose();
    } catch (cause) {
      setBusy(false);
      setError(describeApiError(cause, "Не удалось обновить статус."));
    }
  };

  const handleClearAll = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.updateOwnUserStatus({
        statusText: "",
        emojiName: "",
        emojiCode: "",
        reactionType: "",
      });
      setBusy(false);
      onClose();
    } catch (cause) {
      setBusy(false);
      setError(describeApiError(cause, "Не удалось обновить статус."));
    }
  };

  const remaining = MAX_STATUS_TEXT - text.length;

  return (
    <div className={styles.editor}>
      <p className={styles.heading}>Ваш статус</p>
      <div className={styles.row}>
        <Popover
          trigger={
            <button
              type="button"
              className={styles.slot}
              aria-label={
                emoji === null
                  ? "Выбрать эмодзи статуса"
                  : `Изменить эмодзи статуса (сейчас :${emoji.emojiName}:)`
              }
              disabled={busy}
            >
              {emoji === null ? (
                <Icon name="smile" size="md" aria-hidden />
              ) : (
                <span className={styles.slotGlyph} aria-hidden>
                  {emoji.glyph || `:${emoji.emojiName}:`}
                </span>
              )}
            </button>
          }
          placement="bottom"
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          aria-label="Эмодзи статуса"
        >
          <ComposeEmojiPicker onPick={handlePickEmoji} />
        </Popover>
        <Input
          aria-label="Текст статуса"
          value={text}
          maxLength={MAX_STATUS_TEXT}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder="Чем занят?"
          disabled={busy}
          className={styles.textInput}
        />
      </div>
      <p
        className={styles.charCount}
        data-overflow={remaining < 0 || undefined}
      >
        {remaining} симв.
      </p>
      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      <div className={styles.actions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleClearAll()}
          disabled={busy}
        >
          Очистить
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleSave()}
          loading={busy}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function initialEmojiChoice(
  status: UserStatus | undefined,
): EmojiChoice | null {
  if (
    status === undefined ||
    status.emoji_name === undefined ||
    status.emoji_name === ""
  ) {
    return null;
  }
  const code = status.emoji_code ?? "";
  const glyph =
    status.reaction_type === "unicode_emoji"
      ? glyphFromUnicodeEmojiCode(code) ?? ""
      : "";
  return {
    emojiName: status.emoji_name,
    emojiCode: code,
    reactionType:
      (status.reaction_type as "unicode_emoji") ?? "unicode_emoji",
    glyph,
  };
}

