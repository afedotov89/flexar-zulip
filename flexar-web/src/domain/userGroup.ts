// User-group domain re-export.
//
// The wire shape of a user group is owned by the API-layer type file
// (`src/api/types.ts`), where it was introduced in Phase A1 together
// with the CRUD parameter types. Domain consumers (stores, reducers,
// features) must depend on `src/domain`, never on `src/api/types`
// directly (ENGINEERING_GUIDE §6), so this file re-exports the type
// through the domain surface. It is the same object — there is no
// shape translation — purely an import boundary.

export type { UserGroup } from "../api/types";
