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

const { createChannelMock } = vi.hoisted(() => ({
  createChannelMock: vi.fn(),
}));
vi.mock("../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../api")>("../../api");
  return {
    ...actual,
    apiClient: {
      createChannel: createChannelMock,
    },
  };
});

import { CreateChannelModal } from "./CreateChannelModal";

beforeEach(() => {
  createChannelMock.mockReset();
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
      expect(createChannelMock).toHaveBeenCalledWith({
        name: "marketing",
        description: undefined,
        privacy: "public",
      });
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
      expect(createChannelMock).toHaveBeenCalledWith({
        name: "secret",
        description: undefined,
        privacy: "private",
      });
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
      expect(createChannelMock).toHaveBeenCalledWith({
        name: "marketing",
        description: "Маркетинг и кампании",
        privacy: "public",
      });
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
