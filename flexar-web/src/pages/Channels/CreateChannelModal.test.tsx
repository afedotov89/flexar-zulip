// Tests for `CreateChannelModal` (Phase 5.3).
//
// The modal is a thin form over `apiClient.createChannel`. Tests cover:
// the privacy radio mapping to the wire `privacy` field, the disabled
// submit when the name is empty, and that errors surface as a banner.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { createChannelMock, getUserGroupsMock } = vi.hoisted(() => ({
  createChannelMock: vi.fn(),
  getUserGroupsMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      createChannel: createChannelMock,
      getUserGroups: getUserGroupsMock,
    },
  };
});

import { CreateChannelModal } from "./CreateChannelModal";

// Stable fixture of the four posting-policy system groups. The numeric
// ids are arbitrary — the modal looks them up by `name`.
const SYSTEM_GROUP_FIXTURE = [
  { id: 11, name: "role:everyone", is_system_group: true },
  { id: 12, name: "role:fullmembers", is_system_group: true },
  { id: 13, name: "role:moderators", is_system_group: true },
  { id: 14, name: "role:administrators", is_system_group: true },
];

beforeEach(() => {
  createChannelMock.mockReset();
  getUserGroupsMock.mockReset();
  getUserGroupsMock.mockResolvedValue(SYSTEM_GROUP_FIXTURE);
});

describe("CreateChannelModal — submit gating", () => {
  it("disables the submit button until a non-empty name is entered", () => {
    render(<CreateChannelModal open onClose={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Создать" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "marketing" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("re-disables the submit button when the name is whitespace-only", () => {
    render(<CreateChannelModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Создать" })).toBeDisabled();
  });
});

describe("CreateChannelModal — privacy radios", () => {
  it("calls createChannel with privacy=public by default", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(<CreateChannelModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "marketing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "marketing",
          description: undefined,
          privacy: "public",
          topicsPolicy: undefined,
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls createChannel with privacy=private when the private radio is selected", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    render(<CreateChannelModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "secret" },
    });
    fireEvent.click(
      screen.getByLabelText("Приватный — только по приглашению"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "secret",
          description: undefined,
          privacy: "private",
          topicsPolicy: undefined,
        }),
      );
    });
  });

  it("trims the name and forwards a non-empty description", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    render(<CreateChannelModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "  marketing  " },
    });
    fireEvent.change(screen.getByLabelText("Описание"), {
      target: { value: "Маркетинг и кампании" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "marketing",
          description: "Маркетинг и кампании",
          privacy: "public",
          topicsPolicy: undefined,
        }),
      );
    });
  });
});

describe("CreateChannelModal — topics policy", () => {
  it("defaults to inherit (no override on the wire)", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    render(<CreateChannelModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "general" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({ topicsPolicy: undefined }),
      );
    });
  });

  it("forwards empty_topic_only when the 'Без тем' radio is selected", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    render(<CreateChannelModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "general" },
    });
    fireEvent.click(screen.getByLabelText("Без тем (общий чат)"));
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({ topicsPolicy: "empty_topic_only" }),
      );
    });
  });

  it("forwards disable_empty_topic when the 'Темы обязательны' radio is selected", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    render(<CreateChannelModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "marketing" },
    });
    fireEvent.click(screen.getByLabelText("Темы обязательны"));
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({ topicsPolicy: "disable_empty_topic" }),
      );
    });
  });
});

describe("CreateChannelModal — posting policy", () => {
  it("resolves the chosen system-group to its numeric id (Администраторы → 14)", async () => {
    createChannelMock.mockResolvedValueOnce(undefined);
    render(<CreateChannelModal open onClose={vi.fn()} />);

    // Wait for the user-groups list to load so the Select is enabled.
    await waitFor(() => {
      expect(getUserGroupsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "announce" },
    });
    fireEvent.change(
      screen.getByLabelText("Кто может писать в канал"),
      { target: { value: "role:administrators" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createChannelMock).toHaveBeenCalledWith(
        expect.objectContaining({ canSendMessageGroup: 14 }),
      );
    });
  });
});

describe("CreateChannelModal — error path", () => {
  it("surfaces a server error and keeps the modal open", async () => {
    createChannelMock.mockRejectedValueOnce(new Error("Boom"));
    const onClose = vi.fn();
    render(<CreateChannelModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Название"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
