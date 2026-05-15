// Flexar Hub Web — inline message edit form (Phase 3.3).
//
// Mounted inside `MessageRow` in place of `MessageContent` while the
// row is in edit mode. Pre-fills with the message's raw Markdown
// source (fetched lazily via `apiClient.getRawContent` on entry — the
// cache holds rendered HTML, but we want users to edit what they
// originally wrote).
//
// Save (button or Ctrl/Cmd+Enter) writes optimistically through
// `applyOptimisticEdit`, then calls `apiClient.editMessage`. The
// realtime `update_message` event lands shortly after with the
// server-rendered HTML and reconciles the cache. On REST failure the
// original `Message` snapshot is restored via `restoreMessage` and the
// inline error line surfaces the error.
//
// Cancel (button or `Escape`) discards the draft and closes the form
// without touching the cache.
//
// Shortcuts intentionally mirror compose:
//   - `Enter`        — newline (default textarea behaviour)
//   - `Ctrl/Cmd+Enter` — Save
//   - `Escape`        — Cancel

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, isApiError } from "../../api";
import { Button } from "../../components/Button";
import type { Message } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import { EditAutoGrowTextarea } from "./EditAutoGrowTextarea";
import styles from "./EditMessageForm.module.css";

export interface EditMessageFormProps {
  /** The message being edited. */
  message: Message;
  /** Called when the form is dismissed (cancel, save, or background close). */
  onClose: () => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "loadError"; message: string };

function describeError(error: unknown): string {
  if (isApiError(error)) {
    return error.body?.msg ?? error.message;
  }
  return error instanceof Error ? error.message : "Could not edit message.";
}

export function EditMessageForm({
  message,
  onClose,
}: EditMessageFormProps): React.JSX.Element {
  const applyOptimisticEdit = useMessagesStore((s) => s.applyOptimisticEdit);
  const restoreMessage = useMessagesStore((s) => s.restoreMessage);

  const [content, setContent] = useState<string>("");
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether the form is still mounted across the async fetch /
  // save so we don't call setState after a fast cancel.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Fetch the raw Markdown source on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await apiClient.getRawContent(message.id);
        if (cancelled) {
          return;
        }
        setContent(raw);
        setLoadState({ kind: "ready" });
        // Move focus to the textarea now that it has its initial value.
        // requestAnimationFrame so the textarea has had a paint to size.
        requestAnimationFrame(() => {
          const node = textareaRef.current;
          if (node !== null) {
            node.focus();
            // Place caret at the end so the user can start appending
            // immediately if they want to.
            const end = node.value.length;
            node.setSelectionRange(end, end);
          }
        });
      } catch (cause) {
        if (cancelled) {
          return;
        }
        setLoadState({ kind: "loadError", message: describeError(cause) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message.id]);

  const handleSave = useCallback(async () => {
    if (loadState.kind !== "ready" || isSaving) {
      return;
    }
    const trimmed = content.trim();
    // No empty saves — Zulip rejects them; treat the empty case as a
    // no-op rather than firing a request that will error out.
    if (trimmed === "") {
      setSaveError("Message content can't be empty.");
      return;
    }
    // No-op save: nothing changed → just close, no REST call.
    if (trimmed === message.content.trim()) {
      onClose();
      return;
    }

    const snapshot = message;
    setIsSaving(true);
    setSaveError(null);
    applyOptimisticEdit({ message_id: message.id, content: trimmed });
    try {
      await apiClient.editMessage(message.id, { content: trimmed });
      if (!aliveRef.current) {
        return;
      }
      // Success: close the form. The realtime `update_message` event
      // will arrive with server-rendered HTML and reconcile the cache.
      onClose();
    } catch (cause) {
      // Revert: re-insert the original message verbatim.
      restoreMessage(snapshot);
      if (!aliveRef.current) {
        return;
      }
      setSaveError(describeError(cause));
      setIsSaving(false);
    }
  }, [
    applyOptimisticEdit,
    content,
    isSaving,
    loadState.kind,
    message,
    onClose,
    restoreMessage,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void handleSave();
      }
    },
    [handleSave, onClose],
  );

  return (
    <div className={styles.form}>
      {loadState.kind === "loading" && (
        <p className={styles.status} role="status">
          Loading edit content…
        </p>
      )}
      {loadState.kind === "loadError" && (
        <p className={styles.error} role="alert">
          {loadState.message}
        </p>
      )}
      {loadState.kind === "ready" && (
        <>
          <label className={styles.label} htmlFor={`edit-${message.id}`}>
            Edit message
          </label>
          <EditAutoGrowTextarea
            ref={textareaRef}
            id={`edit-${message.id}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            invalid={saveError !== null}
          />
          {saveError !== null && (
            <p className={styles.error} role="alert">
              {saveError}
            </p>
          )}
          <div className={styles.controls}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void handleSave();
              }}
              loading={isSaving}
            >
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
