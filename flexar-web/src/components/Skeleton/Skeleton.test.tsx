import { render } from "@testing-library/react";
import { Skeleton } from ".";

// Skeleton is a visual loading placeholder — always aria-hidden, with
// token-driven shape/size presets.

describe("Skeleton", () => {
  it("renders an aria-hidden placeholder", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild;
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the variant class for each variant", () => {
    const text = render(<Skeleton variant="text" />);
    const rect = render(<Skeleton variant="rect" />);
    const circle = render(<Skeleton variant="circle" />);
    expect(text.container.firstElementChild?.className).toMatch(/text/);
    expect(rect.container.firstElementChild?.className).toMatch(/rect/);
    expect(circle.container.firstElementChild?.className).toMatch(/circle/);
  });

  it("omits the width class for the circle variant (sized by height)", () => {
    const { container } = render(<Skeleton variant="circle" width="lg" />);
    expect(container.firstElementChild?.className).not.toMatch(/width/i);
  });

  it("applies width and height presets for text/rect", () => {
    const { container } = render(
      <Skeleton variant="rect" width="md" height="lg" />,
    );
    const className = container.firstElementChild?.className ?? "";
    expect(className).toMatch(/width/i);
    expect(className).toMatch(/height/i);
  });

  it("merges a custom className", () => {
    const { container } = render(<Skeleton className="custom" />);
    expect(container.firstElementChild?.className).toContain("custom");
  });
});
