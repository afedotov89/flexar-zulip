// Tests for `ReactionChip` — the pill-shaped chip in the reactions row.

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactionChipModel } from "./groupReactions";
import { ReactionChip } from "./ReactionChip";

function model(over: Partial<ReactionChipModel> = {}): ReactionChipModel {
  return {
    key: "unicode_emoji:1f44d",
    reactionType: "unicode_emoji",
    emojiCode: "1f44d",
    emojiName: "thumbs_up",
    userIds: [1],
    count: 1,
    viewerReacted: false,
    ...over,
  };
}

describe("ReactionChip", () => {
  it("renders the glyph, the count, and the accessible label", () => {
    render(
      <ReactionChip
        chip={model()}
        glyph="👍"
        tooltipLabel="Alice reacted with :thumbs_up:"
        onClick={() => {}}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Alice reacted with :thumbs_up:",
    });
    expect(button).toHaveTextContent("👍");
    expect(button).toHaveTextContent("1");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("flags aria-pressed when the viewer reacted", () => {
    render(
      <ReactionChip
        chip={model({ viewerReacted: true, count: 2, userIds: [1, 7] })}
        glyph="👍"
        tooltipLabel="You and Alice reacted with :thumbs_up:"
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onClick when activated", () => {
    const onClick = vi.fn();
    render(
      <ReactionChip
        chip={model()}
        glyph="👍"
        tooltipLabel="Alice reacted with :thumbs_up:"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
