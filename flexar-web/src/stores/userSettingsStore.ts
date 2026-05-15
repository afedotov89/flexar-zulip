// Server-state store: the current user's personal settings (Phase 5.1).
//
// The register snapshot delivers `user_settings` as a flat object
// keyed by setting name (`twenty_four_hour_time`, `enable_sounds`,
// …); the realtime `user_settings update` event carries one
// `(property, value)` change at a time.
//
// We model the bag as `Record<string, unknown>` rather than enumerating
// all ~80 fields. Settings UI consumers read individual keys with
// `getBoolean(name)` / `getNumber(name)` / `getString(name)` selectors,
// which both narrow the value type and tolerate older / newer servers
// that may add or drop a setting.
//
// No `persist`: settings are server-state and re-fetched every connect.

import { create } from "zustand";
import { isUserSettingsUpdateEvent } from "./eventGuards";
import { wireStore } from "./wireStore";

export type UserSettings = Record<string, unknown>;

export interface UserSettingsState {
  settings: UserSettings;
  /** Read a boolean setting; returns `undefined` when missing or not a boolean. */
  getBoolean: (name: string) => boolean | undefined;
  /** Read a numeric setting; returns `undefined` when missing or not a number. */
  getNumber: (name: string) => number | undefined;
  /** Read a string setting; returns `undefined` when missing or not a string. */
  getString: (name: string) => string | undefined;
}

export const useUserSettingsStore = create<UserSettingsState>()((_set, get) => ({
  settings: {},
  getBoolean: (name) => {
    const value = get().settings[name];
    return typeof value === "boolean" ? value : undefined;
  },
  getNumber: (name) => {
    const value = get().settings[name];
    return typeof value === "number" ? value : undefined;
  },
  getString: (name) => {
    const value = get().settings[name];
    return typeof value === "string" ? value : undefined;
  },
}));

wireStore({
  hydrate: (state) => {
    const snapshot = state.user_settings;
    if (
      snapshot === undefined ||
      snapshot === null ||
      typeof snapshot !== "object"
    ) {
      useUserSettingsStore.setState({ settings: {} });
      return;
    }
    useUserSettingsStore.setState({
      settings: { ...(snapshot as UserSettings) },
    });
  },
  applyEvent: (event) => {
    if (!isUserSettingsUpdateEvent(event)) {
      return;
    }
    useUserSettingsStore.setState((state) => ({
      settings: { ...state.settings, [event.property]: event.value },
    }));
  },
});
