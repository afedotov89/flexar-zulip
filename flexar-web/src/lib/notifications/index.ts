// Public surface of the notifications lib (Phase 3.5).
//
// The dispatcher (`src/features/notifications/`) imports from here.

export {
  notificationPermission,
  notificationsSupported,
  requestPermission,
  showDesktopNotification,
  type ShowDesktopNotificationOptions,
} from "./desktop";
export { playNotificationSound } from "./sound";
export {
  notificationTriggerFor,
  type NotificationKind,
  type NotificationTrigger,
} from "./triggers";
