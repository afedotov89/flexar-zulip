// Tests for `CreateGroupModal` (Phase B3).
//
// Mirrors `CreateChannelModal.test.tsx`: thin form over
// `apiClient.createUserGroup`. Cases: open/closed render, name
// validation, adding/removing members via the chip list, the success
// path (correct args + onClose), and the error path (banner + modal
// stays open).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { createUserGroupMock } = vi.hoisted(() => ({
  createUserGroupMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      createUserGroup: createUserGroupMock,
    },
  };
});

import type { User } from "../../../domain";
import { RoleValues } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import { CreateGroupModal } from "./CreateGroupModal";

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

beforeEach(() => {
  createUserGroupMock.mockReset();
  useUsersStore.setState({ users: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CreateGroupModal — render gating", () => {
  it("renders the dialog with the title when open", () => {
    render(<CreateGroupModal open onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Создать группу" }),
    ).toBeInTheDocument();
  });

  it("does not render the dialog when closed", () => {
    render(<CreateGroupModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CreateGroupModal — name validation", () => {
  it("disables the submit button until a non-empty name is entered", () => {
    render(<CreateGroupModal open onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Создать" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "product" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("re-disables submit when the name is whitespace-only", () => {
    render(<CreateGroupModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Создать" })).toBeDisabled();
  });
});

describe("CreateGroupModal — member picker", () => {
  it("adds a member from the typeahead and shows a removable chip", () => {
    seedUsers([makeUser({ user_id: 1, full_name: "Alice Smith" })]);
    render(<CreateGroupModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Добавить участника"), {
      target: { value: "alice" },
    });
    fireEvent.click(screen.getByText("Alice Smith"));

    const chipList = screen.getByRole("list", { name: "Выбранные участники" });
    const chips = within(chipList).getAllByRole("listitem");
    expect(chips).toHaveLength(1);
    expect(within(chips[0]).getByText("Alice Smith")).toBeInTheDocument();

    // Remove via the × button.
    fireEvent.click(
      within(chips[0]).getByRole("button", {
        name: "Убрать Alice Smith из группы",
      }),
    );
    expect(
      screen.queryByRole("list", { name: "Выбранные участники" }),
    ).not.toBeInTheDocument();
  });
});

describe("CreateGroupModal — submit", () => {
  it("calls createUserGroup with trimmed name, description, and members on success", async () => {
    seedUsers([makeUser({ user_id: 7, full_name: "Bob Jones" })]);
    createUserGroupMock.mockResolvedValueOnce({ group_id: 99 });
    const onClose = vi.fn();
    render(<CreateGroupModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "  product  " },
    });
    fireEvent.change(screen.getByLabelText("Описание"), {
      target: { value: "Product team" },
    });
    fireEvent.change(screen.getByLabelText("Добавить участника"), {
      target: { value: "bob" },
    });
    fireEvent.click(screen.getByText("Bob Jones"));
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createUserGroupMock).toHaveBeenCalledWith({
        name: "product",
        description: "Product team",
        members: [7],
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a server error and keeps the modal open", async () => {
    createUserGroupMock.mockRejectedValueOnce(new Error("Group exists"));
    const onClose = vi.fn();
    render(<CreateGroupModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Group exists");
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
