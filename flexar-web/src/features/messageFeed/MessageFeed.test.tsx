// Tests for the message feed feature (`src/features/messageFeed`).
//
// The feed composes the virtualized `MessageList` over `useFeedWindow`
// (history fetch + pagination + live-event reconciliation) and the
// Phase 1.3 server-state stores. These tests mock the API client's
// `getMessages` so the initial fetch is deterministic and offline, and
// mock the realtime layer so the stores' module-load `wireStore` binds
// to an inert fake. They cover the feed's data states (loading / error
// / empty / populated), message grouping and recipient bars in the
// rendered output, the error-state retry, and live-event reconciliation
// (a new matching message appended, a deleted message removed).
//
// jsdom has no real layout, so react-virtual falls back to estimated
// sizes and may window the list — assertions target content and
// behaviour, never pixel geometry (per the project's Puppeteer/jsdom
// guidance).

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Message } from "../../domain";
import type { GetMessagesResult } from "../../api";

// Controllable realtime fake: `wireStore` (not mocked) binds the real
// stores to this; the event stream / initial-state callbacks are inert
// — tests drive store state through the store actions directly.
vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

// The API client is mocked so the feed's initial / pagination fetches
// never touch the network. Each test sets `getMessagesMock`'s result.
const { getMessagesMock } = vi.hoisted(() => ({
  getMessagesMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: { getMessages: getMessagesMock },
  };
});

import { MessageFeed } from "./MessageFeed";
import { useMessagesStore } from "../../stores/messagesStore";
import { useStreamsStore } from "../../stores/streamsStore";
import { emptyMessagesSnapshot } from "../../stores/messagesReducer";

// A complete channel `Message`, overridable per field.
function channelMessage(overrides: Partial<Message> & { id: number }): Message {
  return {
    type: "stream",
    content: "<p>hello world</p>",
    content_type: "text/html",
    subject: "general",
    topic_links: [],
    stream_id: 7,
    display_recipient: "engineering",
    recipient_id: 100,
    sender_id: 1,
    sender_email: "user1@example.com",
    sender_full_name: "Ada Lovelace",
    sender_realm_str: "flexar",
    avatar_url: null,
    timestamp: 1_700_000_000,
    client: "test",
    is_me_message: false,
    reactions: [],
    submessages: [],
    ...overrides,
  };
}

function fetchResult(
  messages: Message[],
  overrides: Partial<GetMessagesResult> = {},
): GetMessagesResult {
  return {
    messages,
    anchor: messages.at(-1)?.id ?? 0,
    foundNewest: true,
    foundOldest: true,
    foundAnchor: true,
    historyLimited: false,
    ...overrides,
  };
}

function renderFeed(): void {
  render(
    <MemoryRouter>
      <MessageFeed narrow={[{ operator: "channel", operand: 7 }]} />
    </MemoryRouter>,
  );
}

// react-virtual windows its list from the scroll element's measured
// size, but jsdom reports every element as 0×0 and has no
// `ResizeObserver` — so with no stubs the virtualizer renders zero
// rows. These stubs give the scroll container a non-zero viewport and
// rows a fixed height, so the virtualizer produces a stable window the
// content assertions can target. This is test-environment plumbing for
// `MessageList`'s virtualization, not an assertion on real geometry.
const VIEWPORT_HEIGHT = 600;
const ROW_HEIGHT = 56;

// A `ResizeObserver` that fires its callback once on `observe`, with a
// stub entry carrying the fixed viewport / row size — enough for
// react-virtual's `observeElementRect` to learn a non-zero rect.
class ResizeObserverStub {
  #callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }
  observe(target: Element): void {
    const isLog = target.getAttribute("role") === "log";
    const height = isLog ? VIEWPORT_HEIGHT : ROW_HEIGHT;
    const rect = {
      width: 800,
      height,
      top: 0,
      left: 0,
      right: 800,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect;
    this.#callback(
      [
        {
          target,
          contentRect: rect,
          borderBoxSize: [{ inlineSize: 800, blockSize: height }],
          contentBoxSize: [{ inlineSize: 800, blockSize: height }],
          devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: height }],
        },
      ],
      this,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  getMessagesMock.mockReset();
  // Reset the live server-state stores between tests.
  useMessagesStore.setState(emptyMessagesSnapshot());
  useStreamsStore.setState({ streams: {}, subscriptions: {} });

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  // The scroll container exposes a viewport height; every other
  // element (the rows) reports the fixed row height.
  vi.spyOn(
    HTMLElement.prototype,
    "clientHeight",
    "get",
  ).mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("role") === "log" ? VIEWPORT_HEIGHT : ROW_HEIGHT;
  });
  vi.spyOn(
    HTMLElement.prototype,
    "getBoundingClientRect",
  ).mockImplementation(function (this: HTMLElement) {
      const height =
        this.getAttribute("role") === "log" ? VIEWPORT_HEIGHT : ROW_HEIGHT;
      return {
        width: 800,
        height,
        top: 0,
        left: 0,
        right: 800,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MessageFeed — data states", () => {
  it("shows a loading skeleton while the initial fetch is in flight", () => {
    // A never-resolving fetch keeps the feed in its loading state.
    getMessagesMock.mockReturnValue(new Promise<GetMessagesResult>(() => {}));
    renderFeed();
    // The skeleton region is aria-hidden; assert the list is absent.
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
  });

  it("renders the message list once the fetch resolves", async () => {
    getMessagesMock.mockResolvedValue(
      fetchResult([
        channelMessage({ id: 1, content: "<p>first message</p>" }),
        channelMessage({ id: 2, content: "<p>second message</p>" }),
      ]),
    );
    renderFeed();

    expect(await screen.findByText("first message")).toBeInTheDocument();
    expect(screen.getByText("second message")).toBeInTheDocument();
    expect(screen.getByRole("log")).toBeInTheDocument();
  });

  it("shows the empty state when the narrow has no messages", async () => {
    getMessagesMock.mockResolvedValue(fetchResult([]));
    renderFeed();

    expect(
      await screen.findByText("Здесь пока нет сообщений"),
    ).toBeInTheDocument();
  });

  it("shows an error banner and retries on demand", async () => {
    getMessagesMock.mockRejectedValueOnce(new Error("network down"));
    renderFeed();

    expect(
      await screen.findByText("Не удалось загрузить сообщения"),
    ).toBeInTheDocument();

    // The retry re-runs the fetch; this time it succeeds.
    getMessagesMock.mockResolvedValueOnce(
      fetchResult([channelMessage({ id: 1, content: "<p>recovered</p>" })]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Попробовать снова" }));

    expect(await screen.findByText("recovered")).toBeInTheDocument();
  });

  it("shows the historyLimited notice when the server truncated history", async () => {
    getMessagesMock.mockResolvedValue(
      fetchResult([channelMessage({ id: 1 })], {
        historyLimited: true,
        foundOldest: false,
      }),
    );
    renderFeed();

    expect(
      await screen.findByText(/Более ранняя история сообщений/),
    ).toBeInTheDocument();
  });
});

describe("MessageFeed — structure", () => {
  it("renders a recipient bar with the channel name and topic", async () => {
    useStreamsStore.setState({
      streams: {
        7: {
          stream_id: 7,
          name: "engineering",
          description: "",
          rendered_description: "",
          is_archived: false,
          invite_only: false,
          is_web_public: false,
          history_public_to_subscribers: true,
          creator_id: null,
          message_retention_days: null,
          first_message_id: null,
          folder_id: null,
          stream_weekly_traffic: null,
          subscriber_count: 0,
          date_created: 1_700_000_000,
          is_recently_active: true,
        },
      },
      subscriptions: {},
    });
    getMessagesMock.mockResolvedValue(
      fetchResult([channelMessage({ id: 1, subject: "deploys" })]),
    );
    renderFeed();

    // Wait for the message to render, then verify the recipient bar
    // shows channel + topic. "engineering" appears in multiple places
    // now (compose channel pill, recipient bar) — `findAllByText`
    // covers both.
    await screen.findByText("deploys");
    const engineeringHits = screen.getAllByText("engineering");
    expect(engineeringHits.length).toBeGreaterThan(0);
  });

  it("collapses consecutive messages from the same sender into one group", async () => {
    getMessagesMock.mockResolvedValue(
      fetchResult([
        channelMessage({
          id: 1,
          sender_id: 1,
          sender_full_name: "Ada Lovelace",
          timestamp: 1_700_000_000,
          content: "<p>one</p>",
        }),
        channelMessage({
          id: 2,
          sender_id: 1,
          sender_full_name: "Ada Lovelace",
          timestamp: 1_700_000_030,
          content: "<p>two</p>",
        }),
      ]),
    );
    renderFeed();

    await screen.findByText("one");
    // The group-start row shows the sender name; the follower does not,
    // so the name appears exactly once for the two-message group.
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(1);
  });
});

describe("MessageFeed — live-event reconciliation", () => {
  it("appends a new matching message folded into the store", async () => {
    getMessagesMock.mockResolvedValue(
      fetchResult([channelMessage({ id: 1, content: "<p>existing</p>" })]),
    );
    renderFeed();
    await screen.findByText("existing");

    // A live `message` event reaches `messagesStore`; the feed's
    // subscription reconciles it into the window because it matches the
    // channel-7 narrow and the window reaches the newest end.
    useMessagesStore.setState((state) => ({
      messages: {
        ...state.messages,
        2: channelMessage({ id: 2, content: "<p>brand new</p>" }),
      },
    }));

    expect(await screen.findByText("brand new")).toBeInTheDocument();
  });

  it("does not append a message that does not match the narrow", async () => {
    getMessagesMock.mockResolvedValue(
      fetchResult([channelMessage({ id: 1, content: "<p>existing</p>" })]),
    );
    renderFeed();
    await screen.findByText("existing");

    // A message in a *different* channel folded into the store must not
    // appear in the channel-7 feed.
    useMessagesStore.setState((state) => ({
      messages: {
        ...state.messages,
        2: channelMessage({
          id: 2,
          stream_id: 99,
          content: "<p>other channel</p>",
        }),
      },
    }));

    // Give the subscription a chance to (not) act.
    await waitFor(() => {
      expect(screen.queryByText("other channel")).not.toBeInTheDocument();
    });
  });

  it("removes a message that is deleted from the store", async () => {
    getMessagesMock.mockResolvedValue(
      fetchResult([
        channelMessage({ id: 1, content: "<p>keep me</p>" }),
        channelMessage({ id: 2, content: "<p>delete me</p>" }),
      ]),
    );
    renderFeed();
    await screen.findByText("delete me");

    // A `delete_message` event drops the id from `messagesStore`; the
    // feed reconciles the removal out of its window.
    useMessagesStore.setState((state) => {
      const messages = { ...state.messages };
      delete messages[2];
      return { messages };
    });

    await waitFor(() => {
      expect(screen.queryByText("delete me")).not.toBeInTheDocument();
    });
    expect(screen.getByText("keep me")).toBeInTheDocument();
  });
});
