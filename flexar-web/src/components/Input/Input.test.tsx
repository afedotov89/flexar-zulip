import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Input } from ".";

// Input wraps a native <input> with the shared size vocabulary, an
// `invalid` error state (also sets aria-invalid), optional icons by
// name, and a disabled state.

describe("Input", () => {
  it("renders a semantic text input defaulting to type=text", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAttribute("type", "text");
  });

  it("fires onChange when typed into", () => {
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "hello" },
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("sets aria-invalid when invalid", () => {
    render(<Input aria-label="Email" invalid />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("does not set aria-invalid by default", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("renders the native disabled attribute when disabled", () => {
    render(<Input aria-label="Name" disabled />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("disabled");
  });

  it("renders leading and trailing icons by name", () => {
    const { container } = render(
      <Input aria-label="Search" iconLeft="search" iconRight="close" />,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("forwards native attributes like value and placeholder", () => {
    render(
      <Input
        aria-label="Name"
        placeholder="Type here"
        value="preset"
        readOnly
      />,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveValue("preset");
    expect(input).toHaveAttribute("placeholder", "Type here");
  });

  it("forwards a ref to the underlying <input> element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Name" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "Name" }));
  });
});
