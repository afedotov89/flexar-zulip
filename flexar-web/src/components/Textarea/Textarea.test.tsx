import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Textarea } from ".";

// Textarea wraps a native <textarea> with a fixed `rows` height, an
// `invalid` error state (also sets aria-invalid) and a disabled state.

describe("Textarea", () => {
  it("renders a semantic textarea defaulting to 3 rows", () => {
    render(<Textarea aria-label="Bio" />);
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("rows", "3");
  });

  it("honours a custom rows value", () => {
    render(<Textarea aria-label="Bio" rows={8} />);
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveAttribute(
      "rows",
      "8",
    );
  });

  it("fires onChange when typed into", () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Bio" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Bio" }), {
      target: { value: "hello" },
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("sets aria-invalid when invalid", () => {
    render(<Textarea aria-label="Bio" invalid />);
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("renders the native disabled attribute when disabled", () => {
    render(<Textarea aria-label="Bio" disabled />);
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute("disabled");
  });

  it("forwards a ref to the underlying <textarea> element", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Bio" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "Bio" }));
  });
});
