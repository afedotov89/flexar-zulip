// Flexar Hub Web — compose-side typing emitter (Phase 4.3).
//
// Encapsulates the start/stop state machine the compose box uses to
// publish typing activity through `apiClient.sendTyping`. Returns:
//
//   - `onActivity()` — call on every keystroke. Emits a `start` once
//     per typing burst (debounced) and resets an idle timer.
//   - `sendStop()`  — call on send / conversation change / unmount.
//     Emits a `stop` if a `start` is currently outstanding.
//
// Auto-stops after `IDLE_STOP_MS` of inactivity. Aware of conversation
// changes: switching narrow flushes a `stop` for the old destination
// before tracking the new one.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiClient } from "../../api";
import type { SendTypingParams } from "../../api";
import type { ComposeFromNarrow } from "./composeFromNarrow";

/** How long after the last keystroke we stop typing on our own. */
const IDLE_STOP_MS = 5_000;

export interface UseTypingEmitterParams {
  fromNarrow: ComposeFromNarrow;
  /** Resolved channel id when the destination is a channel; undefined otherwise. */
  channelStreamId: number | undefined;
  /** Resolved topic when the destination is a channel-topic; "" otherwise. */
  topic: string;
  /** DM recipient ids (already parsed from the recipients input). */
  dmRecipientIds: number[];
}

export interface TypingEmitter {
  /** Called on every textarea change. */
  onActivity: () => void;
  /** Force an immediate `stop` if one is owed. */
  sendStop: () => void;
}

export function useTypingEmitter({
  fromNarrow,
  channelStreamId,
  topic,
  dmRecipientIds,
}: UseTypingEmitterParams): TypingEmitter {
  // Whether an outstanding `start` is in flight (we owe the server a `stop`).
  const isTypingRef = useRef(false);
  // Idle timer; reset on every keystroke. Null when not armed.
  const idleTimerRef = useRef<number | null>(null);

  // Build the destination snapshot the typing call needs. `null` when
  // the compose has no addressable target (e.g. unaddressed narrow).
  const destination = useMemo<SendTypingParams | null>(() => {
    if (fromNarrow.mode === "channel") {
      if (channelStreamId === undefined || topic === "") {
        return null;
      }
      return {
        op: "start",
        type: "stream",
        streamId: channelStreamId,
        topic,
      };
    }
    if (fromNarrow.mode === "direct") {
      if (dmRecipientIds.length === 0) {
        return null;
      }
      return { op: "start", type: "direct", to: [...dmRecipientIds] };
    }
    return null;
  }, [fromNarrow.mode, channelStreamId, topic, dmRecipientIds]);

  // Snapshot the destination at the moment of every emit so a switch
  // between bursts cannot reuse a stale target. Closes-over-destination
  // would otherwise race when the user changes channel mid-typing.
  const destinationRef = useRef<SendTypingParams | null>(destination);
  destinationRef.current = destination;

  // Send a `stop` for the *previous* destination synchronously when
  // the destination snapshot changes — without this, switching narrows
  // mid-typing would leave a stale "still typing" hanging on the
  // server-side TTL until it expired.
  const previousDestinationRef = useRef<SendTypingParams | null>(null);
  useEffect(() => {
    const prev = previousDestinationRef.current;
    if (prev !== null && isTypingRef.current) {
      void apiClient
        .sendTyping({ ...prev, op: "stop" } as SendTypingParams)
        .catch(() => {
          // Best-effort — the server's TTL bounds the staleness anyway.
        });
      isTypingRef.current = false;
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }
    previousDestinationRef.current = destination;
  }, [destination]);

  const sendStop = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!isTypingRef.current) {
      return;
    }
    isTypingRef.current = false;
    const dest = destinationRef.current;
    if (dest === null) {
      return;
    }
    void apiClient
      .sendTyping({ ...dest, op: "stop" } as SendTypingParams)
      .catch(() => {
        // ignored — see destination-change effect
      });
  }, []);

  const onActivity = useCallback(() => {
    const dest = destinationRef.current;
    if (dest === null) {
      return;
    }
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void apiClient
        .sendTyping({ ...dest, op: "start" } as SendTypingParams)
        .catch(() => {
          // ignored — start is best-effort; another keystroke retries.
        });
    }
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(sendStop, IDLE_STOP_MS);
  }, [sendStop]);

  // Flush on unmount so a navigation does not leave a stale start.
  useEffect(() => {
    return () => {
      sendStop();
    };
  }, [sendStop]);

  return { onActivity, sendStop };
}
