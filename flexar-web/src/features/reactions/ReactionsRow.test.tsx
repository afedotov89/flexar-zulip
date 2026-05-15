// Tests for `ReactionsRow` — chip rendering, toggle wiring, "+" picker.
//
// The toggle is supplied by `useReactionToggle` in production; tests
// drive `ReactionsRow` directly with a stub `toggle` so the rendering /
// click contract is exercised in isolation. `useReactionToggle` itself
// (REST + revert) is covered in `useReactionToggle.test.tsx`.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Message, Reaction } from "../../domain";
import { useUsersStore } from "../../stores/usersStore";
import { ReactionsRow } from "./ReactionsRow";

function makeUser(id: number, full_name: string): void {
  useUsersStore.setState((state) => ({
    users: {
      ...state.users,
      [id]: {
        user_id: id,
        email: `u${id}@x`,
        delivery_email: null,
        full_name,
        date_joined: "2024-01-01T00:00:00Z",
        is_active: true,
        is_owner: false,
        is_admin: false,
        is_guest: false,
        is_bot: false,
        bot_type: null,
        bot_owner_id: null,
        role: 400,
        timezone: "",
        avatar_url: null,
        avatar_version: 1,
        is_imported_stub: false,
      },
    },
  }));
}

function r(
  user_id: number,
  emoji_code: string,
  emoji_name: string,
  reaction_type: Reaction["reaction_type"] = "unicode_emoji",
): Reaction {
  return { user_id, emoji_code, emoji_name, reaction_type };
}

function msg(reactions: Reaction[]): Message {
  return {
    id: 100,
    type: "stream",
    content: "<p>hi</p>",
    content_type: "text/html",
    subject: "t",
    topic_links: [],
    stream_id: 1,
    display_recipient: "x",
    recipient_id: 1,
    sender_id: 1,
    sender_email: "s@x",
    sender_full_name: "Sender",
    sender_realm_str: "x",
    avatar_url: null,
    timestamp: 0,
    client: "test",
    is_me_message: false,
    reactions,
    submessages: [],
  };
}

beforeEach(() => {
  useUsersStore.setState({ users: {} });
});

describe("ReactionsRow", () => {
  it("renders nothing for a message with no reactions and no error", () => {
    const { container } = render(
      <ReactionsRow
        message={msg([])}
        viewerId={7}
        toggle={vi.fn()}
        errorMessage={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a chip per emoji with the count and the unicode glyph", () => {
    makeUser(1, "Alice");
    makeUser(2, "Bob");
    render(
      <ReactionsRow
        message={msg([
          r(1, "1f44d", "thumbs_up"),
          r(2, "1f44d", "thumbs_up"),
        ])}
        viewerId={undefined}
        toggle={vi.fn()}
        errorMessage={null}
      />,
    );
    const chip = screen.getByRole("button", {
      name: /reacted with :thumbs_up:/,
    });
    expect(chip).toHaveTextContent("👍");
    expect(chip).toHaveTextContent("2");
    // Picker affordance appears once at least one chip is shown.
    expect(
      screen.getByRole("button", { name: "Add reaction" }),
    ).toBeInTheDocument();
  });

  it("falls back to :colons: for non-unicode reaction types", () => {
    makeUser(1, "Alice");
    render(
      <ReactionsRow
        message={msg([r(1, "abc", "octocat", "realm_emoji")])}
        viewerId={undefined}
        toggle={vi.fn()}
        errorMessage={null}
      />,
    );
    const chip = screen.getByRole("button", {
      name: /reacted with :octocat:/,
    });
    expect(chip).toHaveTextContent(":octocat:");
  });

  it("clicking a chip the viewer reacted with calls toggle(emoji, true)", () => {
    makeUser(7, "Hamlet");
    const toggle = vi.fn();
    render(
      <ReactionsRow
        message={msg([r(7, "1f44d", "thumbs_up")])}
        viewerId={7}
        toggle={toggle}
        errorMessage={null}
      />,
    );
    const chip = screen.getByRole("button", { name: /thumbs_up/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    expect(toggle).toHaveBeenCalledWith(
      {
        emoji_name: "thumbs_up",
        emoji_code: "1f44d",
        reaction_type: "unicode_emoji",
      },
      true,
    );
  });

  it("clicking a chip the viewer did not react with calls toggle(emoji, false)", () => {
    makeUser(1, "Alice");
    const toggle = vi.fn();
    render(
      <ReactionsRow
        message={msg([r(1, "1f44d", "thumbs_up")])}
        viewerId={7}
        toggle={toggle}
        errorMessage={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /thumbs_up/ }));
    expect(toggle).toHaveBeenCalledWith(
      expect.objectContaining({ emoji_code: "1f44d" }),
      false,
    );
  });

  it("picking a fresh emoji from the inline picker calls toggle(.., false)", () => {
    makeUser(1, "Alice");
    const toggle = vi.fn();
    render(
      <ReactionsRow
        message={msg([r(1, "2764-fe0f", "heart")])}
        viewerId={7}
        toggle={toggle}
        errorMessage={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
    fireEvent.click(screen.getByRole("gridcell", { name: ":thumbs_up:" }));
    expect(toggle).toHaveBeenCalledWith(
      {
        emoji_name: "thumbs_up",
        emoji_code: "1f44d",
        reaction_type: "unicode_emoji",
      },
      false,
    );
  });

  it("renders the error line when errorMessage is non-null", () => {
    render(
      <ReactionsRow
        message={msg([])}
        viewerId={7}
        toggle={vi.fn()}
        errorMessage="Could not update reaction."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not update reaction.",
    );
  });

  it("includes the viewer in the tooltip label as 'You'", () => {
    makeUser(1, "Alice");
    render(
      <ReactionsRow
        message={msg([
          r(1, "1f44d", "thumbs_up"),
          r(7, "1f44d", "thumbs_up"),
        ])}
        viewerId={7}
        toggle={vi.fn()}
        errorMessage={null}
      />,
    );
    const chip = screen.getByRole("button", {
      name: "Alice and You reacted with :thumbs_up:",
    });
    expect(chip).toBeInTheDocument();
  });
});
