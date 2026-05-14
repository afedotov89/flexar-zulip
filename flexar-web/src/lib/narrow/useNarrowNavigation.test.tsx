// Tests for the navigation helper (`src/lib/narrow/useNarrowNavigation`).
//
// The hook turns a narrow or built-in view into a router navigation.
// Each test mounts it under a MemoryRouter, fires a navigator, and
// reads back the resulting location via a probe component.

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Narrow } from "../../domain";
import { getBuiltinView, type BuiltinView } from "./builtinViews";
import { useNarrowNavigation } from "./useNarrowNavigation";

// Renders the current pathname, and exposes the navigators via a
// callback so a test can drive them.
function NavProbe({
  onReady,
}: {
  onReady: (nav: ReturnType<typeof useNarrowNavigation>) => void;
}) {
  const nav = useNarrowNavigation();
  const { pathname } = useLocation();
  onReady(nav);
  return <div data-testid="pathname">{pathname}</div>;
}

// Mount the probe and return `act`-wrapped navigators plus a reader
// for the resulting pathname. The latest `nav` reference is tracked
// across re-renders, since each navigation re-renders the probe.
function setup() {
  let nav: ReturnType<typeof useNarrowNavigation> | undefined;
  render(
    <MemoryRouter initialEntries={["/narrow"]}>
      <NavProbe
        onReady={(n) => {
          nav = n;
        }}
      />
    </MemoryRouter>,
  );
  const requireNav = (): ReturnType<typeof useNarrowNavigation> => {
    if (nav === undefined) {
      throw new Error("navigation hook did not initialise");
    }
    return nav;
  };
  return {
    goToNarrow: (narrow: Narrow) => {
      act(() => requireNav().goToNarrow(narrow));
    },
    goToView: (view: BuiltinView) => {
      act(() => requireNav().goToView(view));
    },
    pathname: () => screen.getByTestId("pathname").textContent,
  };
}

describe("useNarrowNavigation", () => {
  it("navigates to an arbitrary narrow", () => {
    const { goToNarrow, pathname } = setup();
    goToNarrow([
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "design" },
    ]);
    expect(pathname()).toBe("/narrow/channel/7/topic/design");
  });

  it("navigates to the empty narrow as the narrow root", () => {
    const { goToNarrow, pathname } = setup();
    goToNarrow([{ operator: "channel", operand: 3 }]);
    expect(pathname()).toBe("/narrow/channel/3");
    goToNarrow([]);
    expect(pathname()).toBe("/narrow");
  });

  it("navigates to a narrow-backed built-in view", () => {
    const { goToView, pathname } = setup();
    goToView(getBuiltinView("mentions"));
    expect(pathname()).toBe("/narrow/is/mentioned");
  });

  it("navigates to a special built-in view", () => {
    const { goToView, pathname } = setup();
    goToView(getBuiltinView("inbox"));
    expect(pathname()).toBe("/inbox");
  });
});
