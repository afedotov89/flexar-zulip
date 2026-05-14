// Flexar Hub Web — detect in-app narrow links inside rendered message
// content.
//
// Zulip's server-rendered HTML contains links that point *into the
// realm* — channel links, topic links, `#**channel>topic**` mentions,
// `near`/message links — encoded in Zulip's own legacy hash format:
//
//     /#narrow/channel/7-general/topic/hello%20world
//     https://chat.example.com/#narrow/channel/7-general
//
// In Flexar Hub these should not trigger a full-page navigation to a
// Zulip URL; they should route the SPA to the corresponding narrow.
// This module recognises such links and decodes them into a domain
// `Narrow`, reusing the existing narrow codec (`src/lib/narrow`) rather
// than re-implementing operand parsing.
//
// Detection strategy and its limits:
//
//   - A link is an in-app narrow link iff, after resolving it against
//     the document, its `pathname + hash` contains a `#narrow/…`
//     fragment AND (when it is absolute) its origin matches the realm's
//     `realm_url`. A relative `/#narrow/…` link is always in-realm.
//   - The hash fragment (`narrow/channel/7-general/topic/foo`) is
//     transformed into this app's path form (`/narrow/channel/7-general/
//     topic/foo`) and handed to `parseNarrowPath`. The two schemes use
//     the same operator segment names and the same operand encodings
//     (numeric channel ids with decorative slugs, percent-encoded
//     topics, dash-joined operators), so the transform is a literal
//     prefix swap.
//   - If anything is ambiguous — the link is cross-realm, the hash is
//     not a `narrow/…` fragment, or the codec rejects the operands —
//     this returns `null` and the caller falls back to opening the link
//     normally. Being conservative here is safe: the worst case is a
//     normal navigation instead of an in-app one, never a broken route.
//
// Known limitation: Zulip also supports `near`/`with` message-id links
// and `#narrow` fragments with search operators; those that the codec
// understands route correctly, the rest fall back to a normal open.

import type { Narrow } from "../../domain";
import { NARROW_ROOT, parseNarrowPath } from "../narrow";

// The hash fragment Zulip uses to encode a narrow, without the `#`.
const ZULIP_NARROW_HASH_PREFIX = "narrow/";

/**
 * If `href` is an in-app Zulip narrow link, return the `Narrow` it
 * addresses; otherwise return `null` (external link, non-narrow link,
 * or an unparseable narrow — all of which the caller should open
 * normally).
 *
 * `realmUrl` is the realm's base URL (`Realm.realm_url`); when it is
 * absent, only root-relative `/#narrow/…` links can be recognised as
 * in-app, since there is no origin to match an absolute URL against.
 */
export function parseNarrowLink(
  href: string,
  realmUrl: string | undefined,
): Narrow | null {
  let url: URL;
  try {
    // Resolve relative links against the realm URL when we have one,
    // otherwise against the current document. A bare `/#narrow/…` href
    // resolves fine against either.
    url = new URL(href, realmUrl ?? window.location.href);
  } catch {
    // Malformed href — not something we can route. Open normally.
    return null;
  }

  // For an absolute link, the origin must be the realm's. Without a
  // realm URL we cannot verify cross-realm links, so we only accept
  // ones whose origin matches the current document's.
  const expectedOrigin = realmUrl
    ? safeOrigin(realmUrl)
    : window.location.origin;
  if (expectedOrigin === null || url.origin !== expectedOrigin) {
    return null;
  }

  // The narrow lives in the URL hash: `#narrow/channel/7-general/...`.
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash.startsWith(ZULIP_NARROW_HASH_PREFIX) && hash !== "narrow") {
    return null;
  }

  // Transform Zulip's `narrow/<op>/<operand>/…` hash into this app's
  // path form (`/narrow/<op>/<operand>/…`) and let the shared codec
  // decode it. Operator names and operand encodings are common to both
  // schemes, so this is a literal prefix swap.
  const appPath = `${NARROW_ROOT}/${hash.slice(ZULIP_NARROW_HASH_PREFIX.length)}`;
  const result = parseNarrowPath(
    hash === "narrow" ? NARROW_ROOT : appPath,
  );
  return result.ok ? result.narrow : null;
}

// Parse an origin out of a URL string, returning `null` if it is not a
// valid absolute URL (rather than throwing).
function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
