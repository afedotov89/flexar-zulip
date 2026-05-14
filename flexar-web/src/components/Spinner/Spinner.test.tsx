import { render, screen } from "@testing-library/react";
import { Spinner } from ".";

// Spinner is an indeterminate loading indicator exposed as
// `role="status"` with a visually-hidden accessible label.

describe("Spinner", () => {
  it("exposes role=status with a default accessible label", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("uses a custom accessible label", () => {
    render(<Spinner aria-label="Sending message" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sending message");
  });

  it("merges a custom className", () => {
    const { container } = render(<Spinner className="custom" size="lg" />);
    expect(container.firstElementChild?.className).toContain("custom");
  });
});
