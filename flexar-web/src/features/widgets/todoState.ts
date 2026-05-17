// Pure derivation of todo-widget state from a Message's submessages
// (audit follow-up — parallel to `pollState`).
//
// Zulip's todo widget shares the submessage transport with poll: the
// first submessage carries the widget metadata
// (`widget_type: "todo"`), each subsequent submessage records an
// event:
//
//   - `new_task`              — any user appends a task to the list
//   - `strike`                — toggle "completed" on a task
//   - `new_task_list_title`   — the widget author renames the list
//
// Task keys use the encoding `"<sender_id>,<idx>"`, with `"canned"`
// as the synthetic sender id for tasks that came in with the initial
// widget metadata. This mirrors poll's key shape so the same kinds
// of routing bugs can't sneak back in.

import type { Submessage } from "../../domain";

export interface TodoTask {
  key: string;
  /** Short task label. */
  text: string;
  /** Longer free-form description, if the user supplied one. */
  description: string;
  /** Whether the task is currently marked completed. */
  completed: boolean;
}

export interface TodoState {
  title: string;
  tasks: TodoTask[];
}

interface TodoMeta {
  type: "todo";
  title: string;
  initial: { task: string; desc: string }[];
}

/**
 * Detect whether a message is a todo widget. Returns the parsed
 * metadata or `null` when the first submessage is missing,
 * non-widget, malformed, or carries a different `widget_type`.
 */
export function detectTodo(submessages: readonly Submessage[]): TodoMeta | null {
  const first = submessages[0];
  if (first === undefined || first.msg_type !== "widget") {
    return null;
  }
  const parsed = parseJsonOrNull(first.content);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    (parsed as { widget_type?: unknown }).widget_type !== "todo"
  ) {
    return null;
  }
  const extra = (parsed as { extra_data?: unknown }).extra_data;
  if (extra === null || typeof extra !== "object") {
    return null;
  }
  const titleRaw = (extra as { task_list_title?: unknown }).task_list_title;
  const tasksRaw = (extra as { tasks?: unknown }).tasks;
  const title = typeof titleRaw === "string" ? titleRaw : "";
  const initial: { task: string; desc: string }[] = [];
  if (Array.isArray(tasksRaw)) {
    for (const entry of tasksRaw) {
      if (entry === null || typeof entry !== "object") {
        continue;
      }
      const task = (entry as { task?: unknown }).task;
      const desc = (entry as { desc?: unknown }).desc;
      if (typeof task !== "string") {
        continue;
      }
      initial.push({ task, desc: typeof desc === "string" ? desc : "" });
    }
  }
  return { type: "todo", title, initial };
}

/**
 * Fold submessage events on top of the initial widget metadata.
 * Returns `null` when the message is not a todo widget.
 */
export function deriveTodoState(
  submessages: readonly Submessage[],
): TodoState | null {
  const meta = detectTodo(submessages);
  if (meta === null) {
    return null;
  }

  // Local task keys follow Zulip's `${idx},${sender_id}` convention so
  // strike events from other clients land on the right task. Initial
  // (extra_data) tasks use the synthetic `sender_id="canned"` per the
  // legacy reducer.
  const tasksMap = new Map<string, TodoTask>();
  meta.initial.forEach((entry, idx) => {
    const key = `${idx},canned`;
    tasksMap.set(key, {
      key,
      text: entry.task,
      description: entry.desc,
      completed: false,
    });
  });

  let title = meta.title;

  for (let i = 1; i < submessages.length; i++) {
    const sub = submessages[i];
    if (sub === undefined || sub.msg_type !== "widget") {
      continue;
    }
    const event = parseJsonOrNull(sub.content);
    if (event === null || typeof event !== "object") {
      continue;
    }
    const type = (event as { type?: unknown }).type;
    if (type === "new_task") {
      const keyRaw = (event as { key?: unknown }).key;
      const taskRaw = (event as { task?: unknown }).task;
      const descRaw = (event as { desc?: unknown }).desc;
      // The wire `key` is an INTEGER idx (per-sender). The local map
      // key is `${idx},${sender_id}` so a `strike` from any client
      // routes to the right task. Reject malformed payloads silently.
      if (typeof keyRaw !== "number" || !Number.isInteger(keyRaw)) {
        continue;
      }
      if (typeof taskRaw !== "string") {
        continue;
      }
      const key = `${keyRaw},${sub.sender_id}`;
      if (tasksMap.has(key)) {
        continue;
      }
      tasksMap.set(key, {
        key,
        text: taskRaw,
        description: typeof descRaw === "string" ? descRaw : "",
        completed: false,
      });
      continue;
    }
    if (type === "strike") {
      const keyRaw = (event as { key?: unknown }).key;
      if (typeof keyRaw !== "string") {
        continue;
      }
      const task = tasksMap.get(keyRaw);
      if (task === undefined) {
        continue;
      }
      tasksMap.set(keyRaw, { ...task, completed: !task.completed });
      continue;
    }
    if (type === "new_task_list_title") {
      const next = (event as { title?: unknown }).title;
      if (typeof next === "string") {
        title = next;
      }
    }
  }

  return {
    title,
    tasks: Array.from(tasksMap.values()),
  };
}

/**
 * Submessage body for toggling completion on a task — Zulip's `strike`
 * event simply flips the bit, with no value payload beyond `key`.
 */
export function buildStrikeContent(key: string): string {
  return JSON.stringify({ type: "strike", key });
}

/**
 * Submessage body for adding a new task. `idx` is a per-sender,
 * monotonically increasing integer (1..1000) — the server validates
 * `z.int().check(nonneg, lte(1000))`. `completed: false` is sent
 * verbatim per Zulip's legacy wire format (the receiver re-derives it
 * but the field must be present and well-typed).
 *
 * `senderId` is accepted for symmetry with `buildStrikeContent` and
 * future use but isn't part of the outbound payload — the server fills
 * `sender_id` in from the auth context.
 */
export function buildNewTaskContent(
  _senderId: number,
  idx: number,
  task: string,
  desc: string,
): string {
  return JSON.stringify({
    type: "new_task",
    key: idx,
    task,
    desc,
    completed: false,
  });
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
