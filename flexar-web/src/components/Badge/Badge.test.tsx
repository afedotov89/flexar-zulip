import { render, screen } from "@testing-library/react";
import { Badge } from ".";

// Badge is a small pill. It renders `children` as a label, or a
// numeric `count` capped by an optional `max` (rendered as "<max>+").

describe("Badge", () => {
  it("renders children as a label", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders a numeric count", () => {
    render(<Badge count={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("caps a count above max as '<max>+'", () => {
    render(<Badge count={150} max={99} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("renders the count as-is when equal to max", () => {
    render(<Badge count={99} max={99} />);
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("renders a zero count", () => {
    render(<Badge count={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("prefers count over children when both are given", () => {
    render(<Badge count={3}>ignored</Badge>);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  it("merges a custom className", () => {
    const { container } = render(<Badge className="custom">x</Badge>);
    expect(container.firstElementChild?.className).toContain("custom");
  });
});
