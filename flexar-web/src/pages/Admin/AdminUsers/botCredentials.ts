// Helpers for the bot management surfaces: formatting the synthetic
// bot email Zulip constructs from `short_name`, and assembling a
// `zuliprc` text file the user can save and pass to scripts.
//
// Zulip composes bot emails as `<short_name>-bot@<realm_host>`. Doing
// it on the client lets us preview the address while the user is
// still typing the short name, before any round-trip to the server.
//
// The `zuliprc` format is INI: a single `[api]` section with `email`,
// `key`, and `site` keys (the Zulip CLI / python-zulip-api standard).
// `downloadZuliprc` builds the text and triggers a browser download
// — no library needed.

/** Strip the protocol + path from the realm URL so we get a bare host. */
function realmHost(realmUrl: string | undefined): string {
  if (realmUrl === undefined || realmUrl === "") {
    return "zulipchat.com";
  }
  try {
    return new URL(realmUrl).host;
  } catch {
    return realmUrl;
  }
}

/**
 * Mirror the server's bot-email format: `<short_name>-bot@<host>`.
 * `realmUrl` is the realm's base URL (`https://chat.example.com`);
 * the local-part is the user-supplied short name.
 */
export function formatBotEmail(
  shortName: string,
  realmUrl: string | undefined,
): string {
  return `${shortName}-bot@${realmHost(realmUrl)}`;
}

export interface ZuliprcParams {
  email: string;
  apiKey: string;
  shortName: string;
  realmUrl: string | undefined;
}

/**
 * Build a `zuliprc` text body and trigger a browser download with
 * the bot's short name as the filename. Returns the body for tests.
 */
export function downloadZuliprc(params: ZuliprcParams): string {
  const site =
    params.realmUrl !== undefined && params.realmUrl !== ""
      ? params.realmUrl
      : "https://localhost";
  const body =
    `[api]\n` +
    `email=${params.email}\n` +
    `key=${params.apiKey}\n` +
    `site=${site}\n`;
  // jsdom doesn't implement URL.createObjectURL; guarding lets tests
  // assert on the returned string without stubbing the global URL.
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return body;
  }
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${params.shortName}.zuliprc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return body;
}
