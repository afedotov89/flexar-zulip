// Persistent narrow header above the message list.
//
// Without a header, the user lands in a feed with no visible "you are
// here" anchor — the recipient bars are interleaved in the scroll, the
// breadcrumb scrolls away with the content, and the left-sidebar
// highlight alone is too subtle. The header pins the current narrow's
// identity to the top of the column, in the same vein as Slack's
// channel header, Discord's channel chrome, and Zulip web's own
// `message_view_header`.
//
// Sticky inside the feed column (not the page), so it stays put
// regardless of scroll inside the message list. Renders for every
// narrow — channel, DM, built-in view (combined / mentions / starred
// / reactions), search, etc. — so the user always sees what filter
// the feed is currently under.
//
// The header is read-only chrome here: no actions yet (resolve topic,
// mute, etc.). Wire those in later iterations.

import { Icon } from "../../components/Icon";
import type { Narrow } from "../../domain";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import { summarizeNarrow } from "./narrowSummary";
import styles from "./NarrowHeader.module.css";

export interface NarrowHeaderProps {
  narrow: Narrow;
}

export function NarrowHeader({ narrow }: NarrowHeaderProps): React.JSX.Element {
  // Store selectors live on the store object — pulling them through
  // the hook keeps the header reactive to subscription / user
  // hydration so a channel-name lookup that lands after the initial
  // register doesn't leave the header showing a fallback forever.
  const getStream = useStreamsStore((state) => state.getStream);
  const getUser = useUsersStore((state) => state.getUser);

  const summary = summarizeNarrow(narrow, { getStream, getUser });

  // `<div>`, not `<header>`: the AppShell already exposes the page
  // banner via the top navbar, and `<header>` outside `<main>` would
  // surface a duplicate `role="banner"` landmark to assistive tech
  // (and indeed broke an AppShell test that asserted a single
  // banner). The visible affordance — sticky chrome with the current
  // narrow's name — is the same either way.
  return (
    <div className={styles.header}>
      <Icon name={summary.icon} size="sm" className={styles.icon} />
      <span className={styles.primary}>{summary.primary}</span>
      {summary.secondary !== undefined && (
        <>
          <span className={styles.separator} aria-hidden="true">
            ›
          </span>
          <span className={styles.secondary}>{summary.secondary}</span>
        </>
      )}
    </div>
  );
}
