// Tests for `ReactionPickerButton` — the popover trigger that wraps
// `ReactionPicker`.

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactionPickerButton } from "./ReactionPickerButton";

describe("ReactionPickerButton", () => {
  it("toolbar variant renders an Add reaction icon button", () => {
    render(<ReactionPickerButton onPick={() => {}} variant="toolbar" />);
    expect(
      screen.getByRole("button", { name: "Add reaction" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the picker on click and closes it after a pick", () => {
    const onPick = vi.fn();
    render(<ReactionPickerButton onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("gridcell", { name: ":thumbs_up:" }));
    expect(onPick).toHaveBeenCalledWith({
      emoji_name: "thumbs_up",
      emoji_code: "1f44d",
      reaction_type: "unicode_emoji",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("inline variant renders a + chip-shaped trigger", () => {
    render(<ReactionPickerButton onPick={() => {}} variant="inline" />);
    const trigger = screen.getByRole("button", { name: "Add reaction" });
    expect(trigger).toHaveTextContent("+");
  });
});
