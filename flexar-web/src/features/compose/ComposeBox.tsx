// Flexar Hub Web — compose box (Phase 2.1 + 2.2 + 2.4).
//
// Mounted at the bottom of the centre column under `MessageFeed`. The
// compose mode (channel vs DM) and the recipient/topic are derived
// from the URL narrow via `composeFromNarrow`; the user can edit the
// pre-filled fields. When the URL does not address a single
// conversation (empty narrow, search, built-in views) the compose box
// renders a "choose a conversation" hint in place of the form.
//
// Send path (Phase 2.2):
//
//   1. Build an optimistic-echo `Message` under a negative *local* id
//      and write it into `messagesStore.insertOptimistic`. The feed
//      window's live-event reconciler picks it up and the row appears
//      immediately.
//   2. Call `apiClient.sendMessage(...)`.
//        - on success → `messagesStore.reconcileOptimistic(localId,
//          realMessage)`. The optimistic entry is dropped; the real
//          message is installed under its server-assigned id (unless
//          the live `message` event already installed it, in which
//          case the cache entry from the event is preserved — see
//          `reconcileOptimisticMessage`'s tests).
//        - on failure → `messagesStore.removeOptimistic(localId)`,
//          show a `Banner` with the error, leave the draft text in
//          the textarea so the user can retry.
//
// Preview pane: a `Tabs`-style toggle between "Write" and "Preview".
// Preview asks the server to render the Markdown
// (`apiClient.renderMarkdown`) and feeds the sanitised HTML through
// `MessageContent` — the same XSS boundary as fetched messages.
//
// Drafts (Phase 2.4):
//
//   - The compose body is autosaved (debounced ~500 ms) into
//     `useDraftsStore` under a stable per-conversation key derived
//     from the URL pre-fill (`draftKeyFor`). One draft per
//     conversation destination.
//   - When the body becomes empty, the draft is deleted (no zombie
//     empty drafts cluttering the Drafts page).
//   - On a successful send, the draft is deleted.
//   - When the user navigates back to a conversation that has a saved
//     draft, the body is restored from the draft on mount/narrow
//     change. The narrow's recipient/topic remain the source of truth.

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
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiClient, isApiError } from "../../api";
import type { Narrow, StreamId, User, UserId } from "../../domain";
import { useAuthStore } from "../../stores/authStore";
import { useDraftsStore } from "../../stores/draftsStore";
import { useMessagesStore } from "../../stores/messagesStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useTopicsStore } from "../../stores/topicsStore";
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
import {
  ChannelRowContent,
  EmojiRowContent,
  MentionRowContent,
  TopicRowContent,
  TypeaheadPanel,
  useTextareaTypeahead,
  useTopicTypeahead,
  type TextareaTypeaheadRow,
} from "./typeahead";
import styles from "./ComposeBox.module.css";

export interface ComposeBoxProps {
  /** The narrow whose conversation the compose box pre-fills from. */
  narrow: Narrow | undefined;
}

type ComposeMode = "write" | "preview";

interface FormState {
  channelInput: string;
  topic: string;
  /** Comma-separated list of recipients (DM mode). Phase 2.3 = typeahead. */
  recipientsInput: string;
  content: string;
}

const EMPTY_FORM: FormState = {
  channelInput: "",
  topic: "",
  recipientsInput: "",
  content: "",
};

/**
 * Wait this long after the last keystroke before persisting the body
 * (Phase 2.4). 500 ms is the same range as compose-typeahead debounces
 * and is short enough that a reload right after typing keeps the body.
 */
const AUTOSAVE_DEBOUNCE_MS = 500;

function describeError(error: unknown): string {
  if (isApiError(error)) {
    return error.body?.msg ?? error.message;
  }
  return error instanceof Error
    ? error.message
    : "Failed to send. Please try again.";
}

// Format the participant list for the DM recipients input. Uses
// full names when known, ids otherwise — typeahead (2.3) replaces
// this with a richer chip-based selector.
function formatRecipients(
  ids: readonly UserId[],
  lookup: (id: UserId) => User | undefined,
): string {
  return ids
    .map((id) => {
      const user = lookup(id);
      return user?.full_name ?? `User ${id}`;
    })
    .join(", ");
}

// Parse a comma-separated recipient input back into user ids. Tries an
// exact `full_name` match against the directory; falls back to an
// `email` match. Returns the ids in input order, dropping unmatched
// tokens — the caller guards against the empty result.
function parseRecipients(
  input: string,
  users: Record<UserId, User>,
): UserId[] {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
  const ids: UserId[] = [];
  const matched = new Set<UserId>();
  for (const token of tokens) {
    let foundId: UserId | undefined;
    // Numeric token → take it as a user id directly.
    const asNumber = Number(token);
    if (Number.isInteger(asNumber) && users[asNumber] !== undefined) {
      foundId = asNumber;
    } else {
      for (const user of Object.values(users)) {
        if (user.full_name === token || user.email === token) {
          foundId = user.user_id;
          break;
        }
      }
    }
    if (foundId !== undefined && !matched.has(foundId)) {
      matched.add(foundId);
      ids.push(foundId);
    }
  }
  return ids;
}

// Resolve a channel-input string to a stream id. Numeric input → take
// it as the id; otherwise look up by exact name in `streamsStore`.
function resolveChannel(
  input: string,
  streams: Record<StreamId, { stream_id: StreamId; name: string }>,
): StreamId | undefined {
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && streams[asNumber] !== undefined) {
    return asNumber;
  }
  for (const stream of Object.values(streams)) {
    if (stream.name === trimmed) {
      return stream.stream_id;
    }
  }
  return undefined;
}

export function ComposeBox({ narrow }: ComposeBoxProps): React.JSX.Element {
  const ownUserId = useAuthStore((store) => store.session?.userId);
  const session = useAuthStore((store) => store.session);
  const users = useUsersStore((store) => store.users);
  const getUser = useUsersStore((store) => store.getUser);
  const streams = useStreamsStore((store) => store.streams);
  const subscriptions = useStreamsStore((store) => store.subscriptions);
  const getStream = useStreamsStore((store) => store.getStream);
  const topicsByChannel = useTopicsStore((s) => s.topicsByChannel);
  const loadTopics = useTopicsStore((s) => s.loadTopics);
  const insertOptimistic = useMessagesStore((s) => s.insertOptimistic);
  const reconcileOptimistic = useMessagesStore((s) => s.reconcileOptimistic);
  const removeOptimistic = useMessagesStore((s) => s.removeOptimistic);
  // Drafts (Phase 2.4). The actions are stable identities (zustand
  // returns the same function reference across selector calls), so the
  // autosave effect can depend on them without re-firing.
  const saveDraftAction = useDraftsStore((s) => s.saveDraft);
  const deleteDraftAction = useDraftsStore((s) => s.deleteDraft);
  const getDraftAction = useDraftsStore((s) => s.getDraft);

  // Derive the pre-fill any time the narrow or the auth identity
  // changes. The user can override it in the form state below.
  const fromNarrow = useMemo<ComposeFromNarrow>(
    () => composeFromNarrow(narrow, ownUserId),
    [narrow, ownUserId],
  );

  const [mode, setMode] = useState<ComposeMode>("write");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The textarea's `selectionStart` at the moment it last changed —
  // drives the typeahead trigger detection. The dance with both a ref
  // and React state is intentional: the *node* refs (set lazily via
  // callback refs) are what `TypeaheadPanel` needs as anchors, while
  // the cursor is plain state that re-runs the typeahead memos.
  const [cursor, setCursor] = useState(0);
  const [textareaNode, setTextareaNode] = useState<HTMLTextAreaElement | null>(
    null,
  );
  const [topicNode, setTopicNode] = useState<HTMLInputElement | null>(null);
  // Pending selection update — set by typeahead `onApply`, applied to
  // the textarea/input once the new value has been rendered.
  const pendingTextareaCursor = useRef<number | null>(null);
  const pendingTopicCursor = useRef<number | null>(null);

  const setTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    setTextareaNode(node);
  }, []);
  const setTopicRef = useCallback((node: HTMLInputElement | null) => {
    setTopicNode(node);
  }, []);

  // A stable identity for the current narrow's pre-fill, used to reset
  // the form fields when the user navigates between conversations.
  // We deliberately key on the *derived* shape (channel id + topic, or
  // sorted recipient ids) rather than the narrow reference so going
  // from `/narrow/channel/7` to `/narrow/channel/7/topic/x` only
  // changes the topic — the body is then restored from the draft for
  // the new key (or cleared if there is no draft).
  const prefillKey = useMemo(() => prefillKeyOf(fromNarrow), [fromNarrow]);
  const lastPrefillKeyRef = useRef<string | null>(null);

  // The per-conversation draft key for autosave/restore (Phase 2.4).
  // `null` for the unaddressed compose state.
  const draftKey = useMemo(() => draftKeyFor(fromNarrow), [fromNarrow]);
  // Whether the current `form.content` was just restored from a saved
  // draft — drives the small "Restored from draft" affordance below
  // the compose. Cleared as soon as the user types or navigates.
  const [showRestoredHint, setShowRestoredHint] = useState(false);

  // Apply the pre-fill on every narrow change. The recipient/topic
  // fields come from the narrow; the body comes from the saved draft
  // for this destination (if any), otherwise blank. We do NOT preserve
  // the previous narrow's body across the swap — that body is already
  // saved as its own draft by the autosave effect below.
  useEffect(() => {
    if (lastPrefillKeyRef.current === prefillKey) {
      return;
    }
    lastPrefillKeyRef.current = prefillKey;
    setErrorMessage(null);
    const restored =
      draftKey !== null ? getDraftAction(draftKey) : undefined;
    setForm((current) => {
      const withRecipients = applyPrefill(
        current,
        fromNarrow,
        getUser,
        getStream,
      );
      return { ...withRecipients, content: restored?.content ?? "" };
    });
    setShowRestoredHint(
      restored !== undefined && restored.content.trim() !== "",
    );
    setMode("write");
  }, [prefillKey, fromNarrow, getUser, getStream, draftKey, getDraftAction]);

  // Debounced autosave. On every change to `form.content` (or the draft
  // key), schedule a save 500ms later. If the body is empty, schedule a
  // delete instead. The cleanup cancels any pending timer so a fast
  // re-edit collapses to a single save, and an unmount mid-debounce
  // does not leave a stray timer behind.
  useEffect(() => {
    // No destination → nothing to save (channel without an id, or the
    // unaddressed empty narrow). Don't burn a localStorage write per
    // keystroke for a draft the user can't return to.
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

  // Convenience: which "shape" of form is showing right now. Driven by
  // the user's mode-toggling actions, but defaults to whatever the
  // narrow pre-fill suggests.
  const formMode: "channel" | "direct" | "none" = fromNarrow.mode;

  // The current channel id (for the topic-typeahead's lazy fetch).
  const channelStreamId: StreamId | undefined = useMemo(
    () => resolveChannel(form.channelInput, streams),
    [form.channelInput, streams],
  );
  const topicsForChannel =
    channelStreamId !== undefined ? topicsByChannel[channelStreamId] ?? [] : [];

  // Textarea typeahead (`@` / `#` / `:`). The `onApply` callback
  // updates the controlled value and queues the new cursor position;
  // a separate effect commits the cursor to the DOM after the value
  // change has rendered.
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

  // Apply pending cursor to the DOM once the value has updated. Without
  // this, the textarea's selection stays where it was before the
  // splice (typically inside the now-replaced token).
  useEffect(() => {
    if (pendingTextareaCursor.current === null || textareaNode === null) {
      return;
    }
    const target = pendingTextareaCursor.current;
    pendingTextareaCursor.current = null;
    textareaNode.setSelectionRange(target, target);
    textareaNode.focus();
  }, [form.content, textareaNode]);

  // Topic typeahead.
  const topicTypeahead = useTopicTypeahead({
    value: form.topic,
    streamId: channelStreamId,
    topics: topicsForChannel,
    loadTopics,
    onApply: useCallback((newValue: string) => {
      pendingTopicCursor.current = newValue.length;
      setForm((current) => ({ ...current, topic: newValue }));
    }, []),
  });

  useEffect(() => {
    if (pendingTopicCursor.current === null || topicNode === null) {
      return;
    }
    const target = pendingTopicCursor.current;
    pendingTopicCursor.current = null;
    topicNode.setSelectionRange(target, target);
    topicNode.focus();
  }, [form.topic, topicNode]);

  const canSend =
    !sending &&
    form.content.trim() !== "" &&
    (formMode === "channel" || formMode === "direct");

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
        const streamId = resolveChannel(form.channelInput, streams);
        const topic = form.topic.trim();
        if (streamId === undefined) {
          setErrorMessage(
            "Choose a channel to send to (the channel name is unknown).",
          );
          return;
        }
        if (topic === "") {
          setErrorMessage("This channel needs a topic.");
          return;
        }
        const streamName = getStream(streamId)?.name;
        destination = {
          type: "channel",
          streamId,
          streamName,
          topic,
        };
        sendCall = () =>
          apiClient.sendMessage({
            type: "channel",
            to: streamId,
            topic,
            content,
          });
      } else {
        const recipientIds = parseRecipients(form.recipientsInput, users);
        if (recipientIds.length === 0) {
          setErrorMessage("Add at least one recipient.");
          return;
        }
        destination = {
          type: "direct",
          recipientIds,
          lookupUser: getUser,
        };
        sendCall = () =>
          apiClient.sendMessage({
            type: "direct",
            to: recipientIds,
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
        // The server's id is the canonical one. Reconcile drops the
        // optimistic entry; if the live `message` event already
        // arrived, the cache entry from the event is preserved.
        reconcileOptimistic(localId, { ...optimistic, id: result.id });
        // The draft for this destination has been delivered; drop it
        // synchronously so the autosave debounce does not re-save the
        // (still-rendered) body in the gap before the textarea clears.
        if (draftKey !== null) {
          deleteDraftAction(draftKey);
        }
        // Clear only the body — keep recipient/topic for the next msg.
        setForm((current) => ({ ...current, content: "" }));
        setShowRestoredHint(false);
        // Return focus to the textarea so the user can keep typing.
        textareaNode?.focus();
      } catch (cause) {
        // Failure path: drop the optimistic echo, surface the error.
        // The draft text stays in the textarea for retry.
        removeOptimistic(localId);
        setErrorMessage(describeError(cause));
      } finally {
        setSending(false);
      }
    },
    [
      form,
      formMode,
      sending,
      session,
      getUser,
      getStream,
      streams,
      users,
      insertOptimistic,
      reconcileOptimistic,
      removeOptimistic,
      textareaNode,
      draftKey,
      deleteDraftAction,
    ],
  );

  // Keyboard model: typeahead first (so Enter/Tab/Arrows/Escape navigate
  // the panel when it is open), then send. Shift+Enter inserts a newline.
  // The composition guard avoids sending mid-IME composition (e.g. CJK).
  const onTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (textareaTypeahead.handleKeyDown(event)) {
        return;
      }
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      // `nativeEvent.isComposing` is true while an IME is composing;
      // sending in that state would prematurely commit a half-typed
      // glyph. Let the IME handle the Enter.
      if (event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      void onSubmit();
    },
    [onSubmit, textareaTypeahead],
  );

  // Topic input: typeahead intercepts arrows/enter/tab/escape; otherwise
  // we let the form's natural behaviour through (Enter would submit the
  // form, but the `Send` button has the only `type="submit"` so this is
  // a no-op in practice).
  const onTopicKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      topicTypeahead.handleKeyDown(event);
    },
    [topicTypeahead],
  );

  if (formMode === "none") {
    return (
      <div className={styles.compose}>
        <p className={styles.hint}>
          Choose a channel or a direct-message conversation to start writing.
        </p>
      </div>
    );
  }

  // Tabs primitive's render-prop signature does not match what we want
  // (we render write+preview side-by-side semantically). A pair of
  // role="tab" buttons is enough here and stays consistent with the
  // primitive's visual treatment via the same `secondary` button style.
  return (
    <form className={styles.compose} onSubmit={onSubmit} aria-label="Send a message">
      <div className={styles.recipientRow}>
        {formMode === "channel" ? (
          <>
            <label className={styles.fieldLabel} htmlFor="compose-channel">
              Channel
            </label>
            <Input
              id="compose-channel"
              size="sm"
              value={form.channelInput}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  channelInput: event.target.value,
                }))
              }
              placeholder="channel name"
              disabled={sending}
            />
            <label className={styles.fieldLabel} htmlFor="compose-topic">
              Topic
            </label>
            <Input
              id="compose-topic"
              ref={setTopicRef}
              size="sm"
              value={form.topic}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  topic: event.target.value,
                }))
              }
              onKeyDown={onTopicKeyDown}
              onFocus={topicTypeahead.handleFocus}
              onBlur={topicTypeahead.handleBlur}
              placeholder="topic"
              disabled={sending}
              aria-autocomplete="list"
              aria-controls={
                topicTypeahead.state.open
                  ? topicTypeahead.state.panelId
                  : undefined
              }
              aria-activedescendant={
                topicTypeahead.state.activeId ?? undefined
              }
              aria-expanded={topicTypeahead.state.open}
            />
            <TypeaheadPanel
              panelId={topicTypeahead.state.panelId}
              anchor={topicNode}
              open={topicTypeahead.state.open}
              rows={topicTypeahead.state.rows.map((row) => ({
                id: row.id,
                label: row.label,
                render: () => <TopicRowContent row={row} />,
              }))}
              activeId={topicTypeahead.state.activeId}
              onSelect={topicTypeahead.onSelect}
              onHover={topicTypeahead.onHover}
              ariaLabel="Topic suggestions"
            />
          </>
        ) : (
          <>
            <label className={styles.fieldLabel} htmlFor="compose-recipients">
              To
            </label>
            <Input
              id="compose-recipients"
              size="sm"
              value={form.recipientsInput}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  recipientsInput: event.target.value,
                }))
              }
              placeholder="comma-separated names"
              disabled={sending}
            />
          </>
        )}
      </div>

      <div className={styles.modeRow} role="tablist" aria-label="Compose mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "write"}
          className={[
            styles.modeButton,
            mode === "write" && styles.modeButtonActive,
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setMode("write")}
        >
          Write
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "preview"}
          className={[
            styles.modeButton,
            mode === "preview" && styles.modeButtonActive,
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setMode("preview")}
        >
          Preview
        </button>
      </div>

      {mode === "write" ? (
        <>
          <label className={styles.srOnly} htmlFor="compose-content">
            Message
          </label>
          {showRestoredHint && (
            <p className={styles.restoredHint} aria-live="polite">
              Restored from draft
            </p>
          )}
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
            placeholder={
              formMode === "channel"
                ? "Write a message"
                : "Write a direct message"
            }
            disabled={sending}
            aria-label="Message"
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
      ) : (
        <ComposePreview content={form.content} />
      )}

      {errorMessage !== null && (
        <div className={styles.errorRow}>
          <Banner tone="danger" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Banner>
        </div>
      )}

      <div className={styles.actionsRow}>
        <span className={styles.hintInline} aria-hidden="true">
          Enter to send, Shift+Enter for a new line
        </span>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={sending}
          disabled={!canSend}
        >
          Send
        </Button>
      </div>
    </form>
  );
}

// Pick the right row content for whichever textarea typeahead is open.
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
      return "Mention suggestions";
    case "channel":
      return "Channel suggestions";
    case "emoji":
      return "Emoji suggestions";
    case null:
      return "Suggestions";
  }
}

// Stable per-narrow key for the pre-fill effect.
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

// Compute the recipient/topic fields when the narrow's pre-fill
// changes; preserve the in-progress `content` across the swap.
function applyPrefill(
  current: FormState,
  prefill: ComposeFromNarrow,
  getUser: (id: UserId) => User | undefined,
  getStream: (
    id: StreamId,
  ) => { stream_id: StreamId; name: string } | undefined,
): FormState {
  if (prefill.mode === "channel") {
    const stream =
      prefill.streamId !== undefined ? getStream(prefill.streamId) : undefined;
    return {
      ...current,
      channelInput: stream?.name ?? (prefill.streamId?.toString() ?? ""),
      topic: prefill.topic,
      recipientsInput: "",
    };
  }
  if (prefill.mode === "direct") {
    return {
      ...current,
      channelInput: "",
      topic: "",
      recipientsInput: formatRecipients(prefill.recipientIds, getUser),
    };
  }
  return EMPTY_FORM;
}
