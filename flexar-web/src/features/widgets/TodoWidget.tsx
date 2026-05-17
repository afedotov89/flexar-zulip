// Todo-list widget renderer (audit follow-up — parallel to PollWidget).
//
// Renders a todo-widget message in place of `MessageContent`: shows the
// list title and each task as a checkbox row; clicking the checkbox
// strikes (toggles completion) for everyone. Any participant can add
// a task inline at the bottom.
//
// State is derived from `message.submessages` through `deriveTodoState`.
// Mutations POST to `apiClient.sendSubmessage`; the realtime echo
// (server emits the same submessage to all sessions) drives the
// in-place update — no separate optimistic write needed.

import { useMemo, useRef, useState } from "react";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Checkbox } from "../../components/Checkbox";
import { Input } from "../../components/Input";
import { apiClient } from "../../api";
import type { Submessage } from "../../domain";
import { describeApiError } from "../../lib/errors";
import {
  buildNewTaskContent,
  buildStrikeContent,
  deriveTodoState,
} from "./todoState";
import styles from "./TodoWidget.module.css";

export interface TodoWidgetProps {
  /** Id of the parent (widget) message — needed to post submessages. */
  messageId: number;
  /** The cached message's `submessages` array (live). */
  submessages: readonly Submessage[];
  /** The viewer's user id; used to build per-viewer task `key`s. */
  viewerUserId: number;
}

export function TodoWidget({
  messageId,
  submessages,
  viewerUserId,
}: TodoWidgetProps): React.JSX.Element | null {
  // Derive on every render — `submessages` reference changes on each
  // fold, so a `useMemo` would invalidate at the same cadence.
  const state = deriveTodoState(submessages);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Viewer's local "next idx" counter for added tasks. Persists in a
  // ref so navigating away and back doesn't collide; seeded from the
  // highest existing idx-by-viewer + 1 so a re-mount continues
  // monotonically. Local keys are `${idx},${sender_id}` (Zulip
  // convention), so the viewer's tasks end with `,${viewerUserId}`.
  // Server validates `idx` as integer in [0, 1000].
  const myIdxRef = useRef<number | null>(null);
  const myMaxIdx = useMemo(() => {
    if (state === null) {
      return 0;
    }
    let max = 0;
    for (const t of state.tasks) {
      if (t.key.endsWith(`,${viewerUserId}`)) {
        const idxStr = t.key.slice(0, -`,${viewerUserId}`.length);
        const idx = Number(idxStr);
        if (Number.isInteger(idx) && idx > max) {
          max = idx;
        }
      }
    }
    return max;
  }, [state, viewerUserId]);
  if (myIdxRef.current === null || myIdxRef.current <= myMaxIdx) {
    myIdxRef.current = myMaxIdx + 1;
  }

  if (state === null) {
    return null;
  }

  const handleStrike = async (key: string): Promise<void> => {
    setBusyKey(key);
    setError(null);
    try {
      await apiClient.sendSubmessage({
        messageId,
        msgType: "widget",
        content: buildStrikeContent(key),
      });
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось обновить список."));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className={styles.widget}>
      {state.title !== "" && (
        <h3 className={styles.title}>{state.title}</h3>
      )}

      {state.tasks.length === 0 ? (
        <p className={styles.empty}>В списке пока нет задач.</p>
      ) : (
        <ul className={styles.list}>
          {state.tasks.map((task) => (
            <li key={task.key} className={styles.taskRow}>
              <Checkbox
                checked={task.completed}
                disabled={busyKey === task.key}
                onChange={() => void handleStrike(task.key)}
                aria-label={task.text}
              />
              <div className={styles.taskBody}>
                <span
                  className={`${styles.taskText}${
                    task.completed ? ` ${styles.taskStruck}` : ""
                  }`}
                >
                  {task.text}
                </span>
                {task.description !== "" && (
                  <span className={styles.taskDesc}>{task.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewTaskInput
        messageId={messageId}
        viewerUserId={viewerUserId}
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

interface NewTaskInputProps {
  messageId: number;
  viewerUserId: number;
  nextIdxRef: React.MutableRefObject<number | null>;
  onError: (message: string) => void;
}

function NewTaskInput({
  messageId,
  viewerUserId,
  nextIdxRef,
  onError,
}: NewTaskInputProps): React.JSX.Element {
  const [task, setTask] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    const trimmedTask = task.trim();
    if (trimmedTask === "") {
      return;
    }
    setBusy(true);
    try {
      const idx = nextIdxRef.current ?? 0;
      await apiClient.sendSubmessage({
        messageId,
        msgType: "widget",
        content: buildNewTaskContent(viewerUserId, idx, trimmedTask, desc.trim()),
      });
      nextIdxRef.current = idx + 1;
      setTask("");
      setDesc("");
    } catch (cause) {
      onError(describeApiError(cause, "Не удалось добавить задачу."));
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
        value={task}
        onChange={(event) => setTask(event.currentTarget.value)}
        placeholder="Новая задача"
        disabled={busy}
      />
      <Input
        size="sm"
        value={desc}
        onChange={(event) => setDesc(event.currentTarget.value)}
        placeholder="Описание (необязательно)"
        disabled={busy}
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={busy || task.trim() === ""}
        loading={busy}
      >
        Добавить
      </Button>
    </form>
  );
}
