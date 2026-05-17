// Tests for `todoState` — parallel coverage to `pollState`. Detect,
// fold initial tasks, fold `new_task` / `strike` / `new_task_list_title`
// events, tolerate malformed submessages.

import { describe, expect, it } from "vitest";
import type { Submessage } from "../../domain";
import {
  buildNewTaskContent,
  buildStrikeContent,
  detectTodo,
  deriveTodoState,
} from "./todoState";

function widget(
  content: unknown,
  id: number,
  sender_id: number,
): Submessage {
  return {
    id,
    sender_id,
    message_id: 0,
    msg_type: "widget",
    content: typeof content === "string" ? content : JSON.stringify(content),
  };
}

describe("detectTodo", () => {
  it("returns null on empty submessages", () => {
    expect(detectTodo([])).toBeNull();
  });

  it("returns null when first submessage is a non-widget", () => {
    expect(
      detectTodo([{ ...widget({}, 1, 1), msg_type: "normal" }]),
    ).toBeNull();
  });

  it("returns null for a poll widget (different type)", () => {
    expect(
      detectTodo([widget({ widget_type: "poll", extra_data: {} }, 1, 1)]),
    ).toBeNull();
  });

  it("parses initial tasks + title", () => {
    const meta = detectTodo([
      widget(
        {
          widget_type: "todo",
          extra_data: {
            task_list_title: "Sprint",
            tasks: [
              { task: "ship feature", desc: "by Friday" },
              { task: "review PR" },
            ],
          },
        },
        1,
        7,
      ),
    ]);
    expect(meta).toEqual({
      type: "todo",
      title: "Sprint",
      initial: [
        { task: "ship feature", desc: "by Friday" },
        { task: "review PR", desc: "" },
      ],
    });
  });
});

describe("deriveTodoState", () => {
  it("seeds tasks from initial metadata with `canned,` keys", () => {
    const state = deriveTodoState([
      widget(
        {
          widget_type: "todo",
          extra_data: {
            task_list_title: "Today",
            tasks: [{ task: "write docs" }],
          },
        },
        1,
        7,
      ),
    ]);
    expect(state).not.toBeNull();
    expect(state!.title).toBe("Today");
    expect(state!.tasks).toHaveLength(1);
    expect(state!.tasks[0]).toMatchObject({
      key: "canned,0",
      text: "write docs",
      completed: false,
    });
  });

  it("folds a `new_task` event", () => {
    const state = deriveTodoState([
      widget(
        {
          widget_type: "todo",
          extra_data: { task_list_title: "T", tasks: [] },
        },
        1,
        7,
      ),
      widget(JSON.parse(buildNewTaskContent(8, 0, "deploy", "")), 2, 8),
    ]);
    expect(state!.tasks).toHaveLength(1);
    expect(state!.tasks[0].key).toBe("8,0");
    expect(state!.tasks[0].text).toBe("deploy");
  });

  it("`strike` toggles `completed` idempotently", () => {
    const state = deriveTodoState([
      widget(
        {
          widget_type: "todo",
          extra_data: {
            task_list_title: "T",
            tasks: [{ task: "x" }],
          },
        },
        1,
        7,
      ),
      widget(JSON.parse(buildStrikeContent("canned,0")), 2, 7),
    ]);
    expect(state!.tasks[0].completed).toBe(true);

    const reToggled = deriveTodoState([
      widget(
        {
          widget_type: "todo",
          extra_data: {
            task_list_title: "T",
            tasks: [{ task: "x" }],
          },
        },
        1,
        7,
      ),
      widget(JSON.parse(buildStrikeContent("canned,0")), 2, 7),
      widget(JSON.parse(buildStrikeContent("canned,0")), 3, 7),
    ]);
    expect(reToggled!.tasks[0].completed).toBe(false);
  });

  it("`new_task_list_title` updates the title in place", () => {
    const state = deriveTodoState([
      widget(
        {
          widget_type: "todo",
          extra_data: { task_list_title: "Old", tasks: [] },
        },
        1,
        7,
      ),
      widget({ type: "new_task_list_title", title: "New" }, 2, 7),
    ]);
    expect(state!.title).toBe("New");
  });

  it("ignores malformed submessages without crashing", () => {
    const state = deriveTodoState([
      widget(
        { widget_type: "todo", extra_data: { task_list_title: "T", tasks: [] } },
        1,
        7,
      ),
      widget("not json at all", 2, 7),
      widget({ type: "new_task" /* missing key/task */ }, 3, 7),
    ]);
    expect(state!.tasks).toHaveLength(0);
  });
});
