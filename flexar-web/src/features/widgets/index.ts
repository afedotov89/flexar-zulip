// Public surface of the widgets feature (Phase 4.7 + todo follow-up).

export { PollWidget, useViewerUserIdForWidgets } from "./PollWidget";
export type { PollWidgetProps } from "./PollWidget";
export { detectPoll, derivePollState } from "./pollState";
export type { PollOption, PollState } from "./pollState";
export { TodoWidget } from "./TodoWidget";
export type { TodoWidgetProps } from "./TodoWidget";
export { detectTodo, deriveTodoState } from "./todoState";
export type { TodoState, TodoTask } from "./todoState";
