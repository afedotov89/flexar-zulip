import { render } from "@testing-library/react";
import { Icon } from ".";
import { iconNames } from "../../icons";

// Icon renders SVG geometry from Flexar Hub's own icon set. By default
// it is decorative (`aria-hidden`); an `aria-label` promotes it to
// `role="img"`.

describe("Icon", () => {
  it("renders an <svg> with the icon geometry", () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("circle")).not.toBeNull();
  });

  it("is decorative (aria-hidden) by default", () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("becomes role=img with an accessible name when aria-label is given", () => {
    const { getByRole } = render(<Icon name="bell" aria-label="Notifications" />);
    const svg = getByRole("img", { name: "Notifications" });
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("applies the size class and merges a custom className", () => {
    const { container } = render(
      <Icon name="plus" size="lg" className="custom" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.className.baseVal).toContain("custom");
  });

  it("ships every icon in the exported name list without throwing", () => {
    for (const name of iconNames) {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelector("svg")?.innerHTML).not.toBe("");
    }
  });
});
