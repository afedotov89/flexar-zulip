import { render, screen, fireEvent } from "@testing-library/react";
import { DropdownMenu } from ".";
import type { DropdownMenuEntry } from ".";

// DropdownMenu reuses Popover for floating/dismissal and adds menu
// semantics + a roving-tabindex keyboard model on top.

function makeItems(onSelect: () => void): DropdownMenuEntry[] {
  return [
    { id: "edit", label: "Edit", icon: "plus", onSelect },
    { id: "sep", separator: true },
    { id: "rename", label: "Rename", onSelect },
    { id: "locked", label: "Locked", disabled: true, onSelect },
    { id: "delete", label: "Delete", danger: true, onSelect },
  ];
}

describe("DropdownMenu", () => {
  it("opens on trigger click and renders a menu with menuitems", () => {
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(vi.fn())} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    // Four item buttons (one is a separator, not an item).
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("invokes onSelect and closes the menu when an item is clicked", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(onSelect)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not select a disabled item", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(onSelect)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const locked = screen.getByRole("menuitem", { name: "Locked" });
    expect(locked).toBeDisabled();
    expect(locked).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(locked);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("uses roving tabindex — only the first enabled item is tabbable", () => {
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(vi.fn())} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveAttribute("tabindex", "0");
    expect(items[1]).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus with ArrowDown / ArrowUp across enabled items", () => {
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(vi.fn())} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    const rename = screen.getByRole("menuitem", { name: "Rename" });
    expect(edit).toHaveFocus();
    fireEvent.keyDown(edit, { key: "ArrowDown" });
    expect(rename).toHaveFocus();
    fireEvent.keyDown(rename, { key: "ArrowUp" });
    expect(edit).toHaveFocus();
  });

  it("skips disabled items when navigating with arrows", () => {
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(vi.fn())} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const rename = screen.getByRole("menuitem", { name: "Rename" });
    const del = screen.getByRole("menuitem", { name: "Delete" });
    rename.focus();
    // Next enabled after Rename is Delete — "Locked" is skipped.
    fireEvent.keyDown(rename, { key: "ArrowDown" });
    expect(del).toHaveFocus();
  });

  it("jumps to first / last enabled item with Home / End", () => {
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(vi.fn())} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    const del = screen.getByRole("menuitem", { name: "Delete" });
    fireEvent.keyDown(edit, { key: "End" });
    expect(del).toHaveFocus();
    fireEvent.keyDown(del, { key: "Home" });
    expect(edit).toHaveFocus();
  });

  it("closes on Escape", () => {
    render(
      <DropdownMenu trigger={<button>Actions</button>} items={makeItems(vi.fn())} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
