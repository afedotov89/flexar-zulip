import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Toggle } from ".";

// Toggle is an on/off switch built on <input type="checkbox"> with
// role="switch". It supports an associated label, checked and disabled
// states, and a sm | md size subset.

describe("Toggle", () => {
  it("renders a semantic switch with its label", () => {
    render(<Toggle label="Notifications" />);
    expect(
      screen.getByRole("switch", { name: "Notifications" }),
    ).toBeInTheDocument();
  });

  it("reflects the checked prop", () => {
    render(<Toggle label="Dark mode" checked readOnly />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked();
  });

  it("fires onChange when toggled", () => {
    const onChange = vi.fn();
    render(<Toggle label="Sync" onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Sync" }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("renders the native disabled attribute when disabled", () => {
    render(<Toggle label="Locked" disabled />);
    const toggle = screen.getByRole("switch", { name: "Locked" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("disabled");
  });

  it("associates the label with the input via htmlFor", () => {
    render(<Toggle label="Sound" />);
    // getByRole name resolution proves the label/input association.
    expect(screen.getByRole("switch", { name: "Sound" })).toBeInTheDocument();
  });

  it("forwards a ref to the underlying switch <input> element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Toggle ref={ref} label="Notifications" />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    // The ref points at the real native input, not the styled track.
    expect(ref.current).toBe(toggle);
  });
});
