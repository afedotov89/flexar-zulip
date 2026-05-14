import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Popover } from ".";
import { Button } from "../Button";

// Popover is click-triggered, portaled, supports controlled and
// uncontrolled open state, and dismisses on outside-press / Escape.
// Focus moves into the panel on open and back to the trigger on close.

describe("Popover", () => {
  it("is closed initially in uncontrolled mode", () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <button>Inside</button>
      </Popover>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles open and closed on trigger click", () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <p>Panel body</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sets aria-expanded / aria-haspopup on the trigger", () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <p>Panel body</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape", () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <p>Panel body</p>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on an outside pointer press", () => {
    render(
      <div>
        <Popover trigger={<button>Open</button>}>
          <p>Panel body</p>
        </Popover>
        <button>Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close when pressing inside the panel", () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <p>Panel body</p>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const panel = screen.getByRole("dialog");
    fireEvent.pointerDown(panel);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("moves focus into the panel on open and back to the trigger on close", () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <button>First action</button>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "First action" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
  });

  it("positions the panel against a forwardRef trigger like Button", () => {
    // Regression: a primitive trigger must forward its ref so the
    // cloned trigger reaches `useOverlayPosition`. When it does, the
    // hook runs and writes `--overlay-x`/`--overlay-y` onto the panel;
    // when the ref never lands, the hook early-returns and they are
    // absent (the panel rendered at the page corner). jsdom has no
    // layout, so we assert the properties exist, not their values.
    render(
      <Popover trigger={<Button>Open</Button>}>
        <p>Panel body</p>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const panel = screen.getByRole("dialog");
    expect(panel.style.getPropertyValue("--overlay-x")).not.toBe("");
    expect(panel.style.getPropertyValue("--overlay-y")).not.toBe("");
  });

  it("supports controlled open state", () => {
    function Controlled(): React.JSX.Element {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          trigger={<button>Open</button>}
          open={open}
          onOpenChange={setOpen}
        >
          <p>Controlled body</p>
        </Popover>
      );
    }
    render(<Controlled />);
    const trigger = screen.getByRole("button", { name: "Open" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
