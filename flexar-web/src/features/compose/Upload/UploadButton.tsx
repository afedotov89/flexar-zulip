// File-picker trigger for the compose box (Phase 4.1).
//
// A paperclip IconButton that opens the OS file picker. The actual
// upload starts only once the user picks a file (or files); the
// parent's `onFilesChosen` decides what to do with them — typically
// hand each one to `useUploadManager.enqueue`.
//
// Multi-select is on by default so the user can attach several files
// in one picker open.

import { useCallback, useRef } from "react";
import { IconButton } from "../../../components/IconButton";
import styles from "./UploadButton.module.css";

export interface UploadButtonProps {
  /** Called once the user picks one or more files. */
  onFilesChosen: (files: File[]) => void;
  /** Disables the trigger (e.g. while sending). */
  disabled?: boolean;
}

export function UploadButton({
  onFilesChosen,
  disabled,
}: UploadButtonProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      // Reset the input so picking the same file twice still fires
      // `change`. Without this, re-attaching the same file is a no-op.
      event.target.value = "";
      if (files.length === 0) {
        return;
      }
      onFilesChosen(files);
    },
    [onFilesChosen],
  );

  return (
    <>
      <IconButton
        icon="paperclip"
        size="sm"
        variant="ghost"
        aria-label="Прикрепить файлы"
        onClick={handleClick}
        disabled={disabled}
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={handleChange}
        // Hidden but still accessible to screen readers via the
        // wrapping IconButton's aria-label, which describes the action.
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}
