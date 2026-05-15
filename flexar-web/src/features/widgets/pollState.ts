// Pure derivation of poll-widget state from a Message's submessages
// (Phase 4.7).
//
// A Zulip widget message's first submessage (msg_type="widget") carries
// the widget metadata as JSON: `{widget_type: "poll", extra_data:
// {question, options}}`. Each subsequent submessage records an event
// — `new_option` (any user adds an option), `vote` (any user toggles
// their vote on an option), `question` (author edits the question).
//
// Vote keys use the encoding `"<sender_id>,<idx>"`, with the literal
// string `"canned"` as the sender for the options that came with the
// initial widget metadata. This file mirrors that encoding so events
// recorded against canned options route correctly.
//
// Errors in the JSON are tolerated: the reducer simply skips the
// offending submessage. The render pipeline shouldn't crash because
// one event was malformed.

import type { Submessage } from "../../domain";

export interface PollOption {
  key: string;
  /** Display label for the option. */
  text: string;
  /** Voter ids in arrival order; duplicates are removed by the reducer. */
  voters: number[];
}

export interface PollState {
  question: string;
  options: PollOption[];
  /** Whether the current viewer (`viewerUserId`) has voted on key. */
  hasVoted: (key: string, viewerUserId: number) => boolean;
}

interface PollMeta {
  type: "poll";
  question: string;
  optionTexts: string[];
}

/**
 * Detect whether a message is a poll widget. Returns the parsed
 * metadata or `null` when the first submessage is missing,
 * non-widget, malformed, or carries a different `widget_type`.
 */
export function detectPoll(submessages: readonly Submessage[]): PollMeta | null {
  const first = submessages[0];
  if (first === undefined || first.msg_type !== "widget") {
    return null;
  }
  const parsed = parseJsonOrNull(first.content);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    (parsed as { widget_type?: unknown }).widget_type !== "poll"
  ) {
    return null;
  }
  const extra = (parsed as { extra_data?: unknown }).extra_data;
  if (extra === null || typeof extra !== "object") {
    return null;
  }
  const question = (extra as { question?: unknown }).question;
  const options = (extra as { options?: unknown }).options;
  if (!Array.isArray(options)) {
    return null;
  }
  const optionTexts = options.filter(
    (value): value is string => typeof value === "string",
  );
  return {
    type: "poll",
    question: typeof question === "string" ? question : "",
    optionTexts,
  };
}

/**
 * Build the live poll state by folding submessage events on top of
 * the initial widget metadata. Pass the message's `submessages` array
 * exactly as stored on the cached `Message` — the function does the
 * `detectPoll` check itself; if not a poll, returns `null`.
 */
export function derivePollState(
  submessages: readonly Submessage[],
): PollState | null {
  const meta = detectPoll(submessages);
  if (meta === null) {
    return null;
  }

  const optionsMap = new Map<string, PollOption>();
  // Seed canned options.
  meta.optionTexts.forEach((text, idx) => {
    const key = `canned,${idx}`;
    optionsMap.set(key, { key, text, voters: [] });
  });

  let question = meta.question;

  // Walk every submessage after the initial widget descriptor and
  // fold its event into the in-progress state.
  for (let i = 1; i < submessages.length; i++) {
    const sub = submessages[i];
    if (sub === undefined || sub.msg_type !== "widget") {
      continue;
    }
    const event = parseJsonOrNull(sub.content);
    if (event === null || typeof event !== "object") {
      continue;
    }
    const type = (event as { type?: unknown }).type;
    if (type === "new_option") {
      const optionRaw = (event as { option?: unknown }).option;
      const idxRaw = (event as { idx?: unknown }).idx;
      if (typeof optionRaw !== "string" || typeof idxRaw !== "number") {
        continue;
      }
      const key = `${sub.sender_id},${idxRaw}`;
      if (optionsMap.has(key)) {
        continue;
      }
      // Suppress duplicates by text — Zulip's web client does the same.
      const isDuplicate = Array.from(optionsMap.values()).some(
        (existing) => existing.text === optionRaw,
      );
      if (isDuplicate) {
        continue;
      }
      optionsMap.set(key, { key, text: optionRaw, voters: [] });
      continue;
    }
    if (type === "vote") {
      const keyRaw = (event as { key?: unknown }).key;
      const voteRaw = (event as { vote?: unknown }).vote;
      if (typeof keyRaw !== "string" || (voteRaw !== 1 && voteRaw !== -1)) {
        continue;
      }
      const option = optionsMap.get(keyRaw);
      if (option === undefined) {
        continue;
      }
      const voters = option.voters.filter((v) => v !== sub.sender_id);
      if (voteRaw === 1) {
        voters.push(sub.sender_id);
      }
      optionsMap.set(keyRaw, { ...option, voters });
      continue;
    }
    if (type === "question") {
      const next = (event as { question?: unknown }).question;
      if (typeof next === "string") {
        question = next;
      }
    }
  }

  const options = Array.from(optionsMap.values());
  return {
    question,
    options,
    hasVoted: (key, viewerUserId) =>
      optionsMap.get(key)?.voters.includes(viewerUserId) ?? false,
  };
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Build the JSON body for a vote toggle on `key`. Pass `currentlyVoted`
 * as the result of `hasVoted` so the toggle is correct.
 */
export function buildVoteContent(key: string, currentlyVoted: boolean): string {
  return JSON.stringify({
    type: "vote",
    key,
    vote: currentlyVoted ? -1 : 1,
  });
}

/**
 * Build the JSON body for adding a new option. The caller's `idx` is
 * the per-user counter (incremented locally each add).
 */
export function buildNewOptionContent(idx: number, option: string): string {
  return JSON.stringify({
    type: "new_option",
    idx,
    option,
  });
}
