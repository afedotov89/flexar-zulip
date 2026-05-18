// Selector hook: is the signed-in user an organization admin?
//
// Thin wrapper over `useAdminCapabilities().isRealmAdmin`. Kept as a
// dedicated hook so call sites that only need the binary admin flag
// stay readable; new code that gates on a finer-grained capability
// should call `useAdminCapabilities` directly.
//
// Returns `true` for both administrators and owners — every owner has
// the admin-tier permissions the UI gates on. Returns `false` while
// the session is hydrating or the user is below admin.

import { useAdminCapabilities } from "./useAdminCapabilities";

export function useIsAdmin(): boolean {
  return useAdminCapabilities().isRealmAdmin;
}
