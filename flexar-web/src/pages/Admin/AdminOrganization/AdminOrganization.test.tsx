// Tests for the admin organization-settings page (Phase 5.2).
//
// Covers section rendering with realm-store values, the autosave path
// for toggles, the explicit-save path for the org-name input, and the
// add / remove default-channel actions through `apiClient`.
//
// The realtime layer is mocked so `useStoresLoading()` reports
// "connected" — without that the page would render its loading
// spinner instead of the form.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
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

const {
  updateRealmMock,
  addDefaultStreamMock,
  removeDefaultStreamMock,
} = vi.hoisted(() => ({
  updateRealmMock: vi.fn(),
  addDefaultStreamMock: vi.fn(),
  removeDefaultStreamMock: vi.fn(),
}));

vi.mock("../../../api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api")>("../../../api");
  return {
    ...actual,
    apiClient: {
      updateRealm: updateRealmMock,
      addDefaultStream: addDefaultStreamMock,
      removeDefaultStream: removeDefaultStreamMock,
    },
  };
});

import type { Realm } from "../../../domain";
import { useDefaultStreamsStore } from "../../../stores/defaultStreamsStore";
import { useRealmStore } from "../../../stores/realmStore";
import { useStreamsStore } from "../../../stores/streamsStore";
import { makeStream } from "../../../stores/testFixtures";
import { AdminOrganization } from "./AdminOrganization";

function seedRealm(overrides: Partial<Realm> = {}): void {
  useRealmStore.setState({
    realm: {
      realm_name: "Flexar",
      realm_description: "Описание.",
      realm_allow_message_editing: true,
      realm_message_content_edit_limit_seconds: 300,
      realm_message_content_delete_limit_seconds: 600,
      realm_message_retention_days: -1,
      realm_invite_required: false,
      realm_waiting_period_threshold: 0,
      ...overrides,
    },
  });
}

function seedStreams(streamIds: number[]): void {
  const streams: Record<number, ReturnType<typeof makeStream>> = {};
  for (const id of streamIds) {
    streams[id] = makeStream({ stream_id: id, name: `channel-${id}` });
  }
  useStreamsStore.setState({ streams, subscriptions: {} });
}

beforeEach(() => {
  updateRealmMock.mockReset();
  addDefaultStreamMock.mockReset();
  removeDefaultStreamMock.mockReset();
  useRealmStore.setState({ realm: null });
  // Default-streams now live in the register snapshot (no fetch path);
  // tests seed the list directly via `useDefaultStreamsStore.setState`.
  useDefaultStreamsStore.setState({ defaultStreams: [] });
  useStreamsStore.setState({ streams: {}, subscriptions: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminOrganization — rendering", () => {
  it("shows the spinner while the realm-store is empty", () => {
    render(<AdminOrganization />);
    expect(screen.getByRole("status")).toHaveTextContent("Загрузка настроек");
  });

  it("renders the four sections with current realm values", () => {
    seedRealm();

    render(<AdminOrganization />);

    expect(
      screen.getByRole("heading", { name: "Настройки организации" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Сообщения" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Доступ" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Каналы по умолчанию" }),
    ).toBeInTheDocument();

    expect(
      (screen.getByLabelText("Название организации") as HTMLInputElement).value,
    ).toBe("Flexar");
    expect(
      screen.getByLabelText("Разрешить редактирование сообщений"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("Требовать приглашение для регистрации"),
    ).not.toBeChecked();
  });
});

describe("AdminOrganization — message-editing toggle", () => {
  it("calls apiClient.updateRealm with allow_message_editing on toggle", async () => {
    seedRealm({ realm_allow_message_editing: true });
    updateRealmMock.mockResolvedValue(undefined);

    render(<AdminOrganization />);

    fireEvent.click(
      screen.getByLabelText("Разрешить редактирование сообщений"),
    );

    await waitFor(() => {
      expect(updateRealmMock).toHaveBeenCalledWith({
        allow_message_editing: false,
      });
    });
  });
});

describe("AdminOrganization — name save", () => {
  it("calls apiClient.updateRealm with the trimmed name on Save click", async () => {
    seedRealm({ realm_name: "Old" });
    updateRealmMock.mockResolvedValue(undefined);

    render(<AdminOrganization />);

    const input = screen.getByLabelText(
      "Название организации",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Flexar Hub  " } });

    // Save button sits next to the input — find the one belonging to
    // the same row.
    const row = input.closest("div") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(updateRealmMock).toHaveBeenCalledWith({ name: "Flexar Hub" });
    });
  });
});

describe("AdminOrganization — default channels", () => {
  it("removes a channel through apiClient.removeDefaultStream", async () => {
    seedRealm();
    seedStreams([1, 2]);
    useDefaultStreamsStore.setState({ defaultStreams: [1] });
    removeDefaultStreamMock.mockResolvedValue(undefined);

    render(<AdminOrganization />);

    const list = screen.getByRole("list", { name: "Каналы по умолчанию" });
    const item = within(list).getByRole("listitem");
    fireEvent.click(within(item).getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(removeDefaultStreamMock).toHaveBeenCalledWith(1);
    });
  });

  it("adds a channel through apiClient.addDefaultStream from the modal", async () => {
    seedRealm();
    seedStreams([1, 2, 3]);
    useDefaultStreamsStore.setState({ defaultStreams: [1] });
    addDefaultStreamMock.mockResolvedValue(undefined);

    render(<AdminOrganization />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить канал" }));

    const dialog = await screen.findByRole("dialog");
    const select = within(dialog).getByLabelText("Канал") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Добавить" }));

    await waitFor(() => {
      expect(addDefaultStreamMock).toHaveBeenCalledWith(2);
    });
  });
});
