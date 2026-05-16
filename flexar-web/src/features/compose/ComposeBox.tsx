// Flexar Hub Web — compose box (Phase 2.1/2.2/2.4, redesigned).
//
// Docked at the bottom of the centre column. Three structural rows:
//
//   1. Recipient row — channel pill + chevron + topic input (or DM
//      pill-list). Compact and inline; see `recipient/RecipientRow`.
//   2. Textarea / preview area. The toolbar's preview button toggles
//      between the live textarea and the rendered Markdown preview.
//   3. Toolbar + bottom row. Toolbar: formatting + insert commands
//      (link / bold / italic / lists / quote / code / math + upload /
//      emoji / schedule popovers + poll / todo widget insertion).
//      Bottom row: drafts shortcut + character limit indicator + Send
//      split-button (Send | ▾ schedule presets).
//
// Send path is unchanged from Phase 2.2 — optimistic echo into the
// messages-store + reconcile on success / revert on failure. Drafts
// autosave (Phase 2.4) and typing emitter (Phase 4.3) are preserved.
// Typeahead (`@` / `#` / `:`) is preserved.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Banner } from "../../components/Banner";
import { apiClient } from "../../api";
import { describeApiError } from "../../lib/errors";
import type { Narrow, UserId } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import { useDraftsStore } from "../../stores/draftsStore";
import { useMessagesStore } from "../../stores/messagesStore";
import { useRealmStore } from "../../stores/realmStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import { AutoGrowTextarea } from "./AutoGrowTextarea";
import {
  composeFromNarrow,
  type ComposeFromNarrow,
} from "./composeFromNarrow";
import { destinationFor, draftKeyFor } from "./draftKey";
import {
  buildOptimisticMessage,
  nextLocalId,
  type OptimisticDestination,
  type OptimisticSender,
} from "./optimisticMessage";
import { ComposePreview } from "./ComposePreview";
import { DraftsCount } from "./DraftsCount";
import { EmojiPickerButton } from "./EmojiPicker";
import { FormattingToolbar, type FormattingCommand } from "./FormattingToolbar";
import { LimitIndicator } from "./LimitIndicator";
import { SendMenu } from "./SendMenu";
import {
  insertCodeBlock,
  insertLink,
  insertNumberedList,
  prefixLines,
  wrapSelection,
  type SelectionRange,
} from "./markdownInsert";
import { RecipientRow } from "./recipient";
import {
  UploadButton,
  UploadChips,
  useUploadManager,
} from "./Upload";
import { useTypingEmitter } from "./useTypingEmitter";
import type { CreateScheduledMessageParams } from "../../api/types";
import {
  ChannelRowContent,
  EmojiRowContent,
  MentionRowContent,
  TypeaheadPanel,
  useTextareaTypeahead,
  type TextareaTypeaheadRow,
} from "./typeahead";
import styles from "./ComposeBox.module.css";

export interface ComposeBoxProps {
  /** The narrow whose conversation the compose box pre-fills from. */
  narrow: Narrow | undefined;
}

interface FormState {
  streamId: number | undefined;
  topic: string;
  recipientIds: UserId[];
  content: string;
}

const EMPTY_FORM: FormState = {
  streamId: undefined,
  topic: "",
  recipientIds: [],
  content: "",
};

/** Wait this long after the last keystroke before persisting the body. */
const AUTOSAVE_DEBOUNCE_MS = 500;

/** Default realm message length when the snapshot didn't carry one. */
const DEFAULT_MAX_MESSAGE_LENGTH = 10000;

export function ComposeBox({ narrow }: ComposeBoxProps): React.JSX.Element {
  const ownUserId = useAuthStore((store) => store.session?.userId);
  const session = useAuthStore((store) => store.session);
  const users = useUsersStore((store) => store.users);
  const getUser = useUsersStore((store) => store.getUser);
  const streams = useStreamsStore((store) => store.streams);
  const subscriptions = useStreamsStore((store) => store.subscriptions);
  const getStream = useStreamsStore((store) => store.getStream);
  const maxMessageLength = useRealmStore(
    (s) => s.realm?.max_message_length ?? DEFAULT_MAX_MESSAGE_LENGTH,
  );
  const insertOptimistic = useMessagesStore((s) => s.insertOptimistic);
  const reconcileOptimistic = useMessagesStore((s) => s.reconcileOptimistic);
  const removeOptimistic = useMessagesStore((s) => s.removeOptimistic);
  const saveDraftAction = useDraftsStore((s) => s.saveDraft);
  const deleteDraftAction = useDraftsStore((s) => s.deleteDraft);
  const getDraftAction = useDraftsStore((s) => s.getDraft);

  const fromNarrow = useMemo<ComposeFromNarrow>(
    () => composeFromNarrow(narrow, ownUserId),
    [narrow, ownUserId],
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [textareaNode, setTextareaNode] = useState<HTMLTextAreaElement | null>(
    null,
  );
  const pendingTextareaCursor = useRef<number | null>(null);
  const pendingSelectionRange = useRef<SelectionRange | null>(null);

  const setTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    setTextareaNode(node);
  }, []);

  const prefillKey = useMemo(() => prefillKeyOf(fromNarrow), [fromNarrow]);
  const lastPrefillKeyRef = useRef<string | null>(null);
  const draftKey = useMemo(() => draftKeyFor(fromNarrow), [fromNarrow]);
  const [showRestoredHint, setShowRestoredHint] = useState(false);

  // Re-apply prefill when the URL narrow changes. Body comes from the
  // saved draft for the destination (if any), otherwise blank.
  useEffect(() => {
    if (lastPrefillKeyRef.current === prefillKey) {
      return;
    }
    lastPrefillKeyRef.current = prefillKey;
    setErrorMessage(null);
    setPreviewOpen(false);
    const restored =
      draftKey !== null ? getDraftAction(draftKey) : undefined;
    setForm((current) => {
      const withRecipients = applyPrefill(current, fromNarrow);
      return { ...withRecipients, content: restored?.content ?? "" };
    });
    setShowRestoredHint(
      restored !== undefined && restored.content.trim() !== "",
    );
  }, [prefillKey, fromNarrow, draftKey, getDraftAction]);

  // Debounced autosave.
  useEffect(() => {
    if (draftKey === null) {
      return;
    }
    const destination = destinationFor(fromNarrow);
    if (destination === null) {
      return;
    }
    const trimmed = form.content.trim();
    const timer = window.setTimeout(() => {
      if (trimmed === "") {
        deleteDraftAction(draftKey);
        return;
      }
      saveDraftAction({
        key: draftKey,
        destination,
        content: form.content,
        updatedAt: Date.now(),
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    draftKey,
    fromNarrow,
    form.content,
    saveDraftAction,
    deleteDraftAction,
  ]);

  const formMode: "channel" | "direct" | "none" = fromNarrow.mode;
  const topicsTopic = form.topic.trim();
  const channelStreamId = form.streamId;

  const dmRecipientIds = useMemo(
    () => (formMode === "direct" ? form.recipientIds : []),
    [formMode, form.recipientIds],
  );

  const typing = useTypingEmitter({
    fromNarrow,
    channelStreamId,
    topic: topicsTopic,
    dmRecipientIds,
  });

  const buildScheduleParams = useCallback(
    (): CreateScheduledMessageParams | null => {
      const content = form.content.trim();
      if (content === "" || formMode === "none") {
        return null;
      }
      if (formMode === "channel") {
        if (channelStreamId === undefined || topicsTopic === "") {
          return null;
        }
        return {
          type: "channel",
          to: channelStreamId,
          topic: topicsTopic,
          content,
          scheduledDeliveryTimestamp: 0,
        };
      }
      if (form.recipientIds.length === 0) {
        return null;
      }
      return {
        type: "direct",
        to: form.recipientIds,
        content,
        scheduledDeliveryTimestamp: 0,
      };
    },
    [
      form.content,
      form.recipientIds,
      formMode,
      channelStreamId,
      topicsTopic,
    ],
  );

  // Textarea typeahead.
  const textareaTypeahead = useTextareaTypeahead({
    value: form.content,
    cursor,
    users,
    streams,
    subscriptions,
    onApply: useCallback((newValue: string, newCursor: number) => {
      pendingTextareaCursor.current = newCursor;
      setForm((current) => ({ ...current, content: newValue }));
      setCursor(newCursor);
    }, []),
  });

  // Commit pending cursor / selection range after a value update.
  useEffect(() => {
    if (textareaNode === null) {
      return;
    }
    if (pendingSelectionRange.current !== null) {
      const range = pendingSelectionRange.current;
      pendingSelectionRange.current = null;
      textareaNode.setSelectionRange(range.start, range.end);
      textareaNode.focus();
      setCursor(range.start);
      return;
    }
    if (pendingTextareaCursor.current !== null) {
      const target = pendingTextareaCursor.current;
      pendingTextareaCursor.current = null;
      textareaNode.setSelectionRange(target, target);
      textareaNode.focus();
    }
  }, [form.content, textareaNode]);

  const canSend =
    !sending &&
    form.content.trim() !== "" &&
    form.content.length <= maxMessageLength &&
    (formMode === "channel"
      ? channelStreamId !== undefined && topicsTopic !== ""
      : formMode === "direct" && form.recipientIds.length > 0);

  const onSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
      event?.preventDefault();
      if (sending) {
        return;
      }
      const content = form.content.trim();
      if (content === "" || formMode === "none" || session === null) {
        return;
      }

      const sender: OptimisticSender = {
        userId: session.userId ?? 0,
        email: session.email,
        fullName: getUser(session.userId ?? 0)?.full_name ?? session.email,
        realmStr: "",
        avatarUrl: getUser(session.userId ?? 0)?.avatar_url ?? null,
      };

      let destination: OptimisticDestination;
      let sendCall: () => Promise<{ id: number }>;

      if (formMode === "channel") {
        if (channelStreamId === undefined) {
          setErrorMessage("Выберите канал для отправки.");
          return;
        }
        if (topicsTopic === "") {
          setErrorMessage("В этом канале нужна тема.");
          return;
        }
        const streamName = getStream(channelStreamId)?.name;
        destination = {
          type: "channel",
          streamId: channelStreamId,
          streamName,
          topic: topicsTopic,
        };
        sendCall = () =>
          apiClient.sendMessage({
            type: "channel",
            to: channelStreamId,
            topic: topicsTopic,
            content,
          });
      } else {
        if (form.recipientIds.length === 0) {
          setErrorMessage("Добавьте хотя бы одного получателя.");
          return;
        }
        destination = {
          type: "direct",
          recipientIds: form.recipientIds,
          lookupUser: getUser,
        };
        sendCall = () =>
          apiClient.sendMessage({
            type: "direct",
            to: form.recipientIds,
            content,
          });
      }

      const localId = nextLocalId();
      const optimistic = buildOptimisticMessage({
        localId,
        content,
        sender,
        destination,
      });

      setSending(true);
      setErrorMessage(null);
      insertOptimistic(optimistic);

      try {
        const result = await sendCall();
        reconcileOptimistic(localId, { ...optimistic, id: result.id });
        if (draftKey !== null) {
          deleteDraftAction(draftKey);
        }
        setForm((current) => ({ ...current, content: "" }));
        setShowRestoredHint(false);
        typing.sendStop();
        textareaNode?.focus();
      } catch (cause) {
        removeOptimistic(localId);
        setErrorMessage(
          describeApiError(cause, "Не удалось отправить. Попробуйте ещё раз."),
        );
      } finally {
        setSending(false);
      }
    },
    [
      form.content,
      form.recipientIds,
      formMode,
      sending,
      session,
      getUser,
      getStream,
      channelStreamId,
      topicsTopic,
      insertOptimistic,
      reconcileOptimistic,
      removeOptimistic,
      textareaNode,
      draftKey,
      deleteDraftAction,
      typing,
    ],
  );

  const handleScheduled = useCallback((): void => {
    if (draftKey !== null) {
      deleteDraftAction(draftKey);
    }
    setForm((current) => ({ ...current, content: "" }));
    setShowRestoredHint(false);
    setErrorMessage(null);
    typing.sendStop();
    textareaNode?.focus();
  }, [draftKey, deleteDraftAction, textareaNode, typing]);

  // Splice text at the caret (for emoji picker and upload-manager).
  const insertAtCursor = useCallback(
    (text: string): void => {
      const textarea = textareaNode;
      const start = textarea?.selectionStart ?? form.content.length;
      const end = textarea?.selectionEnd ?? form.content.length;
      const next =
        form.content.slice(0, start) + text + form.content.slice(end);
      const nextCursor = start + text.length;
      pendingTextareaCursor.current = nextCursor;
      setForm((current) => ({ ...current, content: next }));
      setCursor(nextCursor);
      if (showRestoredHint) {
        setShowRestoredHint(false);
      }
    },
    [form.content, textareaNode, showRestoredHint],
  );

  // Apply a markdown-insert helper to the current textarea state.
  const applyMarkdown = useCallback(
    (
      transform: (
        value: string,
        selection: SelectionRange,
      ) => { value: string; selection: SelectionRange },
    ): void => {
      const start =
        textareaNode?.selectionStart ?? form.content.length;
      const end = textareaNode?.selectionEnd ?? form.content.length;
      const result = transform(form.content, { start, end });
      pendingSelectionRange.current = result.selection;
      setForm((current) => ({ ...current, content: result.value }));
      if (showRestoredHint) {
        setShowRestoredHint(false);
      }
    },
    [form.content, textareaNode, showRestoredHint],
  );

  const uploadManager = useUploadManager({ onInsert: insertAtCursor });
  const enqueueFiles = useCallback(
    (files: readonly File[]): void => {
      for (const file of files) {
        uploadManager.enqueue(file);
      }
    },
    [uploadManager],
  );

  const onTextareaPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
      const files = Array.from(event.clipboardData.files);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      enqueueFiles(files);
    },
    [enqueueFiles],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLFormElement>): void => {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
      }
    },
    [],
  );
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLFormElement>): void => {
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      enqueueFiles(files);
    },
    [enqueueFiles],
  );

  const onTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (textareaTypeahead.handleKeyDown(event)) {
        return;
      }
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      if (event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      void onSubmit();
    },
    [onSubmit, textareaTypeahead],
  );

  // Toolbar command dispatch. Pure callbacks hand off to the right
  // markdown helper (or to the slash-command insertion for widgets).
  const runCommand = useCallback(
    (command: FormattingCommand) => {
      switch (command) {
        case "preview-toggle":
          setPreviewOpen((current) => !current);
          return;
        case "bold":
          applyMarkdown((v, s) => wrapSelection(v, s, "**"));
          return;
        case "italic":
          applyMarkdown((v, s) => wrapSelection(v, s, "*"));
          return;
        case "strikethrough":
          applyMarkdown((v, s) => wrapSelection(v, s, "~~"));
          return;
        case "link":
          applyMarkdown((v, s) => insertLink(v, s));
          return;
        case "quote":
          applyMarkdown((v, s) => prefixLines(v, s, "> "));
          return;
        case "ordered-list":
          applyMarkdown((v, s) => insertNumberedList(v, s));
          return;
        case "unordered-list":
          applyMarkdown((v, s) => prefixLines(v, s, "- "));
          return;
        case "spoiler":
          applyMarkdown((v, s) =>
            wrapSelection(v, s, "```spoiler Заголовок\n", "\n```"),
          );
          return;
        case "code-block":
          applyMarkdown((v, s) => insertCodeBlock(v, s));
          return;
        case "math":
          applyMarkdown((v, s) => wrapSelection(v, s, "$$"));
          return;
        case "poll":
          insertAtCursor("/poll Вопрос\nВариант 1\nВариант 2");
          return;
        case "todo":
          insertAtCursor("/todo Заголовок\nЗадача 1\nЗадача 2");
          return;
        case "help":
          window.open("/help/format-your-message-using-markdown", "_blank");
          return;
        case "upload":
        case "emoji":
          // Handled by the slot components themselves (popovers).
          return;
      }
    },
    [applyMarkdown, insertAtCursor],
  );

  // Contextual placeholder: tells the user where the message goes.
  const placeholder = useMemo<string>(() => {
    if (formMode === "channel") {
      if (channelStreamId === undefined) {
        return "Выберите канал…";
      }
      const channelName = getStream(channelStreamId)?.name ?? "канал";
      if (topicsTopic === "") {
        return `Написать в # ${channelName}`;
      }
      return `Написать в # ${channelName} › ${topicsTopic}`;
    }
    if (formMode === "direct") {
      if (form.recipientIds.length === 0) {
        return "Выберите получателей…";
      }
      if (form.recipientIds.length === 1) {
        const id = form.recipientIds[0];
        const name = getUser(id)?.full_name ?? `User ${id}`;
        return `Написать ${name}`;
      }
      return "Написать в группу";
    }
    return "Выберите канал или беседу…";
  }, [
    formMode,
    channelStreamId,
    topicsTopic,
    form.recipientIds,
    getStream,
    getUser,
  ]);

  return (
    <form
      className={styles.compose}
      onSubmit={onSubmit}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label="Отправить сообщение"
    >
      {errorMessage !== null && (
        <div className={styles.bannerRow}>
          <Banner tone="danger" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Banner>
        </div>
      )}

      {formMode !== "none" && (
        <RecipientRow
          {...(formMode === "channel"
            ? {
                mode: "channel" as const,
                streamId: channelStreamId,
                onChannelChange: (newStreamId) =>
                  setForm((current) => ({
                    ...current,
                    streamId: newStreamId,
                  })),
                topic: form.topic,
                onTopicChange: (newTopic) =>
                  setForm((current) => ({ ...current, topic: newTopic })),
                disabled: sending,
              }
            : {
                mode: "direct" as const,
                recipientIds: form.recipientIds,
                onRecipientsChange: (next) =>
                  setForm((current) => ({ ...current, recipientIds: next })),
                disabled: sending,
              })}
        />
      )}

      {showRestoredHint && (
        <p className={styles.restoredHint} aria-live="polite">
          Восстановлено из черновика
        </p>
      )}

      <div className={styles.editorWrap}>
        {previewOpen ? (
          <div className={styles.previewBox}>
            <ComposePreview content={form.content} />
          </div>
        ) : (
          <>
            <AutoGrowTextarea
              id="compose-content"
              ref={setTextareaRef}
              value={form.content}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  content: event.target.value,
                }));
                setCursor(event.target.selectionStart ?? event.target.value.length);
                if (showRestoredHint) {
                  setShowRestoredHint(false);
                }
                typing.onActivity();
              }}
              onKeyDown={onTextareaKeyDown}
              onSelect={(event) =>
                setCursor(
                  (event.target as HTMLTextAreaElement).selectionStart ?? 0,
                )
              }
              onClick={(event) =>
                setCursor(
                  (event.target as HTMLTextAreaElement).selectionStart ?? 0,
                )
              }
              onBlur={textareaTypeahead.close}
              onPaste={onTextareaPaste}
              placeholder={placeholder}
              disabled={sending || formMode === "none"}
              aria-label="Сообщение"
              aria-autocomplete="list"
              aria-controls={
                textareaTypeahead.state.open
                  ? textareaTypeahead.state.panelId
                  : undefined
              }
              aria-activedescendant={
                textareaTypeahead.state.activeId ?? undefined
              }
              aria-expanded={textareaTypeahead.state.open}
            />
            <TypeaheadPanel
              panelId={textareaTypeahead.state.panelId}
              anchor={textareaNode}
              open={textareaTypeahead.state.open}
              rows={textareaTypeahead.state.rows.map((row) => ({
                id: row.id,
                label: row.label,
                render: () => renderTextareaRow(row),
              }))}
              activeId={textareaTypeahead.state.activeId}
              onSelect={textareaTypeahead.onSelect}
              onHover={textareaTypeahead.onHover}
              ariaLabel={ariaLabelFor(textareaTypeahead.state.kind)}
            />
          </>
        )}
      </div>

      <UploadChips
        uploads={uploadManager.uploads}
        onCancel={uploadManager.cancel}
        onDismiss={uploadManager.dismiss}
      />

      <FormattingToolbar
        previewOpen={previewOpen}
        composeEmpty={form.content.trim() === ""}
        disabled={sending}
        onCommand={runCommand}
        slots={{
          upload: (
            <UploadButton
              onFilesChosen={enqueueFiles}
              disabled={sending || previewOpen}
            />
          ),
          emoji: (
            <EmojiPickerButton
              onPick={insertAtCursor}
              disabled={sending || previewOpen}
            />
          ),
        }}
      />

      <div className={styles.bottomRow}>
        <DraftsCount />
        <span className={styles.spacer} />
        <LimitIndicator
          count={form.content.length}
          limit={maxMessageLength}
        />
        <SendMenu
          canSend={canSend}
          sending={sending}
          onSend={() => void onSubmit()}
          buildScheduleParams={buildScheduleParams}
          onScheduled={handleScheduled}
          onError={setErrorMessage}
        />
      </div>
    </form>
  );
}

function renderTextareaRow(row: TextareaTypeaheadRow): React.ReactNode {
  if ("user" in row) {
    return <MentionRowContent row={row} />;
  }
  if ("entry" in row) {
    return <EmojiRowContent row={row} />;
  }
  return <ChannelRowContent row={row} />;
}

function ariaLabelFor(kind: "mention" | "channel" | "emoji" | null): string {
  switch (kind) {
    case "mention":
      return "Подсказки упоминаний";
    case "channel":
      return "Подсказки каналов";
    case "emoji":
      return "Подсказки эмодзи";
    case null:
      return "Подсказки";
  }
}

function prefillKeyOf(prefill: ComposeFromNarrow): string {
  switch (prefill.mode) {
    case "none":
      return "none";
    case "channel":
      return `channel:${prefill.streamId ?? ""}:${prefill.topic}`;
    case "direct":
      return `direct:${[...prefill.recipientIds].sort((a, b) => a - b).join(",")}`;
  }
}

function applyPrefill(
  current: FormState,
  prefill: ComposeFromNarrow,
): FormState {
  if (prefill.mode === "channel") {
    return {
      ...current,
      streamId: prefill.streamId,
      topic: prefill.topic,
      recipientIds: [],
    };
  }
  if (prefill.mode === "direct") {
    return {
      ...current,
      streamId: undefined,
      topic: "",
      recipientIds: [...prefill.recipientIds],
    };
  }
  return EMPTY_FORM;
}

