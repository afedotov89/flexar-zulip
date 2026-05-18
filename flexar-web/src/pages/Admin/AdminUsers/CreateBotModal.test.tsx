// Tests for the create-bot modal.
//
// Three things to cover:
//   1. A user with full bot-creation rights sees the Type selector
//      and can switch between generic / incoming / outgoing.
//   2. A user with only `canCreateWriteOnlyBots` sees no selector —
//      the type is locked to Incoming webhook.
//   3. Submit forwards the correct shape to `apiClient.createBot`
//      and renders the success screen with the returned API key.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../realtime", () => ({
  realtimeConnection: {
    onInitialState: () => () => {},
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    getStatus: () => "connected",
  },
}));

const { createBotMock } = vi.hoisted(() => ({
  createBotMock: vi.fn(),
}));
vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: { createBot: createBotMock },
  };
});

import type { AdminCapabilities } from "../../../lib/hooks/useAdminCapabilities";
import { CreateBotModal } from "./CreateBotModal";

function caps(overrides: Partial<AdminCapabilities>): AdminCapabilities {
  return {
    isRealmAdmin: false,
    canManageOrg: false,
    canInviteUsers: false,
    canCreateBots: false,
    canCreateWriteOnlyBots: false,
    canCreateGroups: false,
    canManageAllGroups: false,
    managedGroupIds: new Set<number>(),
    manageableGroupIds: new Set<number>(),
    hasAnyAdminAccess: false,
    ...overrides,
  };
}

beforeEach(() => {
  createBotMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CreateBotModal — type selector gating", () => {
  it("shows the type selector for users in can_create_bots_group", () => {
    render(
      <CreateBotModal
        open={true}
        onClose={() => {}}
        capabilities={caps({ canCreateBots: true })}
        realmUrl="https://chat.example.com"
      />,
    );
    expect(screen.getByLabelText("Тип")).toBeInTheDocument();
  });

  it("locks the type to Incoming webhook for write-only-only users", () => {
    render(
      <CreateBotModal
        open={true}
        onClose={() => {}}
        capabilities={caps({ canCreateWriteOnlyBots: true })}
        realmUrl="https://chat.example.com"
      />,
    );
    // No combobox / select for type.
    expect(screen.queryByRole("combobox", { name: "Тип" })).toBeNull();
    // The locked-type chip text is visible.
    expect(screen.getByText(/Incoming webhook/)).toBeInTheDocument();
  });
});

describe("CreateBotModal — submission", () => {
  it("forwards the form values to apiClient.createBot and shows the new API key", async () => {
    createBotMock.mockResolvedValue({
      user_id: 42,
      api_key: "sk-new",
      avatar_url: "/a",
      default_sending_stream: null,
      default_events_register_stream: null,
      default_all_public_streams: false,
    });

    render(
      <CreateBotModal
        open={true}
        onClose={() => {}}
        capabilities={caps({ canCreateBots: true })}
        realmUrl="https://chat.example.com"
      />,
    );

    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Test Bot" },
    });
    fireEvent.change(screen.getByLabelText("Короткое имя"), {
      target: { value: "test-bot" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createBotMock).toHaveBeenCalledTimes(1);
    });
    expect(createBotMock).toHaveBeenCalledWith({
      fullName: "Test Bot",
      shortName: "test-bot",
      botType: 1, // Generic
      payloadUrl: undefined,
      interfaceType: undefined,
    });

    await waitFor(() => {
      expect(screen.getByText("Бот создан")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("sk-new")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("test-bot-bot@chat.example.com"),
    ).toBeInTheDocument();
  });

  it("sends payload_url and interface_type for outgoing webhook bots", async () => {
    createBotMock.mockResolvedValue({
      user_id: 7,
      api_key: "k",
      avatar_url: "",
      default_sending_stream: null,
      default_events_register_stream: null,
      default_all_public_streams: false,
    });

    render(
      <CreateBotModal
        open={true}
        onClose={() => {}}
        capabilities={caps({ canCreateBots: true })}
        realmUrl="https://chat.example.com"
      />,
    );

    fireEvent.change(screen.getByLabelText("Имя"), {
      target: { value: "Out" },
    });
    fireEvent.change(screen.getByLabelText("Короткое имя"), {
      target: { value: "out" },
    });
    fireEvent.change(screen.getByLabelText("Тип"), {
      target: { value: "outgoing" },
    });
    fireEvent.change(screen.getByLabelText("URL endpoint"), {
      target: { value: "https://example.com/zulip" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(createBotMock).toHaveBeenCalledWith({
        fullName: "Out",
        shortName: "out",
        botType: 3,
        payloadUrl: "https://example.com/zulip",
        interfaceType: 1,
      });
    });
  });

  it("rejects empty short name and shows validation feedback", () => {
    render(
      <CreateBotModal
        open={true}
        onClose={() => {}}
        capabilities={caps({ canCreateBots: true })}
        realmUrl="https://chat.example.com"
      />,
    );
    // Create button is disabled when validation fails.
    expect(
      screen.getByRole("button", { name: "Создать" }),
    ).toBeDisabled();
  });
});
