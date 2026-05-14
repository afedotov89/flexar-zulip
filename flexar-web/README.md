# Flexar Hub Web

A from-scratch React frontend for the Flexar Hub corporate messenger, using a
Zulip server purely as the backend (REST + events API). The Zulip server is not
modified and its own web frontend is not used.

See [`PRD.md`](./PRD.md) for the full product requirements and architecture.

## Getting started

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` to the Zulip backend stand. Copy `.env.example`
to `.env` and adjust `VITE_ZULIP_BACKEND` if needed.

## Scripts

| Script              | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the Vite dev server (port 5173)    |
| `npm run build`     | Type-check and produce a production build |
| `npm run preview`   | Preview the production build             |
| `npm run typecheck` | `tsc --noEmit` type check                |
| `npm run lint`      | ESLint + Stylelint                       |
| `npm run format`    | Prettier (write)                         |
| `npm run test`      | Vitest unit tests                        |
| `npm run e2e`       | Playwright end-to-end tests              |

## Project structure

`src/` follows PRD §4.4: `app/`, `theme/`, `api/`, `realtime/`, `stores/`,
`domain/`, `components/`, `features/`, `pages/`, `lib/`, `icons/`. Unit tests
live in `tests/`, Playwright specs in `e2e/`.
