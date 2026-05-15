// Tests for `ReactionPicker` — the popover contents that lets the user
// search and pick an emoji.

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactionPicker } from "./ReactionPicker";

describe("ReactionPicker", () => {
  it("renders a search input and the full corpus by default", () => {
    render(<ReactionPicker onPick={() => {}} />);
    expect(screen.getByLabelText("Find emoji")).toBeInTheDocument();
    // Sanity: a known popular emoji from the corpus is offered.
    expect(
      screen.getByRole("gridcell", { name: ":thumbs_up:" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: ":heart:" }),
    ).toBeInTheDocument();
  });

  it("filters the grid by substring on shortcode", () => {
    render(<ReactionPicker onPick={() => {}} />);
    const input = screen.getByLabelText("Find emoji");
    fireEvent.change(input, { target: { value: "thumbs" } });
    expect(
      screen.getByRole("gridcell", { name: ":thumbs_up:" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("gridcell", { name: ":heart:" }),
    ).toBeNull();
  });

  it("shows an empty-state when nothing matches", () => {
    render(<ReactionPicker onPick={() => {}} />);
    fireEvent.change(screen.getByLabelText("Find emoji"), {
      target: { value: "zzz_no_such_emoji_zzz" },
    });
    expect(screen.queryAllByRole("gridcell")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No emoji match.");
  });

  it("calls onPick with the unicode_emoji identity when a cell is clicked", () => {
    const onPick = vi.fn();
    render(<ReactionPicker onPick={onPick} />);
    fireEvent.click(screen.getByRole("gridcell", { name: ":thumbs_up:" }));
    expect(onPick).toHaveBeenCalledWith({
      emoji_name: "thumbs_up",
      emoji_code: "1f44d",
      reaction_type: "unicode_emoji",
    });
  });

  it("ArrowDown from the search input moves focus into the grid", () => {
    render(<ReactionPicker onPick={() => {}} />);
    const input = screen.getByLabelText("Find emoji");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const cells = screen.getAllByRole("gridcell");
    expect(document.activeElement).toBe(cells[0]);
  });

  it("ArrowRight on a cell moves focus to the next cell", () => {
    render(<ReactionPicker onPick={() => {}} />);
    const cells = screen.getAllByRole("gridcell");
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[1]);
  });

  it("ArrowUp from the top row returns focus to the search input", () => {
    render(<ReactionPicker onPick={() => {}} />);
    const cells = screen.getAllByRole("gridcell");
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByLabelText("Find emoji"));
  });
});
