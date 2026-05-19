// Persistent narrow header above the message list.
//
// Names the current narrow at the top of the feed column so the user
// always sees what filter the feed is under, in the same vein as
// Slack's channel header, Discord's channel chrome and Zulip web's
// `message_view_header`. Visually rendered by the shared
// `PageHeader` primitive — the chrome (sticky band, height,
// background, border-bottom) is owned by that primitive so the
// look matches every other page header (Recent, Inbox, …) byte for
// byte.

import { PageHeader } from "../../components/PageHeader";
import type { Narrow } from "../../domain";
import { useStreamsStore } from "../../stores/streamsStore";
import { useUsersStore } from "../../stores/usersStore";
import { summarizeNarrow } from "./narrowSummary";

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

  return (
    <PageHeader
      icon={summary.icon}
      title={summary.primary}
      subtitle={summary.secondary}
    />
  );
}
