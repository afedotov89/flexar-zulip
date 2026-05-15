// Flexar Hub Web — desktop Notification API helpers (Phase 3.5).
//
// Thin wrappers around the browser's `Notification` global so the
// dispatcher does not have to feature-detect or stringly-poll
// permission state. The wrappers no-op gracefully on:
//   - Server-side / non-browser environments (the `Notification`
//     global is undefined).
//   - Browsers that have not granted permission. The dispatcher is
//     expected to call `requestPermission()` once at app start; if the
//     user said no, every subsequent `showDesktopNotification` is a
//     silent no-op.
//
// We deliberately do NOT auto-prompt on every notification candidate:
// that gets the permission prompt rejected for the wrong reason.
// `requestPermission()` is invoked exactly once at app boot.

export interface ShowDesktopNotificationOptions {
  title: string;
  body: string;
  /** A short identifier — collapses repeats from the same conversation. */
  tag?: string;
  /**
   * Called when the user clicks the notification. The platform also
   * focuses the page; the click handler is responsible for any in-app
   * routing the focus needs to land on.
   */
  onClick?: () => void;
}

/** Whether the browser exposes the Notification API at all. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** The current `Notification.permission` state, or `"denied"` if unsupported. */
export function notificationPermission(): NotificationPermission {
  if (!notificationsSupported()) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Ask the user for permission once. Returns the resulting permission.
 * Safe to call repeatedly: a second call on `granted` / `denied` is a
 * no-op and resolves to the existing state without re-prompting.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) {
    return "denied";
  }
  if (Notification.permission !== "default") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

/**
 * Pop a desktop notification, if the platform supports it and the
 * user has granted permission. Silently no-ops otherwise.
 */
export function showDesktopNotification(
  options: ShowDesktopNotificationOptions,
): void {
  if (notificationPermission() !== "granted") {
    return;
  }
  try {
    const notification = new Notification(options.title, {
      body: options.body,
      tag: options.tag,
    });
    if (options.onClick !== undefined) {
      const handler = options.onClick;
      notification.onclick = () => {
        // Bring the tab forward so the user lands on the conversation.
        window.focus();
        handler();
        notification.close();
      };
    }
  } catch (error) {
    // A platform may refuse to construct the notification (e.g. iOS
    // PWA contexts, Safari bugs). Log and swallow — the notification
    // is best-effort by design.
    console.warn("desktop notification: construction failed", error);
  }
}
