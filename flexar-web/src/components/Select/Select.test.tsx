import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Select } from ".";
import type { SelectOption } from "./Select";

// Select is a styled native <select>: it renders the `options` array as
// <option> elements, shows a chevron-down affordance, supports an
// `invalid` error state (also sets aria-invalid) and a disabled state.

const options: SelectOption[] = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
  { value: "c", label: "Cherry", disabled: true },
];

describe("Select", () => {
  it("renders a semantic select with one option per entry", () => {
    render(<Select aria-label="Fruit" options={options} />);
    const select = screen.getByRole("combobox", { name: "Fruit" });
    expect(select.tagName).toBe("SELECT");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("renders a disabled placeholder option when given", () => {
    render(
      <Select aria-label="Fruit" options={options} placeholder="Pick one" />,
    );
    const placeholder = screen.getByRole("option", { name: "Pick one" });
    expect(placeholder).toBeDisabled();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("marks per-option disabled state", () => {
    render(<Select aria-label="Fruit" options={options} />);
    expect(screen.getByRole("option", { name: "Cherry" })).toBeDisabled();
  });

  it("fires onChange when a new option is chosen", () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Fruit" options={options} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Fruit" }), {
      target: { value: "b" },
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("renders the chevron-down affordance", () => {
    const { container } = render(
      <Select aria-label="Fruit" options={options} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("sets aria-invalid when invalid", () => {
    render(<Select aria-label="Fruit" options={options} invalid />);
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("is disabled when disabled", () => {
    render(<Select aria-label="Fruit" options={options} disabled />);
    expect(screen.getByRole("combobox", { name: "Fruit" })).toBeDisabled();
  });

  it("forwards a ref to the underlying <select> element", () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select ref={ref} aria-label="Fruit" options={options} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    expect(ref.current).toBe(screen.getByRole("combobox", { name: "Fruit" }));
  });
});
