// Upload state machine for the compose box (Phase 4.1).
//
// One `ComposeBox` instance owns one `useUploadManager` instance, which
// tracks the in-flight uploads it initiated. Each upload progresses
// through:
//
//   uploading → done (on success)
//   uploading → error (on transport / server failure)
//   uploading → aborted (on user cancel)
//
// The manager exposes:
//   - `uploads`: the current list (oldest first), drives the UI chips
//     between the textarea and the send button.
//   - `enqueue(file)`: starts an upload for `file`; the manager
//     allocates a stable `id`, picks the right Markdown form (image
//     vs. file), and on success calls the supplied `onInsert(markdown)`
//     so the compose box splices it at the caret. On failure it sets
//     the slot's `status: "error"` and surfaces the message.
//   - `cancel(id)`: abort an in-flight upload via its `AbortController`.
//   - `dismiss(id)`: drop a non-active slot (done / error / aborted).
//
// The hook is intentionally store-free: uploads belong to one compose
// session and should disappear with it. Persisting them across an
// unmount would mean re-attempting on remount, which is not what the
// user expects — a navigated-away compose session is gone.

import { useCallback, useRef, useState } from "react";
import {
  apiClient,
  isApiError,
  isImageType,
  uploadToMarkdown,
  type UploadFileResult,
} from "../../../api";

/** A single upload's status, exclusive. */
export type UploadStatus = "uploading" | "done" | "error" | "aborted";

/** One slot in the manager's `uploads` list. */
export interface UploadSlot {
  /** Stable id used as the React key and dispatch handle. */
  id: string;
  /** Display name shown in the UI; `file.name` at enqueue time. */
  name: string;
  /** Total size in bytes, or `undefined` when the file did not declare one. */
  size: number | undefined;
  /** MIME type for image-vs-file distinction. */
  mimeType: string;
  /** `0..1` upload fraction; `1` once `done`. */
  progress: number;
  status: UploadStatus;
  /** Server URL once `done`. */
  result?: UploadFileResult;
  /** Human-readable message when `status === "error"`. */
  errorMessage?: string;
}

/** Configuration for the manager hook. */
export interface UseUploadManagerOptions {
  /** Splice the resulting Markdown into the compose textarea at the caret. */
  onInsert: (markdown: string) => void;
}

/** Return shape of `useUploadManager`. */
export interface UploadManager {
  uploads: UploadSlot[];
  /** Returns `true` if at least one upload is still in flight. */
  busy: boolean;
  enqueue: (file: File) => void;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
}

let nextId = 1;
function allocateId(): string {
  // Module-level counter is fine: ids only need uniqueness within the
  // process lifetime, and remounting the compose box does not introduce
  // a collision because slots are local to one `useUploadManager`.
  return `upload-${nextId++}`;
}

export function useUploadManager(
  options: UseUploadManagerOptions,
): UploadManager {
  const { onInsert } = options;
  const [uploads, setUploads] = useState<UploadSlot[]>([]);
  // Per-slot abort controllers, kept off React state so abort() does
  // not cause a re-render cascade by itself.
  const controllersRef = useRef(new Map<string, AbortController>());

  // Tracking `onInsert` via a ref keeps `enqueue` stable across renders
  // (the consumer changes its `onInsert` identity each render to capture
  // the latest cursor position; we want the in-flight upload to use the
  // newest reference when it completes, not a snapshot from enqueue).
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  const updateSlot = useCallback(
    (id: string, patch: Partial<UploadSlot>) => {
      setUploads((current) =>
        current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
      );
    },
    [],
  );

  const enqueue = useCallback(
    (file: File): void => {
      const id = allocateId();
      const controller = new AbortController();
      controllersRef.current.set(id, controller);

      const slot: UploadSlot = {
        id,
        name: file.name,
        size: file.size === 0 ? undefined : file.size,
        mimeType: file.type,
        progress: 0,
        status: "uploading",
      };
      setUploads((current) => [...current, slot]);

      apiClient
        .uploadFile({
          file,
          signal: controller.signal,
          onProgress: (fraction) => {
            updateSlot(id, { progress: fraction });
          },
        })
        .then((result) => {
          controllersRef.current.delete(id);
          const markdown = uploadToMarkdown(result, isImageType(file.type));
          // Drop the chip on success — the inserted Markdown is the
          // durable record. The intermediate "done" state would
          // flicker for one frame and then disappear.
          onInsertRef.current(markdown);
          setUploads((current) => current.filter((s) => s.id !== id));
        })
        .catch((cause: unknown) => {
          controllersRef.current.delete(id);
          if (isApiError(cause) && cause.code === "ABORTED") {
            updateSlot(id, { status: "aborted" });
            return;
          }
          updateSlot(id, {
            status: "error",
            errorMessage: describeError(cause),
          });
        });
    },
    [updateSlot],
  );

  const cancel = useCallback((id: string): void => {
    const controller = controllersRef.current.get(id);
    controller?.abort();
    // The XHR `abort` event fires synchronously and our promise
    // catch-handler updates the slot's status; nothing else to do.
  }, []);

  const dismiss = useCallback((id: string): void => {
    setUploads((current) => current.filter((slot) => slot.id !== id));
  }, []);

  const busy = uploads.some((slot) => slot.status === "uploading");

  return { uploads, busy, enqueue, cancel, dismiss };
}

function describeError(cause: unknown): string {
  if (isApiError(cause)) {
    return cause.body?.msg ?? cause.message;
  }
  if (cause instanceof Error && cause.message !== "") {
    return cause.message;
  }
  return "Не удалось загрузить файл.";
}
