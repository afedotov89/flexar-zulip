// Flexar Hub Web — typeahead public surface for the compose feature
// (Phase 2.3).

export { detectTrigger } from "./triggerDetect";
export type { TypeaheadTrigger, TypeaheadTriggerKind } from "./triggerDetect";
export { spliceTypeahead } from "./splice";
export {
  channelRows,
  emojiRows,
  mentionRows,
  topicRows,
  TYPEAHEAD_MAX_ROWS,
} from "./sources";
export type {
  ChannelRow,
  EmojiRow,
  MentionRow,
  TopicRow,
} from "./sources";
export { TypeaheadPanel } from "./TypeaheadPanel";
export type { TypeaheadPanelProps, TypeaheadPanelRow } from "./TypeaheadPanel";
export {
  MentionRowContent,
  ChannelRowContent,
  EmojiRowContent,
  TopicRowContent,
} from "./rowRenderers";
export { useTextareaTypeahead } from "./useTextareaTypeahead";
export type {
  TextareaTypeaheadKind,
  TextareaTypeaheadRow,
  TextareaTypeaheadState,
  UseTextareaTypeaheadArgs,
  UseTextareaTypeaheadReturn,
} from "./useTextareaTypeahead";
export { useTopicTypeahead } from "./useTopicTypeahead";
export type {
  TopicTypeaheadState,
  UseTopicTypeaheadArgs,
  UseTopicTypeaheadReturn,
} from "./useTopicTypeahead";
