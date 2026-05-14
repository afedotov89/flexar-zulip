import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from ".";
import type { TabItem } from ".";

const tabs: TabItem[] = [
  { id: "general", label: "General" },
  { id: "members", label: "Members" },
  { id: "archived", label: "Archived", disabled: true },
];

// Tabs is a controlled WAI-ARIA tab set: roving tabindex, arrow-key
// navigation with wraparound, Home/End, and a render-prop panel.

describe("Tabs", () => {
  it("renders a tablist with one tab per item and the active panel", () => {
    render(
      <Tabs tabs={tabs} activeId="general" onChange={() => {}} aria-label="Settings">
        {(id) => <p>panel: {id}</p>}
      </Tabs>,
    );
    expect(screen.getByRole("tablist", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel: general");
  });

  it("marks the active tab selected and wires aria-controls", () => {
    render(
      <Tabs tabs={tabs} activeId="members" onChange={() => {}}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    const active = screen.getByRole("tab", { name: "Members" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveAttribute("tabindex", "0");
    const panel = screen.getByRole("tabpanel");
    expect(active.getAttribute("aria-controls")).toBe(panel.getAttribute("id"));
    expect(panel.getAttribute("aria-labelledby")).toBe(active.getAttribute("id"));
  });

  it("uses roving tabindex: inactive tabs are removed from tab order", () => {
    render(
      <Tabs tabs={tabs} activeId="general" onChange={() => {}}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "Members" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("fires onChange when a tab is clicked", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeId="general" onChange={onChange}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Members" }));
    expect(onChange).toHaveBeenCalledWith("members");
  });

  it("does not fire onChange when a disabled tab is clicked", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeId="general" onChange={onChange}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves to the next selectable tab with ArrowRight", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeId="general" onChange={onChange}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "General" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("members");
  });

  it("wraps to the first selectable tab with ArrowRight from the last", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeId="members" onChange={onChange}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    // "archived" is disabled, so "members" is the last selectable tab.
    fireEvent.keyDown(screen.getByRole("tab", { name: "Members" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("general");
  });

  it("wraps to the last selectable tab with ArrowLeft from the first", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeId="general" onChange={onChange}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "General" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("members");
  });

  it("jumps to the first and last selectable tabs with Home and End", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeId="members" onChange={onChange}>
        {(id) => <p>{id}</p>}
      </Tabs>,
    );
    const active = screen.getByRole("tab", { name: "Members" });
    fireEvent.keyDown(active, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("general");
    fireEvent.keyDown(active, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("members");
  });
});
