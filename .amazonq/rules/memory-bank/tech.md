# Kurio — Technology Stack

## Runtime & Language
- **Node.js**: 20+ required
- **TypeScript**: 5.9, strict mode, `noUnusedLocals`, `noUnusedParameters`, ES2022 target, Bundler module resolution

## Core Framework
- **React**: 19.2 with `react-jsx` transform
- **Vite**: 7.2 with `@vitejs/plugin-react` and `@tailwindcss/vite`

## Routing & Data Fetching
- **TanStack Router**: 1.131 — file-based routing, URL search param sync for filters/pagination
- **TanStack Query**: 5.90 — server state, cache invalidation for real-time reconciliation
- **Axios**: 1.13 — HTTP client with 8s timeout, global 401 interceptor for session expiry

## Styling
- **Tailwind CSS**: v4.1 (Vite plugin, not PostCSS)
- **clsx**: 2.1 — conditional class merging
- **Custom CSS**: `src/style.css` for global overrides

## UI Components
- **Radix UI Slot**: 1.2 — `asChild` pattern for polymorphic Button (shadcn convention)
- **Lucide React**: 0.468 — icon library

## Mocking
- **MSW**: 2.12 — Service Worker mock in browser; `workerDirectory: ["public"]`; disabled with `VITE_MOCKS=false`
- In-browser DB: `localStorage` key `kurio-db-v1`, initialized from fixtures on first load

## Real-time
- **Socket.IO Client**: 4.8 — singleton connection to `/socket.io`; transports: `['websocket', 'polling']`

## Testing
- **Playwright**: 1.56 — E2E tests in `tests/`; Chromium only (`npx playwright install chromium`)

## Build & Deploy
- **Vercel**: SPA fallback configured in `vercel.json` for direct route access
- `mockServiceWorker.js` must be served at the root path in production

## Development Commands
```bash
npm ci                        # Install dependencies
npm run dev                   # Dev server at http://localhost:5173 (host 0.0.0.0)
npm run typecheck             # tsc --noEmit (no build output)
npm run build                 # tsc -b && vite build
npm run preview               # Preview production build
npx playwright install chromium  # Install test browser (one-time)
npm run test:e2e              # Run Playwright E2E suite
```

## Environment Variables
| Variable | Default | Effect |
|---|---|---|
| `VITE_MOCKS` | `true` in dev/build | `false` disables MSW, connects to real API |

## Key Version Constraints
- Tailwind v4 uses Vite plugin (`@tailwindcss/vite`), NOT the PostCSS plugin — do not add `tailwind.config.js`
- MSW v2 uses `http` (not `rest`) from `msw` and `HttpResponse` for responses
- TanStack Router v1 uses file-based routing conventions distinct from v0
