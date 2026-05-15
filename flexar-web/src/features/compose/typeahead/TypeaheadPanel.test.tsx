// Tests for the generic typeahead panel.

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TypeaheadPanelRow } from "./TypeaheadPanel";
import { TypeaheadPanel } from "./TypeaheadPanel";

function rows(...labels: string[]): TypeaheadPanelRow[] {
  return labels.map((label, i) => ({
    id: `row-${i}`,
    label,
    render: () => <span>{label}</span>,
  }));
}

describe("TypeaheadPanel", () => {
  it("does not render anything when closed", () => {
    const { container } = render(
      <TypeaheadPanel
        panelId="p"
        anchor={null}
        open={false}
        rows={rows("a")}
        activeId={null}
        onSelect={() => {}}
        onHover={() => {}}
        ariaLabel="x"
      />,
    );
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("does not render anything when open with zero rows", () => {
    render(
      <TypeaheadPanel
        panelId="p"
        anchor={null}
        open={true}
        rows={[]}
        activeId={null}
        onSelect={() => {}}
        onHover={() => {}}
        ariaLabel="x"
      />,
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("renders one option per row with the right id and aria-selected", () => {
    render(
      <TypeaheadPanel
        panelId="panel-1"
        anchor={null}
        open={true}
        rows={rows("Alice", "Bob")}
        activeId="row-1"
        onSelect={() => {}}
        onHover={() => {}}
        ariaLabel="people"
      />,
    );
    const listbox = screen.getByRole("listbox", { name: "people" });
    expect(listbox).toHaveAttribute("id", "panel-1");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("id", "row-0");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("id", "row-1");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("calls onSelect on mousedown of an option", () => {
    const onSelect = vi.fn();
    render(
      <TypeaheadPanel
        panelId="p"
        anchor={null}
        open={true}
        rows={rows("Alice")}
        activeId="row-0"
        onSelect={onSelect}
        onHover={() => {}}
        ariaLabel="x"
      />,
    );
    fireEvent.mouseDown(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledWith("row-0");
  });

  it("calls onHover when the user moves over an option", () => {
    const onHover = vi.fn();
    render(
      <TypeaheadPanel
        panelId="p"
        anchor={null}
        open={true}
        rows={rows("Alice", "Bob")}
        activeId="row-0"
        onSelect={() => {}}
        onHover={onHover}
        ariaLabel="x"
      />,
    );
    fireEvent.mouseEnter(screen.getAllByRole("option")[1]);
    expect(onHover).toHaveBeenCalledWith("row-1");
  });
});
