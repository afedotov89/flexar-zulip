import { render, screen, fireEvent } from "@testing-library/react";
import { Avatar } from ".";

// Avatar renders the image at `src` when present, and falls back to
// initials derived from `name` on a missing or broken `src`. `name`
// is always the accessible label / alt text.

describe("Avatar", () => {
  it("renders the image with name as alt text when src is given", () => {
    render(<Avatar src="https://example.com/a.png" name="Ada Lovelace" />);
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://example.com/a.png");
  });

  it("renders initials fallback when src is missing", () => {
    render(<Avatar name="Ada Lovelace" />);
    const avatar = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(avatar.tagName).not.toBe("IMG");
    expect(avatar).toHaveTextContent("AL");
  });

  it("derives a single initial from a one-word name", () => {
    render(<Avatar name="Ada" />);
    expect(screen.getByRole("img", { name: "Ada" })).toHaveTextContent("A");
  });

  it("falls back to initials when the image fails to load", () => {
    render(<Avatar src="https://example.com/broken.png" name="Grace Hopper" />);
    const img = screen.getByRole("img", { name: "Grace Hopper" });
    fireEvent.error(img);
    const fallback = screen.getByRole("img", { name: "Grace Hopper" });
    expect(fallback.tagName).not.toBe("IMG");
    expect(fallback).toHaveTextContent("GH");
  });

  it("merges a custom className", () => {
    const { container } = render(<Avatar name="Ada" className="custom" />);
    expect(container.firstElementChild?.className).toContain("custom");
  });

  it("gives the initials fallback a stable palette colour per name", () => {
    const first = render(<Avatar name="Ada Lovelace" />);
    const firstClass = first.container.firstElementChild?.className ?? "";
    first.unmount();
    // Same name -> same colour class on a fresh render.
    const second = render(<Avatar name="Ada Lovelace" />);
    expect(second.container.firstElementChild?.className).toBe(firstClass);
    second.unmount();
    // A different name resolves to a (different) palette class; both
    // carry exactly one `color*` modifier.
    const other = render(<Avatar name="Grace Hopper" />);
    const otherClass = other.container.firstElementChild?.className ?? "";
    expect(firstClass).toMatch(/color[1-5]/);
    expect(otherClass).toMatch(/color[1-5]/);
  });
});
