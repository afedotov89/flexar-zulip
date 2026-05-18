// Tests for `SubgroupsTab` (Phase C3).
//
// Cases: list render with N rows, empty state, system / deactivated
// read-only banners, add via typeahead, remove via confirm modal, the
// graceful "(удалена)" fallback when an id is no longer in the
// directory, cycle-prevention filter excluding self / parent-of-self,
// and the error-path banner on API failure. Also unit-tests the pure
// `wouldCreateCycle` helper.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
  },
}));

const { addUserGroupSubgroupsMock, removeUserGroupSubgroupsMock } = vi.hoisted(
  () => ({
    addUserGroupSubgroupsMock: vi.fn(),
    removeUserGroupSubgroupsMock: vi.fn(),
  }),
);
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      addUserGroupSubgroups: addUserGroupSubgroupsMock,
      removeUserGroupSubgroups: removeUserGroupSubgroupsMock,
    },
  };
});

import type { UserGroup } from "../../../domain";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { SubgroupsTab, wouldCreateCycle } from "./SubgroupsTab";

function makeGroup(overrides: Partial<UserGroup> & { id: number }): UserGroup {
  return {
    name: `group-${overrides.id}`,
    description: "",
    is_system_group: false,
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

function seed(groups: UserGroup[]): void {
  const directory: Record<number, UserGroup> = {};
  for (const g of groups) {
    directory[g.id] = g;
  }
  useUserGroupsStore.setState({ userGroups: directory });
}

const FULL_CAPS = {
  canManage: true,
  canAddMembers: true,
  canRemoveMembers: true,
  canSeeDetail: true,
};

function renderTab(group: UserGroup): void {
  render(
    <MemoryRouter>
      <SubgroupsTab group={group} caps={FULL_CAPS} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useUserGroupsStore.setState({ userGroups: {} });
  addUserGroupSubgroupsMock.mockReset();
  removeUserGroupSubgroupsMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wouldCreateCycle (pure helper)", () => {
  it("returns true for self (a group can't contain itself)", () => {
    const directory: Record<number, UserGroup> = {
      1: makeGroup({ id: 1 }),
    };
    expect(wouldCreateCycle(1, 1, directory)).toBe(true);
  });

  it("returns false for an independent group", () => {
    const directory: Record<number, UserGroup> = {
      1: makeGroup({ id: 1 }),
      2: makeGroup({ id: 2 }),
    };
    expect(wouldCreateCycle(1, 2, directory)).toBe(false);
  });

  it("returns true when adding A under C in chain A → B → C", () => {
    // A's subgroups: [B]; B's subgroups: [C]; adding A under C would
    // close the loop C → A → B → C.
    const directory: Record<number, UserGroup> = {
      1: makeGroup({ id: 1, name: "A", direct_subgroup_ids: [2] }),
      2: makeGroup({ id: 2, name: "B", direct_subgroup_ids: [3] }),
      3: makeGroup({ id: 3, name: "C", direct_subgroup_ids: [] }),
    };
    // Asking "would adding `A` (id=1) as a subgroup of `C` (id=3)
    // create a cycle?" — yes, because `C` is reachable from `A`.
    expect(wouldCreateCycle(3, 1, directory)).toBe(true);
  });

  it("returns false in the safe direction of the same chain", () => {
    const directory: Record<number, UserGroup> = {
      1: makeGroup({ id: 1, name: "A", direct_subgroup_ids: [2] }),
      2: makeGroup({ id: 2, name: "B", direct_subgroup_ids: [3] }),
      3: makeGroup({ id: 3, name: "C", direct_subgroup_ids: [] }),
    };
    // Adding D (not in chain) under A: safe.
    const withD: Record<number, UserGroup> = {
      ...directory,
      4: makeGroup({ id: 4, name: "D" }),
    };
    expect(wouldCreateCycle(1, 4, withD)).toBe(false);
  });
});

describe("SubgroupsTab — list rendering", () => {
  it("renders one row per direct subgroup with member count and 'Перейти' link", () => {
    const sub1 = makeGroup({ id: 11, name: "alpha", members: [1, 2] });
    const sub2 = makeGroup({ id: 12, name: "beta", members: [3] });
    const parent = makeGroup({
      id: 1,
      name: "root",
      direct_subgroup_ids: [11, 12],
    });
    seed([parent, sub1, sub2]);
    renderTab(parent);

    const list = screen.getByRole("list", {
      name: "Прямые подгруппы группы",
    });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("alpha");
    expect(items[0]).toHaveTextContent("2 чел.");
    expect(
      within(items[0]).getByRole("link", { name: "Перейти" }),
    ).toHaveAttribute("href", "/admin/groups/11");
    expect(items[1]).toHaveTextContent("beta");
  });

  it("shows the empty state when there are no subgroups", () => {
    renderTab(makeGroup({ id: 1, name: "root", direct_subgroup_ids: [] }));
    expect(screen.getByText(/У группы нет подгрупп/)).toBeInTheDocument();
  });

  it("renders '(удалена)' for an id missing from the directory", () => {
    const parent = makeGroup({
      id: 1,
      name: "root",
      direct_subgroup_ids: [99],
    });
    seed([parent]);
    renderTab(parent);

    expect(screen.getByText("(удалена)")).toBeInTheDocument();
    expect(screen.getByText("— чел.")).toBeInTheDocument();
    // No "Перейти" link for the missing subgroup.
    expect(
      screen.queryByRole("link", { name: "Перейти" }),
    ).not.toBeInTheDocument();
  });
});

describe("SubgroupsTab — system / deactivated read-only", () => {
  it("system group: shows banner and hides add / remove affordances", () => {
    const parent = makeGroup({
      id: 1,
      name: "role:administrators",
      is_system_group: true,
      direct_subgroup_ids: [11],
    });
    seed([parent, makeGroup({ id: 11, name: "alpha" })]);
    renderTab(parent);

    expect(
      screen.getByText(/Системная группа — управление подгруппами недоступно/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Добавить подгруппу"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Убрать подгруппу/ }),
    ).not.toBeInTheDocument();
  });

  it("deactivated group: shows banner and hides add / remove affordances", () => {
    const parent = makeGroup({
      id: 1,
      name: "old",
      deactivated: true,
      direct_subgroup_ids: [11],
    });
    seed([parent, makeGroup({ id: 11, name: "alpha" })]);
    renderTab(parent);

    expect(
      screen.getByText(/Группа деактивирована — реактивируйте/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Добавить подгруппу"),
    ).not.toBeInTheDocument();
  });
});

describe("SubgroupsTab — add via typeahead", () => {
  it("calls addUserGroupSubgroups with the picked id", async () => {
    const parent = makeGroup({ id: 1, name: "root" });
    seed([parent, makeGroup({ id: 99, name: "platform" })]);
    addUserGroupSubgroupsMock.mockResolvedValueOnce(undefined);
    renderTab(parent);

    fireEvent.change(screen.getByLabelText("Добавить подгруппу"), {
      target: { value: "platform" },
    });
    fireEvent.click(screen.getByText("platform"));

    await waitFor(() => {
      expect(addUserGroupSubgroupsMock).toHaveBeenCalledWith(1, [99]);
    });
  });

  it("excludes self and direct-subgroup candidates from suggestions", () => {
    // Parent: root (id=1); chain root → mid (id=2) → leaf (id=3).
    // Searching for "mid" should NOT suggest "mid" in the typeahead
    // results — it's already a direct subgroup. Searching for "root"
    // should NOT suggest "root" (self) either. An unrelated "outsider"
    // (id=4) IS suggested.
    const root = makeGroup({
      id: 1,
      name: "root",
      direct_subgroup_ids: [2],
    });
    const mid = makeGroup({
      id: 2,
      name: "mid",
      direct_subgroup_ids: [3],
    });
    const leaf = makeGroup({ id: 3, name: "leaf" });
    const other = makeGroup({ id: 4, name: "outsider" });
    seed([root, mid, leaf, other]);
    renderTab(root);

    // Typing "root" — self must NOT appear in the suggestions list.
    // (The parent's own name is not rendered elsewhere on this tab.)
    fireEvent.change(screen.getByLabelText("Добавить подгруппу"), {
      target: { value: "root" },
    });
    expect(
      screen.queryByRole("list", { name: "Совпадения" }),
    ).not.toBeInTheDocument();

    // Typing "mid" — already direct subgroup, must NOT appear in
    // suggestions. The row "mid" in the list of current direct
    // subgroups stays visible, so we scope the assertion to the
    // typeahead results list.
    fireEvent.change(screen.getByLabelText("Добавить подгруппу"), {
      target: { value: "mid" },
    });
    expect(
      screen.queryByRole("list", { name: "Совпадения" }),
    ).not.toBeInTheDocument();

    // Sanity: unrelated candidate IS suggested inside the results list.
    fireEvent.change(screen.getByLabelText("Добавить подгруппу"), {
      target: { value: "outsider" },
    });
    const results = screen.getByRole("list", { name: "Совпадения" });
    expect(within(results).getByText("outsider")).toBeInTheDocument();
  });

  it("excludes a cycle-creating candidate (chain A → B → C, viewing C, A hidden)", () => {
    // A (id=1) has B (id=2) as direct subgroup; B has C (id=3).
    // Viewing C: adding A under C would close A→B→C→A. The
    // wouldCreateCycle filter must hide A.
    const a = makeGroup({ id: 1, name: "alpha", direct_subgroup_ids: [2] });
    const b = makeGroup({ id: 2, name: "beta", direct_subgroup_ids: [3] });
    const c = makeGroup({ id: 3, name: "gamma" });
    seed([a, b, c]);
    renderTab(c);

    fireEvent.change(screen.getByLabelText("Добавить подгруппу"), {
      target: { value: "alpha" },
    });
    // "alpha" would close the cycle; suggestions list must be empty.
    expect(
      screen.queryByRole("list", { name: "Совпадения" }),
    ).not.toBeInTheDocument();
  });
});

describe("SubgroupsTab — remove flow", () => {
  it("opens confirm modal and calls removeUserGroupSubgroups on confirm", async () => {
    const sub = makeGroup({ id: 11, name: "alpha" });
    const parent = makeGroup({
      id: 1,
      name: "root",
      direct_subgroup_ids: [11],
    });
    seed([parent, sub]);
    removeUserGroupSubgroupsMock.mockResolvedValueOnce(undefined);
    renderTab(parent);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Убрать подгруппу alpha из группы",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Убрать" }));

    await waitFor(() => {
      expect(removeUserGroupSubgroupsMock).toHaveBeenCalledWith(1, [11]);
    });
  });

  it("surfaces a banner when the remove API fails", async () => {
    const sub = makeGroup({ id: 11, name: "alpha" });
    const parent = makeGroup({
      id: 1,
      name: "root",
      direct_subgroup_ids: [11],
    });
    seed([parent, sub]);
    removeUserGroupSubgroupsMock.mockRejectedValueOnce(new Error("Nope"));
    renderTab(parent);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Убрать подгруппу alpha из группы",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Убрать" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Nope");
    });
  });
});
