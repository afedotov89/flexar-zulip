import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from ".";

// Modal is a controlled, portaled dialog with a backdrop, a focus
// trap, focus restoration, body-scroll lock, and backdrop / Escape
// dismissal that can be switched off via `dismissable`.

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Settings">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a labelled modal dialog when open", () => {
    render(
      <Modal open onClose={vi.fn()} title="Settings">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Settings");
  });

  it("falls back to aria-label when there is no title", () => {
    render(
      <Modal open onClose={vi.fn()} aria-label="Quick action">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Quick action");
  });

  it("closes via the X button", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Settings">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape and backdrop click when dismissable", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Settings">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // The backdrop is the dialog's parent element.
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close on Escape or backdrop when dismissable is false", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Settings" dismissable={false}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when clicking inside the dialog", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Settings">
        <p>Body content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Body content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog on open and restores it on close", () => {
    const onClose = vi.fn();
    function Harness({ open }: { open: boolean }): React.JSX.Element {
      return (
        <>
          <button>Outside trigger</button>
          <Modal open={open} onClose={onClose} title="Settings">
            <button>Inside action</button>
          </Modal>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    const outside = screen.getByRole("button", { name: "Outside trigger" });
    outside.focus();
    expect(outside).toHaveFocus();

    // First tabbable in the dialog is the Close button (it precedes the
    // body in DOM order).
    rerender(<Harness open />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    rerender(<Harness open={false} />);
    expect(outside).toHaveFocus();
  });

  it("traps Tab focus within the dialog", () => {
    render(
      <Modal open onClose={vi.fn()} title="Settings">
        <button>First</button>
        <button>Last</button>
      </Modal>,
    );
    // Tabbable order is [Close, First, Last]. Tab from the last wraps
    // to the first tabbable (the Close button); Shift+Tab from the
    // first wraps back to the last.
    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("locks body scroll while open and restores it on close", () => {
    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Settings">
        <p>Body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Modal open={false} onClose={vi.fn()} title="Settings">
        <p>Body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("renders an optional footer", () => {
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Settings"
        footer={<button>Save</button>}
      >
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
