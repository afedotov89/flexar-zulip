// Flexar Hub Web — compose box (Phase 2.1 + 2.2).
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
// Drafts (auto-save / restore) and recipient/topic typeahead are
// explicitly out of scope (Phases 2.3 / 2.4). Compose state lives in
// component state only.

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
import { useMessagesStore } from "../../stores/messagesStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import { AutoGrowTextarea } from "./AutoGrowTextarea";
import {
  composeFromNarrow,
  type ComposeFromNarrow,
} from "./composeFromNarrow";
import {
  buildOptimisticMessage,
  nextLocalId,
  type OptimisticDestination,
  type OptimisticSender,
} from "./optimisticMessage";
import { ComposePreview } from "./ComposePreview";
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
  const getStream = useStreamsStore((store) => store.getStream);
  const insertOptimistic = useMessagesStore((s) => s.insertOptimistic);
  const reconcileOptimistic = useMessagesStore((s) => s.reconcileOptimistic);
  const removeOptimistic = useMessagesStore((s) => s.removeOptimistic);

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A stable identity for the current narrow's pre-fill, used to reset
  // the form fields when the user navigates between conversations.
  // We deliberately key on the *derived* shape (channel id + topic, or
  // sorted recipient ids) rather than the narrow reference so going
  // from `/narrow/channel/7` to `/narrow/channel/7/topic/x` only
  // changes the topic, not the body.
  const prefillKey = useMemo(() => prefillKeyOf(fromNarrow), [fromNarrow]);
  const lastPrefillKeyRef = useRef<string | null>(null);

  // Apply the pre-fill once per narrow change. We never overwrite the
  // user's typed content — only the recipient/topic fields are reset
  // to the new narrow's pre-fill (this matches the chat-app convention
  // that the in-progress draft survives navigation).
  useEffect(() => {
    if (lastPrefillKeyRef.current === prefillKey) {
      return;
    }
    lastPrefillKeyRef.current = prefillKey;
    setErrorMessage(null);
    setForm((current) => applyPrefill(current, fromNarrow, getUser, getStream));
    setMode("write");
  }, [prefillKey, fromNarrow, getUser, getStream]);

  // Convenience: which "shape" of form is showing right now. Driven by
  // the user's mode-toggling actions, but defaults to whatever the
  // narrow pre-fill suggests.
  const formMode: "channel" | "direct" | "none" = fromNarrow.mode;

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
        // Clear only the body — keep recipient/topic for the next msg.
        setForm((current) => ({ ...current, content: "" }));
        // Return focus to the textarea so the user can keep typing.
        textareaRef.current?.focus();
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
    ],
  );

  // Keyboard model: Enter sends, Shift+Enter inserts a newline. The
  // composition guard avoids sending mid-IME composition (e.g. CJK).
  const onTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
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
    [onSubmit],
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
              size="sm"
              value={form.topic}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  topic: event.target.value,
                }))
              }
              placeholder="topic"
              disabled={sending}
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
          <AutoGrowTextarea
            id="compose-content"
            ref={textareaRef}
            value={form.content}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
            onKeyDown={onTextareaKeyDown}
            placeholder={
              formMode === "channel"
                ? "Write a message"
                : "Write a direct message"
            }
            disabled={sending}
            aria-label="Message"
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
