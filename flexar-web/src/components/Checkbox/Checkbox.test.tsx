import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Checkbox } from ".";

// Checkbox is a semantic <input type="checkbox"> visually replaced with
// a styled box. It supports an optional associated label, checked,
// indeterminate, disabled and invalid states.

describe("Checkbox", () => {
  it("renders a semantic checkbox input", () => {
    render(<Checkbox aria-label="Agree" />);
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeInTheDocument();
  });

  it("associates the label with the input", () => {
    render(<Checkbox label="Subscribe" />);
    const checkbox = screen.getByRole("checkbox", { name: "Subscribe" });
    expect(checkbox).toBeInTheDocument();
  });

  it("reflects the checked prop", () => {
    render(<Checkbox label="Done" checked readOnly />);
    expect(screen.getByRole("checkbox", { name: "Done" })).toBeChecked();
  });

  it("fires onChange when toggled", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Toggle" onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle" }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("sets the indeterminate IDL property on the input", () => {
    render(<Checkbox label="Some" indeterminate />);
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Some",
    });
    expect(checkbox.indeterminate).toBe(true);
  });

  it("renders the native disabled attribute when disabled", () => {
    render(<Checkbox label="Locked" disabled />);
    const checkbox = screen.getByRole("checkbox", { name: "Locked" });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAttribute("disabled");
  });

  it("sets aria-invalid when invalid", () => {
    render(<Checkbox label="Bad" invalid />);
    expect(screen.getByRole("checkbox", { name: "Bad" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("forwards a ref while keeping the indeterminate effect working", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="Some" indeterminate />);
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Some",
    });
    // The forwarded ref reaches the native input...
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(checkbox);
    // ...and the internal ref still drives the indeterminate property.
    expect(checkbox.indeterminate).toBe(true);
  });
});
