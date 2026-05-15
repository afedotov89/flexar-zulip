// Poll widget renderer (Phase 4.7).
//
// Renders a poll-widget message in place of `MessageContent`: shows the
// question and each option with its vote tally and the names of the
// voters; clicking an option toggles the viewer's vote (single click =
// vote, click again = un-vote). Authors can also add new options
// inline.
//
// The state is derived from `message.submessages` through
// `derivePollState` — a pure function. This component is a thin view
// over that state plus a few callbacks that POST to
// `apiClient.sendSubmessage`. Optimism is left to the realtime echo:
// after a successful POST the server emits the same submessage back
// to every session and the messages-store reducer folds it in.

import { useMemo, useRef, useState } from "react";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiClient } from "../../api";
import type { Submessage, UserId } from "../../domain";
import { describeApiError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";
import { useUsersStore } from "../../stores/usersStore";
import {
  buildNewOptionContent,
  buildVoteContent,
  derivePollState,
} from "./pollState";
import styles from "./PollWidget.module.css";

export interface PollWidgetProps {
  /** Id of the parent (widget) message — needed to post submessages. */
  messageId: number;
  /** The cached message's `submessages` array (live). */
  submessages: readonly Submessage[];
  /** The viewer's user id; the vote state pivots on it. */
  viewerUserId: number;
}

export function PollWidget({
  messageId,
  submessages,
  viewerUserId,
}: PollWidgetProps): React.JSX.Element | null {
  // Derive the live poll state on every render. The cached
  // `submessages` array reference changes on every fold (the reducer
  // returns a new array), so a `useMemo` here would re-compute about
  // as often as a plain call.
  const state = derivePollState(submessages);
  const usersMap = useUsersStore((s) => s.users);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // The viewer's local "next idx" counter for adding options. Persists
  // across re-renders (and survives realtime folds) by living in a
  // ref. Seeded from the viewer's existing options so navigating away
  // and back does not collide.
  const myIdxRef = useRef<number | null>(null);
  const myAddedCount = useMemo(
    () => state?.options.filter((o) => o.key.startsWith(`${viewerUserId},`))
      .length ?? 0,
    [state?.options, viewerUserId],
  );
  if (myIdxRef.current === null || myIdxRef.current < myAddedCount) {
    myIdxRef.current = myAddedCount;
  }

  if (state === null) {
    return null;
  }

  const handleVote = async (key: string): Promise<void> => {
    setBusyKey(key);
    setError(null);
    try {
      await apiClient.sendSubmessage({
        messageId,
        msgType: "widget",
        content: buildVoteContent(key, state.hasVoted(key, viewerUserId)),
      });
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось обновить опрос."));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className={styles.poll}>
      <p className={styles.question}>
        {state.question === "" ? "Опрос" : state.question}
      </p>
      <ul className={styles.options}>
        {state.options.map((option) => {
          const voted = state.hasVoted(option.key, viewerUserId);
          return (
            <li key={option.key} className={styles.option} data-voted={voted || undefined}>
              <button
                type="button"
                className={styles.voteButton}
                onClick={() => void handleVote(option.key)}
                disabled={busyKey !== null}
                aria-pressed={voted}
              >
                <span className={styles.tally}>{option.voters.length}</span>
                <span className={styles.text}>{option.text}</span>
              </button>
              {option.voters.length > 0 && (
                <span className={styles.voters}>
                  {namesFor(option.voters, usersMap)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <NewOptionInput
        messageId={messageId}
        nextIdxRef={myIdxRef}
        onError={setError}
      />
      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
    </div>
  );
}

interface NewOptionInputProps {
  messageId: number;
  nextIdxRef: React.MutableRefObject<number | null>;
  onError: (message: string) => void;
}

function NewOptionInput({
  messageId,
  nextIdxRef,
  onError,
}: NewOptionInputProps): React.JSX.Element {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    const text = value.trim();
    if (text === "") {
      return;
    }
    setBusy(true);
    try {
      const idx = nextIdxRef.current ?? 0;
      await apiClient.sendSubmessage({
        messageId,
        msgType: "widget",
        content: buildNewOptionContent(idx, text),
      });
      nextIdxRef.current = idx + 1;
      setValue("");
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось обновить опрос."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.addRow}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        size="sm"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder="Добавить вариант"
        disabled={busy}
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={busy || value.trim() === ""}
        loading={busy}
      >
        Добавить
      </Button>
    </form>
  );
}

function namesFor(
  voterIds: readonly UserId[],
  usersMap: Record<UserId, { full_name: string }>,
): string {
  return voterIds
    .map((id) => usersMap[id]?.full_name ?? `User ${id}`)
    .join(", ");
}

// The auth selector is co-located so the consumer (`MessageRow`) does
// not need to know about the widget's wiring; it just renders
// `<PollWidget messageId={...} submessages={...} viewerUserId={...} />`.
// Using `useAuthStore` directly here would require the prop to be
// optional, which would muddy the contract.
export function useViewerUserIdForWidgets(): number | undefined {
  return useAuthStore((s) => s.session?.userId);
}
