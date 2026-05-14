// Flexar Hub Web — message feed feature public surface (Phase 1.6).
//
// The app's centre column: the virtualized message list for the
// current narrow. `Feed` (the page) mounts `MessageFeed` for narrow
// routes. The feed's internals — the window hook, the row derivation,
// the visual subcomponents — are not exported; they are feature-local.

export { MessageFeed, type MessageFeedProps } from "./MessageFeed";
