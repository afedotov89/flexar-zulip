// Tests for the URL-reading hooks (`src/lib/narrow/useCurrentNarrow`).
//
// `useCurrentNarrow` / `useCurrentView` are thin wrappers over React
// Router's `useLocation`, so each test mounts the hook under a
// `MemoryRouter` pinned to a specific URL and asserts the parsed
// result. Covers narrow paths, special-view paths, the malformed-path
// fallback, and the narrow→built-in-view matching.

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useCurrentNarrow, useCurrentView } from "./useCurrentNarrow";

// Wrap a hook render in a MemoryRouter pinned to `url`.
function atUrl(url: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
}

describe("useCurrentNarrow", () => {
  it("returns the empty narrow at the narrow root", () => {
    const { result } = renderHook(() => useCurrentNarrow(), {
      wrapper: atUrl("/narrow"),
    });
    expect(result.current).toEqual([]);
  });

  it("parses a channel + topic narrow path", () => {
    const { result } = renderHook(() => useCurrentNarrow(), {
      wrapper: atUrl("/narrow/channel/7/topic/design"),
    });
    expect(result.current).toEqual([
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "design" },
    ]);
  });

  it("returns undefined on a non-narrow path", () => {
    const { result } = renderHook(() => useCurrentNarrow(), {
      wrapper: atUrl("/inbox"),
    });
    expect(result.current).toBeUndefined();
  });

  it("falls back to the empty narrow on a malformed narrow path", () => {
    const { result } = renderHook(() => useCurrentNarrow(), {
      wrapper: atUrl("/narrow/channel/not-a-number"),
    });
    expect(result.current).toEqual([]);
  });
});

describe("useCurrentView", () => {
  it("resolves a special-view path to its view", () => {
    const { result } = renderHook(() => useCurrentView(), {
      wrapper: atUrl("/inbox"),
    });
    expect(result.current?.id).toBe("inbox");
    expect(result.current?.kind).toBe("special");
  });

  it("resolves the narrow root to the Combined feed view", () => {
    const { result } = renderHook(() => useCurrentView(), {
      wrapper: atUrl("/narrow"),
    });
    expect(result.current?.id).toBe("combined");
  });

  it("resolves a narrow-backed built-in view by its narrow", () => {
    const { result } = renderHook(() => useCurrentView(), {
      wrapper: atUrl("/narrow/is/mentioned"),
    });
    expect(result.current?.id).toBe("mentions");
  });

  it("resolves the Reactions view from its two-term narrow", () => {
    const { result } = renderHook(() => useCurrentView(), {
      wrapper: atUrl("/narrow/has/reaction/sender/me"),
    });
    expect(result.current?.id).toBe("reactions");
  });

  it("returns undefined for a narrow that is not a built-in view", () => {
    const { result } = renderHook(() => useCurrentView(), {
      wrapper: atUrl("/narrow/channel/7"),
    });
    expect(result.current).toBeUndefined();
  });

  it("returns undefined on a non-view path", () => {
    const { result } = renderHook(() => useCurrentView(), {
      wrapper: atUrl("/login"),
    });
    expect(result.current).toBeUndefined();
  });
});
