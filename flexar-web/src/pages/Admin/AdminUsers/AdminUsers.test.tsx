// Tests for the admin users management page (Phase 5.4).
//
// Covers tab filtering, search and role-dropdown filtering, the edit
// and deactivate flows (including optimistic store writes), and that
// the signed-in user cannot deactivate themselves from this screen.
//
// The realtime layer is mocked so `useStoresLoading()` reports
// "connected" — without that the page would render its loading
// spinner instead of the user list.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { updateUserMock, deactivateUserMock, reactivateUserMock } = vi.hoisted(
  () => ({
    updateUserMock: vi.fn(),
    deactivateUserMock: vi.fn(),
    reactivateUserMock: vi.fn(),
  }),
);

vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      updateUser: updateUserMock,
      deactivateUser: deactivateUserMock,
      reactivateUser: reactivateUserMock,
    },
  };
});

import type { User } from "../../../domain";
import { RoleValues } from "../../../domain";
import { useAuthStore } from "../../../stores/authStore";
import { useUsersStore } from "../../../stores/usersStore";
import { AdminUsers } from "./AdminUsers";

function makeUser(overrides: Partial<User> & { user_id: number }): User {
  const base: User = {
    user_id: overrides.user_id,
    delivery_email: null,
    email: `user${overrides.user_id}@example.com`,
    full_name: `User ${overrides.user_id}`,
    date_joined: "2024-01-01T00:00:00Z",
    is_active: true,
    is_owner: false,
    is_admin: false,
    is_guest: false,
    is_bot: false,
    bot_type: null,
    bot_owner_id: null,
    role: RoleValues.Member,
    timezone: "",
    avatar_url: null,
    avatar_version: 1,
    is_imported_stub: false,
  };
  return { ...base, ...overrides };
}

function seedUsers(users: User[]): void {
  const directory: Record<number, User> = {};
  for (const user of users) {
    directory[user.user_id] = user;
  }
  useUsersStore.setState({ users: directory });
}

function seedSession(userId: number): void {
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId },
    status: "authenticated",
  });
}

beforeEach(() => {
  updateUserMock.mockReset();
  deactivateUserMock.mockReset();
  reactivateUserMock.mockReset();
  useUsersStore.setState({ users: {} });
  useAuthStore.setState({
    session: { email: "me@example.com", apiKey: "k", userId: 999 },
    status: "authenticated",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminUsers — list filtering", () => {
  it("renders only active human users on the Active tab, sorted by name", () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Bob" }),
      makeUser({ user_id: 2, full_name: "Alice" }),
      makeUser({
        user_id: 3,
        full_name: "Deactivated Dan",
        is_active: false,
      }),
      makeUser({ user_id: 4, full_name: "Bot Bertha", is_bot: true }),
    ]);
    render(<AdminUsers />);

    const list = screen.getByRole("list", { name: "Пользователи" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Alphabetical: Alice before Bob.
    expect(within(items[0]).getByText("Alice")).toBeInTheDocument();
    expect(within(items[1]).getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Deactivated Dan")).not.toBeInTheDocument();
    expect(screen.queryByText("Bot Bertha")).not.toBeInTheDocument();
  });

  it("shows deactivated users on the Деактивированные tab with a Восстановить action", () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Active Anna" }),
      makeUser({
        user_id: 2,
        full_name: "Gone Greg",
        is_active: false,
      }),
    ]);
    render(<AdminUsers />);
    fireEvent.click(screen.getByRole("tab", { name: "Деактивированные" }));

    const list = screen.getByRole("list", { name: "Пользователи" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Gone Greg")).toBeInTheDocument();
    expect(
      within(items[0]).getByRole("button", { name: "Восстановить" }),
    ).toBeInTheDocument();
  });

  it("filters by search across name and email (case-insensitive)", () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Hamlet", email: "h@x" }),
      makeUser({ user_id: 2, full_name: "Ophelia", email: "o@x" }),
    ]);
    render(<AdminUsers />);

    fireEvent.change(screen.getByPlaceholderText("Поиск"), {
      target: { value: "OPHE" },
    });

    const list = screen.getByRole("list", { name: "Пользователи" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Ophelia")).toBeInTheDocument();
  });

  it("filters by role via the role dropdown", () => {
    seedUsers([
      makeUser({
        user_id: 1,
        full_name: "Owen Owner",
        role: RoleValues.Owner,
      }),
      makeUser({ user_id: 2, full_name: "Mona Member" }),
    ]);
    render(<AdminUsers />);

    fireEvent.change(screen.getByLabelText("Фильтр по роли"), {
      target: { value: String(RoleValues.Owner) },
    });

    const list = screen.getByRole("list", { name: "Пользователи" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Owen Owner")).toBeInTheDocument();
  });

  it("hides the role filter on the Боты tab and lists bots only", () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Anna" }),
      makeUser({ user_id: 2, full_name: "Bot Bertha", is_bot: true }),
    ]);
    render(<AdminUsers />);
    fireEvent.click(screen.getByRole("tab", { name: "Боты" }));

    expect(screen.queryByLabelText("Фильтр по роли")).toBeNull();
    const list = screen.getByRole("list", { name: "Пользователи" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Bot Bertha")).toBeInTheDocument();
  });
});

describe("AdminUsers — empty state", () => {
  it("renders 'Никого не найдено.' when the filter matches nothing", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Solo" })]);
    render(<AdminUsers />);

    fireEvent.change(screen.getByPlaceholderText("Поиск"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("Никого не найдено.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("AdminUsers — self-action guard", () => {
  it("does not show Изменить/Деактивировать for the current user", () => {
    seedSession(1);
    seedUsers([
      makeUser({ user_id: 1, full_name: "Me" }),
      makeUser({ user_id: 2, full_name: "Other" }),
    ]);
    render(<AdminUsers />);

    const list = screen.getByRole("list", { name: "Пользователи" });
    const items = within(list).getAllByRole("listitem");
    // First row: Me — no actions.
    const myRow = items.find(
      (row) => within(row).queryByText("Me") !== null,
    );
    expect(myRow).toBeDefined();
    expect(
      within(myRow!).queryByRole("button", { name: "Деактивировать" }),
    ).toBeNull();
    expect(
      within(myRow!).queryByRole("button", { name: "Изменить" }),
    ).toBeNull();
    // Other row still has both actions.
    const otherRow = items.find(
      (row) => within(row).queryByText("Other") !== null,
    );
    expect(otherRow).toBeDefined();
    expect(
      within(otherRow!).getByRole("button", { name: "Деактивировать" }),
    ).toBeInTheDocument();
  });
});

describe("AdminUsers — deactivate flow", () => {
  it("opens the confirm modal and calls apiClient.deactivateUser on confirm", async () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Doomed" }),
      makeUser({ user_id: 999, full_name: "Me" }),
    ]);
    deactivateUserMock.mockResolvedValueOnce(undefined);

    render(<AdminUsers />);

    const list = screen.getByRole("list", { name: "Пользователи" });
    const doomedRow = within(list)
      .getAllByRole("listitem")
      .find((row) => within(row).queryByText("Doomed") !== null);
    expect(doomedRow).toBeDefined();

    fireEvent.click(
      within(doomedRow!).getByRole("button", { name: "Деактивировать" }),
    );

    // Modal opened.
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Деактивировать Doomed\?/),
    ).toBeInTheDocument();

    // Confirm.
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Деактивировать" }),
    );

    await waitFor(() => {
      expect(deactivateUserMock).toHaveBeenCalledWith(1, {
        deactivationNotificationComment: undefined,
      });
    });
    // Optimistic write: user is now inactive in the store.
    expect(useUsersStore.getState().users[1]?.is_active).toBe(false);
  });

  it("restores the user on REST failure and surfaces the error", async () => {
    seedUsers([
      makeUser({ user_id: 1, full_name: "Doomed" }),
      makeUser({ user_id: 999, full_name: "Me" }),
    ]);
    deactivateUserMock.mockRejectedValueOnce(new Error("forbidden"));

    render(<AdminUsers />);
    const list = screen.getByRole("list", { name: "Пользователи" });
    const doomedRow = within(list)
      .getAllByRole("listitem")
      .find((row) => within(row).queryByText("Doomed") !== null)!;
    fireEvent.click(
      within(doomedRow).getByRole("button", { name: "Деактивировать" }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Деактивировать" }),
    );

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent("forbidden");
    });
    // Restored.
    expect(useUsersStore.getState().users[1]?.is_active).toBe(true);
  });
});

describe("AdminUsers — edit flow", () => {
  it("saves a name + role change through apiClient.updateUser", async () => {
    seedUsers([
      makeUser({
        user_id: 1,
        full_name: "Old Name",
        role: RoleValues.Member,
      }),
      makeUser({ user_id: 999, full_name: "Me" }),
    ]);
    updateUserMock.mockResolvedValueOnce(undefined);

    render(<AdminUsers />);
    const list = screen.getByRole("list", { name: "Пользователи" });
    const targetRow = within(list)
      .getAllByRole("listitem")
      .find((row) => within(row).queryByText("Old Name") !== null)!;
    fireEvent.click(
      within(targetRow).getByRole("button", { name: "Изменить" }),
    );

    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText("Имя") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    fireEvent.change(within(dialog).getByLabelText("Роль"), {
      target: { value: String(RoleValues.Administrator) },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith(1, {
        fullName: "New Name",
        role: RoleValues.Administrator,
      });
    });
    // Optimistic store update applied.
    expect(useUsersStore.getState().users[1]?.full_name).toBe("New Name");
    expect(useUsersStore.getState().users[1]?.role).toBe(
      RoleValues.Administrator,
    );
  });
});

describe("AdminUsers — reactivate flow", () => {
  it("calls apiClient.reactivateUser on confirm and flips is_active back", async () => {
    seedUsers([
      makeUser({
        user_id: 1,
        full_name: "Gone Greg",
        is_active: false,
      }),
    ]);
    reactivateUserMock.mockResolvedValueOnce(undefined);

    render(<AdminUsers />);
    fireEvent.click(screen.getByRole("tab", { name: "Деактивированные" }));
    fireEvent.click(screen.getByRole("button", { name: "Восстановить" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Восстановить" }),
    );

    await waitFor(() => {
      expect(reactivateUserMock).toHaveBeenCalledWith(1);
    });
    expect(useUsersStore.getState().users[1]?.is_active).toBe(true);
  });
});
