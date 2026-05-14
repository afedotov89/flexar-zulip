import { render, screen } from "@testing-library/react";
import { Divider } from ".";

// Divider renders a semantic <hr> when horizontal and a
// role="separator" element with aria-orientation when vertical.

describe("Divider", () => {
  it("renders a semantic <hr> by default (horizontal)", () => {
    const { container } = render(<Divider />);
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
  });

  it("renders role=separator with vertical orientation", () => {
    render(<Divider orientation="vertical" />);
    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator.tagName).toBe("DIV");
  });

  it("applies a spacing modifier class", () => {
    const { container } = render(<Divider spacing="md" />);
    // the className list carries more than just the base/orientation classes.
    expect(container.firstElementChild?.className.split(" ").length).toBe(3);
  });

  it("merges a custom className", () => {
    const { container } = render(<Divider className="custom" />);
    expect(container.firstElementChild?.className).toContain("custom");
  });
});
