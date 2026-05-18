// Tests for the system-roles tree section on the admin groups list.

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { UserGroup } from "../../../domain";
import { SystemGroupTree } from "./SystemGroupTree";

function makeGroup(overrides: Partial<UserGroup> & { id: number }): UserGroup {
  return {
    name: `group-${overrides.id}`,
    description: "",
    is_system_group: true,
    members: [],
    direct_subgroup_ids: [],
    creator_id: null,
    date_created: null,
    deactivated: false,
    can_add_members_group: 1,
    can_join_group: 1,
    can_leave_group: 1,
    can_manage_group: 1,
    can_mention_group: 1,
    can_remove_members_group: 1,
    ...overrides,
  };
}

function directory(...groups: UserGroup[]): Record<number, UserGroup> {
  return Object.fromEntries(groups.map((g) => [g.id, g]));
}

function renderTree(systemGroups: UserGroup[]): void {
  render(
    <MemoryRouter>
      <SystemGroupTree
        systemGroups={systemGroups}
        directory={directory(...systemGroups)}
      />
    </MemoryRouter>,
  );
}

describe("SystemGroupTree", () => {
  it("returns null for empty input", () => {
    const { container } = render(
      <MemoryRouter>
        <SystemGroupTree systemGroups={[]} directory={{}} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a collapsed toggle by default; tree appears on click", () => {
    renderTree([
      makeGroup({ id: 1, name: "role:owners" }),
      makeGroup({ id: 2, name: "role:nobody" }),
    ]);

    const toggle = screen.getByRole("button", { name: /Системные роли/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("list", { name: "Дерево системных ролей" }),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("list", { name: "Дерево системных ролей" }),
    ).toBeInTheDocument();
  });

  it("renders the count of system groups in the toggle", () => {
    renderTree([
      makeGroup({ id: 1, name: "a" }),
      makeGroup({ id: 2, name: "b" }),
      makeGroup({ id: 3, name: "c" }),
    ]);
    expect(screen.getByRole("button", { name: /3/ })).toBeInTheDocument();
  });

  it("renders the chain nesting structure when expanded", () => {
    // owners ⊂ administrators (admins.direct_subgroup_ids = [owners])
    renderTree([
      makeGroup({ id: 10, name: "role:owners" }),
      makeGroup({
        id: 11,
        name: "role:administrators",
        direct_subgroup_ids: [10],
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Системные роли/ }));

    const tree = screen.getByRole("list", { name: "Дерево системных ролей" });
    const links = within(tree).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      // admins is the root (no one references it), owners is its child.
      expect.stringContaining("role:administrators"),
      expect.stringContaining("role:owners"),
    ]);
  });

  it("each tree node links to its detail route", () => {
    renderTree([makeGroup({ id: 42, name: "role:everyone" })]);
    fireEvent.click(screen.getByRole("button", { name: /Системные роли/ }));
    const link = screen.getByRole("link", { name: /role:everyone/ });
    expect(link).toHaveAttribute("href", "/admin/groups/42");
  });

  it("shows the transitive member count per node", () => {
    // owners has user 8; admins ⊃ owners → admins also shows "1 чел."
    renderTree([
      makeGroup({ id: 10, name: "role:owners", members: [8] }),
      makeGroup({
        id: 11,
        name: "role:administrators",
        direct_subgroup_ids: [10],
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Системные роли/ }));
    const adminLink = screen.getByRole("link", {
      name: /role:administrators/,
    });
    expect(within(adminLink).getByText("1 чел.")).toBeInTheDocument();
  });
});
