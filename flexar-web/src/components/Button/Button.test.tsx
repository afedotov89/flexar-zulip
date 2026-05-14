import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Button } from ".";

// Button is a semantic <button> with the shared variant/size
// vocabulary, optional icons (by name), and a loading state that
// disables the control and shows a Spinner.

describe("Button", () => {
  it("renders a semantic button defaulting to type=button", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
  });

  it("fires onClick when activated", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Nope" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a spinner, sets aria-busy and disables when loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: /Saving/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("hides leading/trailing icons while loading", () => {
    const { container, rerender } = render(
      <Button iconLeft="plus" iconRight="chevron-down">
        Add
      </Button>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);

    rerender(
      <Button iconLeft="plus" iconRight="chevron-down" loading>
        Add
      </Button>,
    );
    // no icon SVGs while loading; the spinner is a bordered <span>.
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("forwards type=submit", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("forwards a ref to the underlying <button> element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Ref" }));
  });
});
