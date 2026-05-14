// Flexar Hub Web — the shared ApiClient singleton (Phase 1.1).
//
// `client.ts` defines the `ApiClient` class and `createApiClient`
// factory; this module owns the one process-wide instance the app
// actually uses. Credentials are mutable client state (see
// `client.ts`), so a single shared instance lets the auth layer install
// credentials once and have every later caller — stores, realtime loop,
// query hooks — issue authenticated requests without threading the
// client through props or context.
//
// The singleton is created bare (uncredentialed). The auth layer calls
// `apiClient.setCredentials(...)` after a successful login or on
// rehydrating a persisted session, and `apiClient.clearCredentials()`
// on logout.

import { createApiClient } from "./client";

/** The one shared, app-wide API client. Created without credentials. */
export const apiClient = createApiClient();
