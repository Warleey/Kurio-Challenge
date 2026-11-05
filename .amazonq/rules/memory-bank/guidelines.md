# Kurio — Development Guidelines

## Code Style & Formatting

### Density
- Production source files (`handlers.ts`, `Checkout.tsx`, `domain.ts`) are written in extremely dense, minified-style TypeScript — minimal whitespace, multiple statements per line, no blank lines between logical sections. Match this style when editing those files.
- Config and fixture files (`fixtures.ts`, `scenarios.ts`, `playwright.config.ts`) use normal formatting with comments. Match the style of the file being edited.

### Naming Conventions
- Variables and functions: `camelCase` (`getScenario`, `fromEth`, `maybeFail`)
- Types and interfaces: `PascalCase` (`NFT`, `CartItem`, `Quote`, `Order`, `NftUpdatedPayload`)
- Constants: `UPPER_SNAKE_CASE` for module-level keys (`PENDING_KEY`, `ALICE`, `BOB`, `SCALE`)
- CSS class names: `kebab-case` (`.product-card`, `.mobile-wallet-card`, `.checkout-layout`, `.realtime-alert`)
- React components: `PascalCase` named exports (`export function Checkout()`, `export const Button`)

### TypeScript Patterns
- Strict mode enforced: `noUnusedLocals`, `noUnusedParameters` — every declared variable must be used
- Inline type assertions preferred over separate type declarations: `const d = await request.json() as {name:string;email:string}`
- Type imports use `import type` syntax: `import type {NFT, CartItem} from './domain'`
- Avoid `any` except for E2E test `page.evaluate` contexts where `(window as any).__appSocket` is acceptable
- Use `unknown` for caught errors: `catch(e){setError(message(e))}`

## Architectural Patterns

### API Layer (`src/lib/api.ts`)
- All HTTP calls go through the shared `api` Axios instance (baseURL `/api`, timeout 8000ms)
- Error messages extracted via `message(e)` helper — always use this, never access `e.message` directly
- Session expiry (401) handled globally via interceptor; register handler with `setSessionExpiredHandler(fn)`
- API functions are plain `async` functions returning typed data, not hooks:
  ```ts
  export const getNfts = async (q: Record<string, string>) =>
    (await api.get<{items: NFT[]; total: number; pages: number}>('/nfts', {params: q})).data;
  ```

### Data Fetching (TanStack Query)
- Query keys follow a consistent hierarchy: `['resource']`, `['resource', id]`, `['resource', deps, param]`
  - `['nfts']`, `['nft', id]`, `['cart']`, `['quote', items, coupon]`, `['session']`, `['order', id]`
- Always invalidate related queries after mutations: cart changes → invalidate `['cart']` and `['quote']`
- Use `enabled` to gate queries on auth: `enabled: !!session`
- Access `queryClient` via `useQueryClient()` for imperative invalidation

### Real-time Reconciliation (`src/lib/socket.ts`)
- Socket.IO singleton: always use `getSocket()`, never create `io()` directly
- Events are versioned — use `isStale(resourceId, version)` pattern to deduplicate:
  ```ts
  const seen = new Map<string, number>();
  function isStale(resourceId: string, version: number): boolean {
    const last = seen.get(resourceId) ?? -1;
    if (version <= last) return true;
    seen.set(resourceId, version);
    return false;
  }
  ```
- Socket events trigger cache invalidation (REST as source of truth), never direct cache writes
- Expose socket as `window.__appSocket` for E2E test access
- Reconnect handler always invalidates `['nfts']`, `['cart']`, `['quote']`

### ETH Math (`src/lib/domain.ts`)
- Never use floating-point for ETH arithmetic — always use BigInt milliETH (×1000):
  ```ts
  const SCALE = 1000n;
  const fromEth = (s: string) => { const [i, f=''] = s.split('.'); return BigInt(i)*SCALE + BigInt((f+'000').slice(0,3)) };
  const eth = (n: bigint) => `${n/SCALE}.${(n%SCALE).toString().padStart(3,'0')}`;
  ```
- Display formatting: use `pretty(s)` for user-facing ETH values (locale-formatted with "ETH" suffix)

### MSW Handlers (`src/mocks/handlers.ts`)
- All handlers use MSW v2 API: `http.get/post/put/patch` from `msw`, `HttpResponse.json()` for responses
- In-browser DB pattern: single `db` object initialized from `localStorage`, persisted via `save()` after every mutation
- Error helper: `const err = (message: string, status: number) => HttpResponse.json({message}, {status})`
- Auth guard: `const user = () => db.users.find(u => u.id === db.session)` — check `user()` before protected operations
- Idempotency: check `db.keys[key]` before creating orders; return existing order if key+body match
- Simulate async confirmation: `setTimeout(() => { broadcastOrderUpdated(...) }, 3000)` after order creation

### Network Scenarios (`src/mocks/scenarios.ts`)
- Always call `await jitter(baseMs)` at the start of GET handlers to simulate realistic latency
- Always call `maybeFail()` and return early if non-null for handlers that should support chaos/offline:
  ```ts
  http.get(`${base}/nfts`, async ({request}) => {
    await jitter(220);
    const fail = maybeFail();
    if (fail) return fail;
    // ... handler logic
  })
  ```
- Scenarios activated via `localStorage.setItem('kurio-scenario', 'slow|chaos|offline|expired|timeout-order')`
- POST /orders must check `shouldTimeoutOrder()` and await a 15s delay if true

### Component Patterns (`src/components/ui-button.tsx`)
- Button uses Radix `Slot` for `asChild` polymorphism (shadcn pattern):
  ```ts
  const C = asChild ? Slot : 'button';
  return <C ref={ref} className={clsx('button', variant, className)} {...props} />;
  ```
- Use `clsx` for conditional class merging, never string concatenation
- Variants: `'primary'` (default), `'outline'`, `'ghost'`

### Idempotent Checkout (`src/pages/Checkout.tsx`)
- Idempotency key persisted to `localStorage` (`kurio-idem-key`) — survives page reload
- Before submitting, re-fetch latest quote and compare `version` + `total` — reject if changed
- Pending order ID stored in `localStorage` (`kurio-pending-order`) — redirect to receipt on remount
- Two-step submit: first click sets `review=true`, second click sends the order
- Price change detection: compare `quote.version` via `useRef` across renders, set `priceChanged` state

## Testing Patterns (Playwright)

### Configuration (`playwright.config.ts`)
- Two projects: `desktop` (1440×900, Desktop Chrome) and `mobile` (iPhone 13, Chromium)
- Base URL: `http://127.0.0.1:5173`; reuses existing dev server
- Timeout: 30s per test; traces retained on failure

### E2E Conventions (`tests/`)
- Detect project in test: `const mobile = () => test.info().project.name === 'mobile'`
- Reset DB before each test: `await page.evaluate(() => localStorage.removeItem('kurio-db-v1'))` then `page.reload()`
- Wait for socket ready: `await page.waitForFunction(() => !!(window as any).__socketReady, { timeout: 8000 })`
- Emit socket events in tests via `window.__appSocket`: `page.evaluate(() => { (window as any).__appSocket.emit('nft.updated', payload) })`
- Use semantic selectors: `getByRole('button', {name: ...})`, `getByRole('alert')`, `getByLabel(...)` — avoid brittle CSS selectors
- Use `filter({ hasText: /regex/i })` for text matching in Portuguese UI strings

### Fixture Users
- ALICE: `alice@kurio.test` / `alice1234` — primary collector, Ethereum wallet
- BOB: `bob@kurio.test` / `bob1234` — secondary trader, Polygon wallet
- Passwords stored as pre-computed SHA-256 hashes in `fixtures.ts` (do not recompute at runtime)

## File Organization Rules
- Domain types and data: `src/lib/domain.ts` — no React imports
- HTTP functions: `src/lib/api.ts` — no React imports, no MSW imports
- Socket logic: `src/lib/socket.ts` — React hooks allowed (`useEffect`, `useQueryClient`)
- Mock handlers: `src/mocks/handlers.ts` — imports from `domain`, `fixtures`, `scenarios`, `socket-handlers`
- Pages are self-contained: inline all state, queries, and JSX — no separate hook files currently
- New UI components go in `src/components/` following the `ui-button.tsx` naming pattern

## What NOT to Do
- Do not add `tailwind.config.js` — Tailwind v4 is configured via the Vite plugin only
- Do not use `rest` from MSW — use `http` (MSW v2 API)
- Do not use floating-point for ETH math — always use BigInt via `fromEth`/`eth` helpers
- Do not create new `io()` socket instances — always use `getSocket()` singleton
- Do not write cache directly on socket events — always use `qc.invalidateQueries()`
- Do not add tests unless explicitly requested
