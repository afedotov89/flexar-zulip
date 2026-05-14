import { render, screen } from "@testing-library/react";
import { ScrollArea } from ".";

// ScrollArea is a thin styled native-overflow container. It is
// keyboard-focusable and applies an orientation class.

describe("ScrollArea", () => {
  it("renders its children", () => {
    render(
      <ScrollArea>
        <p>scrollable content</p>
      </ScrollArea>,
    );
    expect(screen.getByText("scrollable content")).toBeInTheDocument();
  });

  it("is keyboard-focusable", () => {
    const { container } = render(<ScrollArea>x</ScrollArea>);
    expect(container.firstElementChild).toHaveAttribute("tabindex", "0");
  });

  it("applies the vertical orientation class by default", () => {
    const { container } = render(<ScrollArea>x</ScrollArea>);
    const classes = container.firstElementChild?.className ?? "";
    expect(classes).toContain("vertical");
    expect(classes).not.toContain("horizontal");
  });

  it("applies the horizontal orientation class", () => {
    const { container } = render(
      <ScrollArea orientation="horizontal">x</ScrollArea>,
    );
    expect(container.firstElementChild?.className).toContain("horizontal");
  });

  it("applies the both orientation class", () => {
    const { container } = render(<ScrollArea orientation="both">x</ScrollArea>);
    expect(container.firstElementChild?.className).toContain("both");
  });

  it("merges a custom className", () => {
    const { container } = render(
      <ScrollArea className="custom">x</ScrollArea>,
    );
    expect(container.firstElementChild?.className).toContain("custom");
  });
});
