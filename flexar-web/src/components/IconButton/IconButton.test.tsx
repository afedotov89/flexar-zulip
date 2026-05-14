import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { IconButton } from ".";

// IconButton is an icon-only button sharing Button's variant/size
// vocabulary. It requires an `aria-label` since it has no visible text.

describe("IconButton", () => {
  it("renders a semantic button with the required accessible label", () => {
    render(<IconButton icon="close" aria-label="Close" />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("fires onClick when activated", () => {
    const onClick = vi.fn();
    render(<IconButton icon="plus" aria-label="Add" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <IconButton
        icon="bell"
        aria-label="Notifications"
        disabled
        onClick={onClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Notifications" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a spinner, sets aria-busy and disables when loading", () => {
    render(<IconButton icon="search" aria-label="Search" loading />);
    const button = screen.getByRole("button", { name: "Search" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // the icon is swapped for a spinner while loading.
    expect(button.querySelector("svg")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("forwards a ref to the underlying <button> element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} icon="close" aria-label="Close" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Close" }));
  });
});
