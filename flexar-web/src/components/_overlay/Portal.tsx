// Flexar Hub Web — Portal (shared overlay helper, Phase 0.6, group D).
//
// Thin wrapper over `createPortal` that renders children into a fresh
// element appended to `document.body`, so overlays (Tooltip, Popover,
// DropdownMenu, Modal) escape any `overflow`/`transform`/stacking
// context of their trigger's ancestors.
//
// jsdom note: `document` exists under the node test environment, so the
// portal works in tests too. Layout APIs (`getBoundingClientRect`) are
// the part that is unreliable in jsdom — see `useOverlayPosition`.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface PortalProps {
  children: React.ReactNode;
}

export function Portal({ children }: PortalProps): React.JSX.Element | null {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    setHost(element);
    return () => {
      document.body.removeChild(element);
    };
  }, []);

  if (host === null) {
    return null;
  }
  return createPortal(children, host);
}
