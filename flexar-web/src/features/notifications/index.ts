// Public surface of the notifications feature (Phase 3.5).
//
// `NotificationCenter` is mounted once inside the authenticated app
// shell and dispatches desktop notifications + sound for incoming
// messages. It returns `null`; the only UI it produces is the
// browser's own Notification popup.

export { NotificationCenter } from "./NotificationCenter";
