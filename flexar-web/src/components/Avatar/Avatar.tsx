// Flexar Hub Web — Avatar primitive (Phase 0.6).
//
// Round user avatar. Renders the image at `src` when available; on a
// missing or broken `src` it falls back to the user's initials (derived
// from `name`) on a token-based background. The background colour is
// picked deterministically from the `--color-avatar-*` palette by
// hashing `name`, so the same user always gets the same colour. `name`
// doubles as the image `alt` text, so the avatar is never unlabelled.
//
// Size reuses the shared `ButtonSize` vocabulary (sm | md | lg) so
// avatars sit in rhythm with the rest of the control library.
//
// States covered: image, initials-fallback (missing src and load
// error). A presence dot is intentionally out of scope.

import { useState } from "react";
import type { ButtonSize } from "../Button";
import styles from "./Avatar.module.css";

export type AvatarSize = ButtonSize;

export interface AvatarProps {
  /** Image URL. When missing or it fails to load, initials are shown. */
  src?: string;
  /** User's name — initials fallback source and image `alt` text. */
  name: string;
  /** Footprint, reusing the shared control sizes. Defaults to `md`. */
  size?: AvatarSize;
  className?: string;
}

const sizeClass: Record<AvatarSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

// Initials-fallback background palette: one class per `--color-avatar-*`
// role. A stable hash of `name` indexes into this list.
const colorClasses: readonly string[] = [
  styles.color1,
  styles.color2,
  styles.color3,
  styles.color4,
  styles.color5,
];

/** First letter of the first two whitespace-separated words, uppercased. */
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "";
  }
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join("").toUpperCase();
}

/**
 * Deterministic palette class for a name. A simple DJB2-style string
 * hash keeps the mapping stable across renders and sessions, so a
 * given user always shows the same avatar colour.
 */
function colorClassForName(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return colorClasses[Math.abs(hash) % colorClasses.length];
}

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: AvatarProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const classes = [styles.avatar, sizeClass[size], className]
    .filter(Boolean)
    .join(" ");

  const showImage = src != null && src !== "" && !failed;

  if (showImage) {
    return (
      <span className={classes}>
        <img
          className={styles.image}
          src={src}
          alt={name}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  const fallbackClasses = [classes, colorClassForName(name)].join(" ");

  return (
    <span className={fallbackClasses} role="img" aria-label={name}>
      <span className={styles.initials} aria-hidden="true">
        {initialsFromName(name)}
      </span>
    </span>
  );
}
