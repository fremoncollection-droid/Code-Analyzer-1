# MirrorTech POS

A full-featured point-of-sale system for Ghana, built for MirrorTech with multi-branch support, GRA E-VAT receipts, MTN/Telecel MoMo integration, offline-first cart, and shift scheduling.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pos-dashboard run dev` — run the POS frontend (port 18295)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, port 8080, path `/api`
- Frontend: React 19 + Vite 7, Tailwind v4, shadcn/ui, Wouter router, TanStack Query v5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — database schema (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middleware/auth.ts` — JWT authentication middleware
- `artifacts/pos-dashboard/src/pages/` — React page components
- `artifacts/pos-dashboard/src/lib/auth.tsx` — Auth context + location selector

## Architecture decisions

- **Contract-first API**: OpenAPI spec is the source of truth; client hooks and Zod schemas are generated from it via Orval. Never hand-write API client code.
- **JWT auth** stored in localStorage (`pos_token`); `setAuthTokenGetter` wires it into every generated hook automatically.
- **Branch-scoped access**: non-admin/manager users see only their assigned `locationId`; location selector in sidebar for admin/manager.
- **Offline-first cart**: sales queued to `localStorage` key `pos_offline_queue` when offline; synced via `POST /api/transactions/sync` on reconnect.
- **MoMo**: simulated in-memory store for demo (no live API keys); upgrade by replacing `artifacts/api-server/src/routes/momo.ts` with real MTN/Telecel USSD Push calls.
- **GRA E-VAT**: receipt endpoint returns `graReceiptNumber = "GRA-" + receiptNumber`; printed in thermal receipt modal.

## Product

- **Login** — JWT auth with demo credentials shown on login screen
- **Dashboard** — KPI cards (revenue, transactions, avg order, low stock) + sales trend chart + payment split pie
- **POS Terminal** — product grid with search/category filter, cart with quantity controls, cash/MoMo/card checkout, offline queue with sync
- **Inventory** — full CRUD, low-stock alerts, category filtering, search
- **Transactions** — list with payment filter, receipt viewer (GRA E-VAT format), void with reason
- **Analytics** — revenue trend, payment split, top items bar chart; period selector (today/week/month/year)
- **Shifts** — schedule shifts, clock in/out, manager approval
- **Transfers** — request stock moves between branches, manager approval
- **Settings** — profile, location management, seed demo data

## User preferences

- Deep teal color scheme (`hsl(174 72% 36%)` primary)
- Ghana Cedi (₵) currency, 15% VAT rate, GRA E-VAT receipts
- Demo credentials: `admin / admin123`, `cashier1 / cash123`, `manager1 / mgr123`
- Seed via `POST /api/seed` or the "Seed Data" button in Settings

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before editing frontend pages
- `req.params.id` must be cast with `String(req.params.id)` before passing to Drizzle `eq()` to avoid TS overload errors
- `useGetReceipt` and `useGetMoMoStatus` query options need `as any` cast because generated hooks expect full `UseQueryOptions` including `queryKey`
- JWT_SECRET defaults to `"mirrortech-dev-secret"` if env var missing (set a real secret in production)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
