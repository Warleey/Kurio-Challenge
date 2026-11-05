# Kurio — Project Structure

## Directory Layout
```
kurio/
├── public/
│   ├── mockServiceWorker.js     # MSW service worker (must be served at root)
│   └── nfts/                    # NFT image assets (PNG)
├── src/
│   ├── components/
│   │   └── ui-button.tsx        # Radix Slot-based Button (shadcn pattern)
│   ├── lib/
│   │   ├── api.ts               # Axios instance, API functions, session interceptor
│   │   ├── domain.ts            # Types, NFT fixtures, ETH math utilities
│   │   └── socket.ts            # Socket.IO singleton, versioned event dedup, useRealtimeSync hook
│   ├── mocks/
│   │   ├── browser.ts           # MSW browser worker setup
│   │   ├── fixtures.ts          # Seed users (ALICE, BOB) and their carts
│   │   ├── handlers.ts          # All REST mock handlers + in-browser DB
│   │   ├── scenarios.ts         # Test scenario helpers (jitter, maybeFail, timeout)
│   │   └── socket-handlers.ts   # Socket.IO broadcast helpers for mocks
│   ├── pages/
│   │   ├── Account.tsx          # Account/profile/wallet management page
│   │   └── Checkout.tsx         # Cart → quote → order submission page
│   ├── main.tsx                 # App entry: QueryClient, Router, MSW init, useRealtimeSync
│   ├── style.css                # Global styles + Tailwind v4 imports
│   └── vite-env.d.ts            # Vite env type declarations
├── tests/
│   ├── account.spec.ts          # Account CRUD E2E tests
│   ├── flow.spec.ts             # Full purchase flow E2E
│   ├── mobile-responsive.spec.ts # Viewport width tests (320–1440px)
│   ├── promo.spec.ts            # Coupon/promo code E2E
│   └── realtime.spec.ts         # Socket.IO real-time event E2E
├── index.html                   # SPA entry point
├── package.json
├── playwright.config.ts         # Playwright E2E config
├── tsconfig.json                # Strict TypeScript, ES2022, Bundler resolution
├── vite.config.ts               # Vite + React + Tailwind v4 plugins
└── vercel.json                  # SPA fallback routing for direct URL access
```

## Core Relationships
- `domain.ts` → defines all shared types (`NFT`, `CartItem`, `Quote`, `Order`) and ETH math; imported by `api.ts`, `handlers.ts`, and pages.
- `handlers.ts` → implements the entire in-browser REST API using an in-memory DB backed by `localStorage`; imports from `domain.ts`, `fixtures.ts`, `scenarios.ts`, `socket-handlers.ts`.
- `api.ts` → thin Axios wrapper over `/api/*`; consumed by pages via TanStack Query hooks.
- `socket.ts` → Socket.IO singleton + `useRealtimeSync` hook that invalidates TanStack Query caches on `nft.updated` / `order.updated` events.
- `main.tsx` → bootstraps MSW (when `VITE_MOCKS=true`), wraps app in `QueryClientProvider` + TanStack Router, calls `useRealtimeSync`.

## Architectural Patterns
- **MSW-first mocking**: All API calls go through MSW handlers in dev/build; toggle off with `VITE_MOCKS=false`.
- **URL-as-state**: Search, filters, sort, and pagination live in URL search params via TanStack Router.
- **Optimistic cache reconciliation**: Socket events trigger `qc.invalidateQueries(...)` rather than direct cache writes, letting REST be the source of truth.
- **Idempotent orders**: Client generates a UUID key per checkout attempt; server deduplicates by key + body hash.
- **Integer ETH math**: All price arithmetic uses BigInt milliETH (×1000) to avoid floating-point drift.
- **Singleton socket**: One `Socket` instance shared app-wide, exposed as `window.__appSocket` for E2E test access.
