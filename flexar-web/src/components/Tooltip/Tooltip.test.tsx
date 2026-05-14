import { render, screen, fireEvent, act } from "@testing-library/react";
import { Tooltip } from ".";
import { Button } from "../Button";

// Tooltip is hover/focus-triggered, portaled, and links the trigger to
// the tip via `aria-describedby`. jsdom has no real layout, so these
// tests assert behaviour (open/close, a11y wiring), never geometry.

describe("Tooltip", () => {
  it("is closed initially and shows nothing", () => {
    render(
      <Tooltip content="Help text">
        <button>Trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on mouseenter and closes on mouseleave", () => {
    render(
      <Tooltip content="Help text">
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Help text");
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on focus and closes on blur", () => {
    render(
      <Tooltip content="Help text">
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(
      <Tooltip content="Help text">
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("links the trigger to the tip via aria-describedby while open", () => {
    render(
      <Tooltip content="Help text">
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger).not.toHaveAttribute("aria-describedby");
    fireEvent.mouseEnter(trigger);
    const tip = screen.getByRole("tooltip");
    expect(trigger).toHaveAttribute("aria-describedby", tip.id);
  });

  it("honours the open delay", () => {
    vi.useFakeTimers();
    try {
      render(
        <Tooltip content="Help text" delay={200}>
          <button>Trigger</button>
        </Tooltip>,
      );
      const trigger = screen.getByRole("button", { name: "Trigger" });
      fireEvent.mouseEnter(trigger);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("positions the tip against a forwardRef trigger like Button", () => {
    // Regression: a primitive trigger must forward its ref so the
    // cloned trigger reaches `useOverlayPosition`. When it does, the
    // hook runs and writes `--overlay-x`/`--overlay-y` onto the tip;
    // otherwise it early-returns and they are absent (the tip rendered
    // at the page corner). jsdom has no layout, so we assert the
    // properties exist, not their values.
    render(
      <Tooltip content="Help text">
        <Button>Trigger</Button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
    const tip = screen.getByRole("tooltip");
    expect(tip.style.getPropertyValue("--overlay-x")).not.toBe("");
    expect(tip.style.getPropertyValue("--overlay-y")).not.toBe("");
  });

  it("preserves the trigger's own event handlers", () => {
    const onMouseEnter = vi.fn();
    render(
      <Tooltip content="Help text">
        <button onMouseEnter={onMouseEnter}>Trigger</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Trigger" }));
    expect(onMouseEnter).toHaveBeenCalledOnce();
  });
});
