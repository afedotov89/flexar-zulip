// Upload chips shown above the action row (Phase 4.1).
//
// Renders one chip per active upload: filename, progress bar, and a
// cancel/dismiss button. Hidden when there are no uploads.
//
// Pure UI: state and handlers come from `useUploadManager` in the
// parent. Used by `ComposeBox`.

import { useEffect, useRef } from "react";
import { IconButton } from "../../../components/IconButton";
import type { UploadSlot } from "./useUploadManager";
import styles from "./UploadChips.module.css";

export interface UploadChipsProps {
  uploads: readonly UploadSlot[];
  /** Cancel an in-flight upload by id. */
  onCancel: (id: string) => void;
  /** Dismiss a finished/errored slot from the list. */
  onDismiss: (id: string) => void;
}

export function UploadChips({
  uploads,
  onCancel,
  onDismiss,
}: UploadChipsProps): React.JSX.Element | null {
  if (uploads.length === 0) {
    return null;
  }
  return (
    <ul className={styles.chips} aria-label="Загрузки">
      {uploads.map((slot) => (
        <UploadChip
          key={slot.id}
          slot={slot}
          onCancel={() => onCancel(slot.id)}
          onDismiss={() => onDismiss(slot.id)}
        />
      ))}
    </ul>
  );
}

interface UploadChipProps {
  slot: UploadSlot;
  onCancel: () => void;
  onDismiss: () => void;
}

function UploadChip({
  slot,
  onCancel,
  onDismiss,
}: UploadChipProps): React.JSX.Element {
  const percent = Math.round(slot.progress * 100);
  const statusLabel = describeStatus(slot, percent);
  const isActive = slot.status === "uploading";
  // Inline JSX `style` is forbidden by the engineering guide; the
  // progress fill width is published as a CSS custom property and the
  // stylesheet reads it. Mirrors `_overlay/useOverlayPosition`'s
  // approach to dynamic dimensions.
  const fillRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    fillRef.current?.style.setProperty("--upload-progress", `${percent}%`);
  }, [percent]);

  return (
    <li className={styles.chip} data-status={slot.status}>
      <div className={styles.chipBody}>
        <span className={styles.name}>{slot.name}</span>
        <span className={styles.status}>{statusLabel}</span>
        {isActive && (
          <span
            className={styles.progressTrack}
            role="progressbar"
            aria-label={`Прогресс загрузки ${slot.name}`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span ref={fillRef} className={styles.progressFill} />
          </span>
        )}
      </div>
      <IconButton
        icon="close"
        size="sm"
        variant="ghost"
        aria-label={
          isActive ? `Отменить загрузку ${slot.name}` : `Скрыть ${slot.name}`
        }
        onClick={isActive ? onCancel : onDismiss}
        className={styles.dismiss}
      />
    </li>
  );
}

function describeStatus(slot: UploadSlot, percent: number): string {
  switch (slot.status) {
    case "uploading":
      return slot.size === undefined ? "Загрузка…" : `Загрузка ${percent}%`;
    case "done":
      return "Готово";
    case "aborted":
      return "Отменено";
    case "error":
      return slot.errorMessage ?? "Ошибка загрузки";
  }
}
