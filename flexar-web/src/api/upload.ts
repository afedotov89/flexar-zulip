// File upload transport (Phase 4.1).
//
// `POST /user_uploads` is `multipart/form-data` and the compose UI
// wants per-byte progress to render a meaningful in-flight state.
// `fetch` does not surface upload progress (no upload `ReadableStream`
// progress events in any browser the project targets), so this module
// uses `XMLHttpRequest` for that one endpoint. Every other request
// goes through `request.ts` / `fetch`.
//
// Errors normalise into the same `ApiError` shape the rest of the
// client throws — callers can `catch (cause: unknown)` and use
// `isApiError` exactly like for any other endpoint.

import { ApiError, type ApiErrorBody } from "./errors";
import { basicAuthHeader } from "./request";

/** Same dev-proxy base used by `request.ts`. */
const API_BASE = "/api/v1";

/** Credentials for the upload (must always be authenticated). */
interface UploadCredentials {
  email: string;
  apiKey: string;
}

/** Successful response of `POST /user_uploads`. */
export interface UploadFileResult {
  /** Server URL of the stored file. Combine with `filename` for the link. */
  url: string;
  /**
   * Display filename as stored by the server. Modern servers (feature
   * level 285+) return this; older ones do not, in which case we fall
   * back to the basename of the URL. Used as the link text in
   * `[name](url)`.
   */
  filename: string;
}

/** Per-call options for `uploadFile`. */
export interface UploadFileOptions {
  /** The file to upload (HTML File or Blob with a name). */
  file: File;
  credentials: UploadCredentials;
  /** Called with `0..1` as bytes are uploaded. */
  onProgress?: (fraction: number) => void;
  /** Optional abort signal — when fired, the upload is cancelled. */
  signal?: AbortSignal;
}

/**
 * Upload one file to `POST /user_uploads`. Resolves with the server's
 * URL + filename; rejects with `ApiError` on transport failure, server
 * error, or abort.
 */
export function uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
  const { file, credentials, onProgress, signal } = options;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/user_uploads`, true);
    xhr.setRequestHeader("Authorization", basicAuthHeader(credentials));
    // Some browsers handle `application/json` parsing for us, but
    // we re-parse the response text below to keep the shape explicit.
    xhr.responseType = "text";

    if (signal !== undefined) {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress !== undefined) {
        onProgress(event.loaded / event.total);
      }
    });

    xhr.addEventListener("load", () => {
      const body = parseJson(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300 || isErrorBody(body)) {
        if (isErrorBody(body)) {
          const code = typeof body.code === "string" ? body.code : "BAD_REQUEST";
          reject(new ApiError(body.msg, code, xhr.status, body));
        } else {
          reject(
            new ApiError(
              `Upload failed with HTTP ${xhr.status}.`,
              "HTTP_ERROR",
              xhr.status,
            ),
          );
        }
        return;
      }
      const success = body as Record<string, unknown>;
      // Modern: `url`. Legacy: `uri`. Both point at the stored file.
      const url =
        (typeof success.url === "string" && success.url) ||
        (typeof success.uri === "string" && success.uri);
      if (!url) {
        reject(new ApiError("Upload response missing url.", "BAD_REQUEST", xhr.status));
        return;
      }
      const filename =
        typeof success.filename === "string" && success.filename !== ""
          ? success.filename
          : basename(url) || file.name;
      resolve({ url, filename });
    });

    xhr.addEventListener("error", () => {
      reject(new ApiError("Network request failed.", "NETWORK_ERROR", 0));
    });

    xhr.addEventListener("abort", () => {
      reject(abortError());
    });

    const form = new FormData();
    // Zulip's docs name the field `filename`; the server actually
    // accepts whichever single field name the form carries, but we
    // stick to the documented one for forward compatibility.
    form.append("filename", file, file.name);
    xhr.send(form);
  });
}

/**
 * Sanitise a filename for safe insertion into a Markdown link. The
 * server's docs explicitly call out that `[` and `]` in the link text
 * break Markdown rendering — replace them with their visually similar
 * fullwidth counterparts. Other characters pass through.
 */
export function sanitiseLinkText(filename: string): string {
  return filename.replace(/\[/g, "［").replace(/\]/g, "］");
}

/**
 * Build the Markdown snippet for an uploaded image vs. an arbitrary
 * file. Images get the `!` prefix so the server renders them inline
 * (Zulip's standard image-link syntax).
 */
export function uploadToMarkdown(
  result: UploadFileResult,
  isImage: boolean,
): string {
  const safeText = sanitiseLinkText(result.filename);
  const link = `[${safeText}](${result.url})`;
  return isImage ? `!${link}` : link;
}

/**
 * Whether the given MIME type renders inline as an image. Conservative
 * — anything we are not sure about gets the plain link treatment.
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function abortError(): ApiError {
  return new ApiError("Upload aborted.", "ABORTED", 0);
}

function parseJson(text: string): unknown {
  if (text === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { result?: unknown }).result === "error"
  );
}

function basename(url: string): string | undefined {
  const tail = url.split("/").pop();
  if (tail === undefined || tail === "") {
    return undefined;
  }
  // Strip URL fragment / query if any; user_uploads URLs do not carry
  // them in practice but the guard is cheap.
  return tail.split("?")[0]?.split("#")[0];
}
