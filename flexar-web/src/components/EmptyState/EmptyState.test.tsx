// EmptyState — small primitive but worth a few sanity tests for the
// tone-based role switch and the conditional slots.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders just the title by default", () => {
    render(<EmptyState title="Здесь пусто" />);
    expect(screen.getByText("Здесь пусто")).toBeInTheDocument();
  });

  it("uses role=status for empty/muted tones", () => {
    render(<EmptyState title="ok" tone="empty" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses role=alert for the error tone", () => {
    render(<EmptyState title="oops" tone="error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders optional description and action slots", () => {
    render(
      <EmptyState
        title="No matches"
        description="Try a different filter."
        action={<button type="button">Reset</button>}
      />,
    );
    expect(screen.getByText("Try a different filter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("renders the leading icon when provided", () => {
    const { container } = render(<EmptyState title="x" icon="inbox" />);
    // The Icon primitive renders an <svg>; assert one is present.
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
