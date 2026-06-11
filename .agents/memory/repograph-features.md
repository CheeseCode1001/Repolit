---
name: Repograph feature set
description: Summary of all features added — anon sessions, gamification, profile/avatar, repo sharing, React Flow, commit history, zip upload.
---

## Features implemented

- **Anonymous sessions**: UUID in localStorage as `repograph-anon-id`, sent as `X-Anon-Id` header. `resolveUser` middleware accepts Clerk OR anon. Limit: 1 repo for anon, 2 for free signed-in users.
- **Gamification**: 10 pts earned per scan (auth users only), 10 pts to unlock an extra scan. Tracked in `user_profiles.points` and `extra_scans_unlocked`.
- **Profile page** (`/profile`): react-nice-avatar avatar picker, display name / username / bio editor. Profile icon in nav header shows avatar.
- **Repo sharing**: POST `/api/repos/:id/share` generates a random token stored in `shared_repos` table. GET `/api/shared/:token` — no auth required — returns repo + analysis. Share URL format: `{origin}/shared/{token}`.
- **Commit history tab**: fetched from GitHub API during analysis, stored as JSON in `analyses.commit_history`. Rendered in `CommitHistory` component with avatar, message, author, time.
- **React Flow architecture**: `ReactFlowArchitecture` component parses Mermaid syntax to nodes/edges using regex. Toggle between Mermaid and Flow view on the Architecture tab.
- **Zip upload**: POST `/api/repos/upload` with multer memoryStorage. JSZip extracts file tree, fires analysis immediately. Frontend uses hidden file input + `useUploadRepo` hook.
- **DB tables**: `user_profiles` and `shared_repos` added to `@workspace/db`.

## Key files
- `artifacts/api-server/src/middlewares/resolveUser.ts` — `resolveUserId`, `requireClerkAuth`, `ensureUserProfile`
- `artifacts/api-server/src/routes/profile.ts`, `sharing.ts`, `repos.ts`
- `artifacts/developer-painkiller/src/lib/anon-session.ts`
- `artifacts/developer-painkiller/src/components/commit-history.tsx`, `react-flow-architecture.tsx`
- `artifacts/developer-painkiller/src/pages/profile.tsx`, `shared.tsx`
