# Repolit Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Products

### Repolit (Developer Painkiller)
AI-powered codebase intelligence tool. Users paste a GitHub URL and get:
- **Overview** — senior-engineer-style explanation of the codebase with WHY things are designed the way they are, tradeoffs, and suggestions
- **Start Here** — AI-generated list of 5-7 priority files to read first, each with a "senior insight" callout
- **Architecture** — Interactive architecture viewer with drag-to-pan, scroll-to-zoom, fullscreen, and source-code view (powered by Mermaid.js)
- **Onboarding** — step-by-step contributor guide with real file paths and commands
- **Security** — categorized vulnerability findings with recommendations
- **Ask AI** — contextual chat interface to ask any question about the codebase
- **Theme system** — Light/dark mode toggle (persisted via localStorage, powered by next-themes)

### API Endpoints
- `GET /api/repos` — list repos
- `POST /api/repos` — submit GitHub URL
- `GET /api/repos/:id` — get repo details
- `DELETE /api/repos/:id` — delete repo
- `POST /api/repos/:id/analyze` — SSE streaming analysis
- `GET /api/repos/:id/analysis` — get cached analysis
- `POST /api/repos/:id/chat` — contextual Q&A
- `GET /api/stats` — platform stats

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Auth Architecture

**Clerk auth** powers user identity. Two env vars may differ across Clerk integrations:
- `VITE_CLERK_PUBLISHABLE_KEY` — the frontend's Clerk instance (`ready-magpie-15`). Tokens are issued by this instance.
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — may point to a different instance; not used for token verification.

**API server token verification** (`artifacts/api-server/src/app.ts`):
- At startup, fetches JWKS from `https://<fapi>/v1/jwks` then `/.well-known/jwks.json` (fallback for dev instances)
- Converts the first JWK to PEM using Node's `crypto.createPublicKey`
- Passes it as `jwtKey` to `clerkMiddleware` — bypasses any network call at request time
- Frontend sends `Authorization: Bearer <session-token>` via `ClerkAuthTokenRegistrar` in `App.tsx`
- `ClerkAuthTokenRegistrar` retries `getToken()` once with a 300ms delay when it returns null (handles proxy hydration race condition)

**Production proxy + issuer mismatch fix**:
- In production,  set `VITE_CLERK_PROXY_URL` (e.g. `https://app.repolit.app/api/__clerk`).
- When the proxy is active, Clerk stamps that URL as the JWT `iss` (issuer) claim.
- `clerkMiddleware` reads `process.env.VITE_CLERK_PROXY_URL` as `proxyUrl` — this EXACT value is what the frontend passes to `ClerkProvider`, guaranteeing the issuer check passes.
- In dev (`VITE_CLERK_PROXY_URL` unset), `proxyUrl` is `undefined` so `iss` is checked against the direct FAPI URL.
- `startAnalysis` in `repo.tsx` also retries `getToken()` and sends `credentials: 'include'` as a belt-and-suspenders fallback.

**Per-user data isolation**: `repos` table has `userId TEXT NOT NULL` column. All CRUD routes call `getAuth(req)` and scope queries by `userId`.

## Theme System

- `next-themes` `ThemeProvider` wraps the whole app in `App.tsx` with `attribute="class" defaultTheme="dark"`.
- Light/dark class toggled on `<html>` — Tailwind's `@custom-variant dark (&:is(.dark *))` handles the rest.
- CSS vars: `:root` = light mode, `.dark` = dark mode (zinc-black + green-500 primary).
- Toggle button (Sun/Moon) in the header via `useTheme()`.
- User preference persisted to `localStorage` under key `repograph-theme`.

## Architecture Viewer

`artifacts/developer-painkiller/src/components/architecture-viewer.tsx`:
- Renders Mermaid.js diagram as SVG with full pan (mouse drag / touch) and scroll-to-zoom
- Zoom is cursor-centered for natural feel
- "Source" view shows raw Mermaid code
- Fullscreen mode (Escape to exit)
- Download SVG button
- Double-click to reset view; "Fit" button auto-scales to viewport

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
