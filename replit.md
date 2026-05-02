# Workspace

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

### Repograph (Developer Painkiller)
AI-powered codebase intelligence tool. Users paste a GitHub URL and get:
- **Overview** — senior-engineer-style explanation of the codebase with WHY things are designed the way they are, tradeoffs, and suggestions
- **Start Here** — AI-generated list of 5-7 priority files to read first, each with a "senior insight" callout (new)
- **Architecture** — Mermaid.js diagram of system data flow
- **Onboarding** — step-by-step contributor guide with real file paths and commands
- **Security** — categorized vulnerability findings with recommendations
- **Ask AI** — contextual chat interface to ask any question about the codebase (new)

### API Endpoints
- `GET /api/repos` — list repos
- `POST /api/repos` — submit GitHub URL
- `GET /api/repos/:id` — get repo details
- `DELETE /api/repos/:id` — delete repo
- `POST /api/repos/:id/analyze` — SSE streaming analysis (now includes startHere)
- `GET /api/repos/:id/analysis` — get cached analysis
- `POST /api/repos/:id/chat` — contextual Q&A (new)
- `GET /api/stats` — platform stats

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
