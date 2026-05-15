// Unit tests for the compose emoji picker (Phase 3.6).
//
// Covers the bundled corpus, the realm emoji surface (rendered as an
// `<img>` rather than a glyph), the search filter, and the click ->
// `onPick("/:shortcode:/")` contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RealmEmoji } from "../../../domain";
import { useRealmEmojiStore } from "../../../stores/realmEmojiStore";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import { ComposeEmojiPicker } from "./ComposeEmojiPicker";

function withTheme(node: React.ReactNode): React.ReactElement {
  return <ThemeProvider>{node}</ThemeProvider>;
}

function emoji(overrides: Partial<RealmEmoji>): RealmEmoji {
  return {
    id: "1",
    name: "flexar_logo",
    source_url: "/static/realm/flexar_logo.png",
    still_url: null,
    deactivated: false,
    author_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  useRealmEmojiStore.setState({ emojiById: {} });
});

afterEach(() => {
  useRealmEmojiStore.setState({ emojiById: {} });
  vi.restoreAllMocks();
});

describe("ComposeEmojiPicker", () => {
  it("renders bundled unicode entries from the corpus", () => {
    render(withTheme(<ComposeEmojiPicker onPick={() => {}} />));
    expect(screen.getByRole("gridcell", { name: ":wave:" })).toBeInTheDocument();
  });

  it("renders realm emoji as `<img>` cells from the realm-emoji store", () => {
    useRealmEmojiStore.setState({
      emojiById: { "1": emoji({ id: "1", name: "flexar_logo" }) },
    });
    render(withTheme(<ComposeEmojiPicker onPick={() => {}} />));
    const cell = screen.getByRole("gridcell", { name: ":flexar_logo:" });
    expect(cell.querySelector("img")?.getAttribute("src")).toBe(
      "/static/realm/flexar_logo.png",
    );
  });

  it("filters by substring on the shortcode", () => {
    useRealmEmojiStore.setState({
      emojiById: { "1": emoji({ id: "1", name: "flexar_logo" }) },
    });
    render(withTheme(<ComposeEmojiPicker onPick={() => {}} />));
    const search = screen.getByRole("textbox", { name: "Поиск эмодзи" });
    fireEvent.change(search, { target: { value: "flexar" } });
    expect(
      screen.getByRole("gridcell", { name: ":flexar_logo:" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("gridcell", { name: ":wave:" })).toBeNull();
  });

  it("calls onPick with `:shortcode:` markdown on click", () => {
    const onPick = vi.fn();
    render(withTheme(<ComposeEmojiPicker onPick={onPick} />));
    fireEvent.click(screen.getByRole("gridcell", { name: ":wave:" }));
    expect(onPick).toHaveBeenCalledWith(":wave:");
  });

  it("shows an empty-state message when the filter matches nothing", () => {
    render(withTheme(<ComposeEmojiPicker onPick={() => {}} />));
    fireEvent.change(screen.getByRole("textbox", { name: "Поиск эмодзи" }), {
      target: { value: "xyzzy-no-match" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Нет совпадений.");
  });
});
