# Kurio — Product Overview

## Purpose
Kurio is a frontend challenge prototype for Jungle Gaming — an NFT marketplace where users browse, filter, and purchase digital collectibles (NFTs) using ETH. It demonstrates a full e-commerce flow: catalog → detail → cart → checkout → receipt, with real-time order status updates via Socket.IO.

## Key Features
- **NFT Catalog**: Browse 12 NFTs with search, filter (category/network/price range), sort (price asc/desc), and pagination — all synced to URL via TanStack Router.
- **Cart**: Anonymous and authenticated cart with item quantity management and stock validation.
- **Checkout**: Quote with coupon support (`KURIO10` = 10% off), idempotent order submission, and simulated payment flow (pending → confirmed/declined after 3s).
- **Real-time Sync**: Socket.IO events (`nft.updated`, `order.updated`) reconciled via TanStack Query cache invalidation with versioned deduplication.
- **Auth**: Register/login/logout with mock SHA-256 password hashing; guest cart merges on login; session expiry interceptor.
- **Account Management**: Profile editing, avatar, password change, primary/secondary wallet CRUD.
- **Responsive Layout**: Desktop and mobile (414px reference); login/register as dialog on desktop, full screen on mobile.

## Target Users
Frontend developers and technical reviewers evaluating the candidate's ability to build a production-quality NFT marketplace UI with real-time capabilities.

## ETH Value Handling
All prices stored as strings; arithmetic done in integer milliETH (×1000) using BigInt to avoid floating-point errors.
- `fromEth(s)` → BigInt milliETH
- `eth(n)` → string with 3 decimal places
- `pretty(s)` → locale-formatted display string

## Mock Data
- 12 NFT fixtures in `src/lib/domain.ts`
- In-browser DB persisted to `localStorage` key `kurio-db-v1`
- Demo coupon: `KURIO10`
- Reset: `POST /api/demo/reset` or remove `kurio-db-v1` from DevTools
- Two seed users: ALICE and BOB (from `src/mocks/fixtures.ts`)
