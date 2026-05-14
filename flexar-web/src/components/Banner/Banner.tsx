// Flexar Hub Web — Banner / Alert primitive (Phase 0.6).
//
// Inline message banner with an optional title, body, leading status
// icon, and optional dismiss button. `tone` selects the colour and the
// icon: each tone draws on its own semantic colour role (`info` →
// accent, `success` → success, `warning` → warning, `danger` → danger)
// and carries a matching status glyph.
//
// Accessibility: `danger`/`warning` banners are `role="alert"`
// (assertive); `info`/`success` are `role="status"` (polite).

import type { ReactNode } from "react";
import type { IconName } from "../../icons";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import styles from "./Banner.module.css";

export type BannerTone = "info" | "success" | "warning" | "danger";

export interface BannerProps {
  /** Severity. Drives colour, icon and ARIA role. Defaults to `info`. */
  tone?: BannerTone;
  /** Optional bold heading shown above the body. */
  title?: string;
  /** Banner body content. */
  children?: ReactNode;
  /** When provided, renders a dismiss button that calls this handler. */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button. Defaults to `"Dismiss"`. */
  dismissLabel?: string;
  className?: string;
}

const toneClass: Record<BannerTone, string> = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
};

// Each tone carries its own status glyph from the shared icon set.
const toneIcon: Record<BannerTone, IconName> = {
  info: "info",
  success: "check",
  warning: "warning",
  danger: "error",
};

const assertiveTones: ReadonlySet<BannerTone> = new Set<BannerTone>([
  "warning",
  "danger",
]);

export function Banner({
  tone = "info",
  title,
  children,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
}: BannerProps): React.JSX.Element {
  const classes = [styles.banner, toneClass[tone], className]
    .filter(Boolean)
    .join(" ");

  const icon = toneIcon[tone];
  const role = assertiveTones.has(tone) ? "alert" : "status";

  return (
    <div className={classes} role={role}>
      <span className={styles.iconSlot}>
        <Icon name={icon} size="md" />
      </span>
      <div className={styles.content}>
        {title != null && <p className={styles.title}>{title}</p>}
        {children != null && <div className={styles.body}>{children}</div>}
      </div>
      {onDismiss != null && (
        <IconButton
          icon="close"
          aria-label={dismissLabel}
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className={styles.dismiss}
        />
      )}
    </div>
  );
}
