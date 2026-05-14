import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Radio } from ".";

// Radio is a semantic <input type="radio"> visually replaced with a
// styled dot. Options group by a shared `name`; it supports checked,
// disabled and invalid states and a required associated label.

describe("Radio", () => {
  it("renders a semantic radio input with its label", () => {
    render(<Radio label="Email" name="contact" value="email" />);
    const radio = screen.getByRole("radio", { name: "Email" });
    expect(radio).toBeInTheDocument();
    expect(radio).toHaveAttribute("name", "contact");
    expect(radio).toHaveAttribute("value", "email");
  });

  it("reflects the checked prop", () => {
    render(<Radio label="SMS" name="contact" value="sms" checked readOnly />);
    expect(screen.getByRole("radio", { name: "SMS" })).toBeChecked();
  });

  it("groups options by name so only one is selected", () => {
    const onChange = vi.fn();
    render(
      <>
        <Radio label="A" name="g" value="a" onChange={onChange} />
        <Radio label="B" name="g" value="b" onChange={onChange} />
      </>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A" })).not.toBeChecked();
  });

  it("renders the native disabled attribute when disabled", () => {
    render(<Radio label="Locked" name="g" value="x" disabled />);
    const radio = screen.getByRole("radio", { name: "Locked" });
    expect(radio).toBeDisabled();
    expect(radio).toHaveAttribute("disabled");
  });

  it("sets aria-invalid when invalid", () => {
    render(<Radio label="Bad" name="g" value="x" invalid />);
    expect(screen.getByRole("radio", { name: "Bad" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("forwards a ref to the underlying <input> element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Radio ref={ref} label="Email" name="contact" value="email" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByRole("radio", { name: "Email" }));
  });
});
