// Flexar Hub Web — spoiler block behaviour for rendered message content.
//
// Zulip's renderer emits a spoiler as:
//
//   <div class="spoiler-block">
//     <div class="spoiler-header">…header markdown…</div>
//     <div class="spoiler-content" aria-hidden="true">…body markdown…</div>
//   </div>
//
// The header is a plain `<div>` with no interactivity of its own —
// clicking it should reveal/hide the body. This module supplies that
// behaviour for the `MessageContent` container:
//
//   - `decorateSpoilers` runs once after the sanitised HTML is in the
//     DOM. It makes each header a real, accessible toggle: `role`,
//     `tabindex`, `aria-expanded`, `aria-controls` pointing at the
//     body, and the initial collapsed visual state.
//   - `toggleSpoiler` flips one header's state. `MessageContent`'s
//     delegated click / keydown handlers call it.
//
// State is expressed entirely through the `aria-expanded` attribute on
// the header and an `aria-hidden` attribute plus an `--open` modifier
// class on the body; the CSS keys the show/hide off those. No inline
// styles, so it stays within the project's styling rules.

// Class names from Zulip's renderer contract. The `*Open` class is the
// app's own modifier (the project does not reuse Zulip's CSS), applied
// to the body element to drive the open-state styling.
const SPOILER_HEADER_CLASS = "spoiler-header";
const SPOILER_CONTENT_CLASS = "spoiler-content";
const SPOILER_CONTENT_OPEN_CLASS = "spoiler-content-open";

let spoilerIdCounter = 0;

// Mark a header as already decorated so re-running `decorateSpoilers`
// (e.g. after a content re-render that reuses nodes) is idempotent.
const DECORATED_FLAG = "data-spoiler-decorated";

/**
 * Make every spoiler header inside `container` an accessible toggle.
 * Idempotent: headers already decorated are skipped.
 */
export function decorateSpoilers(container: HTMLElement): void {
  const headers = container.querySelectorAll<HTMLElement>(
    `.${SPOILER_HEADER_CLASS}`,
  );
  for (const header of headers) {
    if (header.getAttribute(DECORATED_FLAG) === "true") {
      continue;
    }
    const body = findSpoilerBody(header);
    if (body === null) {
      continue;
    }

    // Give the body a stable id so the header can `aria-controls` it.
    if (body.id === "") {
      spoilerIdCounter += 1;
      body.id = `spoiler-content-${spoilerIdCounter}`;
    }

    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");
    header.setAttribute("aria-controls", body.id);
    body.setAttribute("aria-hidden", "true");
    body.classList.remove(SPOILER_CONTENT_OPEN_CLASS);
    header.setAttribute(DECORATED_FLAG, "true");
  }
}

/**
 * Toggle the spoiler whose header is `header`, updating the ARIA state
 * on the header and the visibility state on the body.
 */
export function toggleSpoiler(header: HTMLElement): void {
  const body = findSpoilerBody(header);
  if (body === null) {
    return;
  }
  const willOpen = header.getAttribute("aria-expanded") !== "true";
  header.setAttribute("aria-expanded", willOpen ? "true" : "false");
  body.setAttribute("aria-hidden", willOpen ? "false" : "true");
  body.classList.toggle(SPOILER_CONTENT_OPEN_CLASS, willOpen);
}

// The body of a spoiler is the `.spoiler-content` sibling of its
// header within the same `.spoiler-block`.
function findSpoilerBody(header: HTMLElement): HTMLElement | null {
  let sibling = header.nextElementSibling;
  while (sibling !== null) {
    if (
      sibling instanceof HTMLElement &&
      sibling.classList.contains(SPOILER_CONTENT_CLASS)
    ) {
      return sibling;
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
}
