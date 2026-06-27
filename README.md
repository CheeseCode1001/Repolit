# <img src="artifacts/frontend/public/logo-icon.png" width="32" height="32" alt="Repolit Logo" /> Repolit

**AI-powered repository analysis — understand any codebase in seconds.**

Repolit scans GitHub repositories (or local codebases) and uses Gemini AI to generate a comprehensive analysis: architecture maps, security audits, onboarding guides, and an AI chat interface that answers questions about the code.

[![MIT License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-💜-ea4aaa.svg)](https://github.com/sponsors/CheeseCode1001)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Instant Repo Scanning** | Paste a GitHub URL or connect via OAuth to import repos directly. |
| 🧠 **AI-Powered Analysis** | Gemini AI generates deep-dive summaries, architecture diagrams, and security audits. |
| 🗺️ **Architecture Viewer** | Interactive Mermaid and React Flow diagrams visualizing how the codebase is structured. |
| 🧭 **Start Here Guide** | AI picks the most important files for onboarding and explains why each matters. |
| 🛡️ **Security Audit** | Automated vulnerability detection with severity ratings and remediation advice. |
| 💬 **Ask AI Chat** | Chat directly with the AI about the analyzed codebase — ask where auth is handled, how to add a route, etc. |
| 📤 **Share Analysis** | Generate shareable links so anyone can view a repo's analysis without logging in. |
| 📦 **Local Repo Upload** | Upload a `.zip` of a local project for analysis — no GitHub required. |
| 🔔 **Browser Notifications** | Get notified when long-running analyses complete, even in a background tab. |
| 🌙 **Dark / Light Mode** | Full theme support with a polished, modern UI. |

---

## 🖼️ Screenshots

> Screenshots coming soon — run the app locally and explore!

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, TypeScript, Shadcn UI, Wouter, React Query |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL (or embedded PGLite for zero-setup local dev) |
| **ORM** | Drizzle ORM |
| **AI** | Google Gemini API |
| **Auth** | Clerk |
| **API Spec** | OpenAPI + Orval (auto-generated type-safe clients & Zod schemas) |
| **Monorepo** | PNPM Workspaces |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **PNPM** (install with `npm install -g pnpm`)
- A **Clerk** account ([clerk.com](https://clerk.com)) — free tier works
- A **Gemini API key** ([aistudio.google.com](https://aistudio.google.com))

### 1. Clone & Install

```bash
git clone https://github.com/CheeseCode1001/Repograph.git
cd Repograph
pnpm install
```

### 2. Configure Environment

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | From your Clerk dashboard |
| `CLERK_SECRET_KEY` | ✅ | From your Clerk dashboard |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | ✅ | From Google AI Studio |
| `GITHUB_OAUTH_CLIENT_ID` | Optional | For GitHub repo import via OAuth |
| `GITHUB_OAUTH_CLIENT_SECRET` | Optional | For GitHub repo import via OAuth |
| `DATABASE_URL` | Pre-filled | Defaults to embedded PGLite (no Postgres needed!) |

> **Note:** If using GitHub OAuth, register your app's callback URL as `http://localhost:5173/api/github/oauth/callback`.

### 3. Setup Database

```bash
pnpm --filter @workspace/db run migrate
```

### 4. Generate API Clients

```bash
pnpm --filter @workspace/api-spec run generate
```

### 5. Start Development Servers

Open **two terminals**:

```bash
# Terminal 1 — API Server (http://127.0.0.1:8080)
pnpm run dev:api

# Terminal 2 — Frontend (http://localhost:5173)
pnpm run dev:web
```

Open `http://localhost:5173` in your browser — you're all set! 🎉

---

## 📁 Project Structure

```
.
├── artifacts/                  # Deployable applications
│   ├── api-server/             # Express.js backend API
│   │   └── src/
│   │       ├── routes/         # API endpoints (repos, github, profile, sharing)
│   │       ├── middlewares/    # Clerk auth, user resolution
│   │       └── lib/            # Logger, utilities
│   └── frontend/               # React + Vite frontend
│       └── src/
│           ├── components/     # UI components + Shadcn primitives
│           ├── pages/          # Home, Repo Dashboard, Profile, Shared
│           ├── hooks/          # Custom React hooks
│           └── lib/            # Notifications, utilities
├── lib/                        # Shared packages
│   ├── api-spec/               # OpenAPI spec (source of truth)
│   ├── api-client-react/       # Generated React Query hooks (DO NOT EDIT)
│   ├── api-zod/                # Generated Zod schemas (DO NOT EDIT)
│   ├── db/                     # Drizzle ORM schema & migrations
│   └── integrations-gemini-ai/ # Gemini AI client & batch processing
├── scripts/                    # Setup & utility scripts
├── CONTRIBUTING.md             # Contribution guide
├── CODE_OF_CONDUCT.md          # Contributor Covenant
├── SECURITY.md                 # Security policy
└── LICENSE                     # MIT License
```

---

## 🔧 Available Scripts

Run from the repository root:

| Command | Description |
|---|---|
| `pnpm run dev:web` | Start the frontend dev server |
| `pnpm run dev:api` | Start the API server |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm run typecheck` | Run TypeScript checks across all workspaces |
| `pnpm --filter @workspace/api-spec run generate` | Regenerate API clients & Zod schemas |
| `pnpm --filter @workspace/db run migrate` | Run database migrations |
| `pnpm --filter @workspace/db run generate-migration <name>` | Generate a new migration |

---

## 🤝 Contributing

We love contributions! Whether it's a bug fix, new feature, or documentation improvement — all are welcome.

Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

Quick links:
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Issue Templates](.github/ISSUE_TEMPLATE/)
- [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md)

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(frontend): add dark mode toggle
fix(api): handle empty repo URL gracefully
docs: update contributing guide
```

---

## 💜 Support the Project

If you find Repolit useful, consider supporting the development:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-💜-ea4aaa?style=for-the-badge)](https://github.com/sponsors/CheeseCode1001)

Your support helps keep the servers running and enables us to build more features!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) — for powering the AI analysis
- [Clerk](https://clerk.com/) — for authentication
- [Shadcn UI](https://ui.shadcn.com/) — for beautiful UI components
- [Drizzle ORM](https://orm.drizzle.team/) — for type-safe database access
- [Orval](https://orval.dev/) — for API client generation

---

<p align="center">
  <strong>Repolit</strong> — AI-powered repo analysis<br/>
  Built with 💜 by <a href="https://github.com/CheeseCode1001">CheeseCode1001</a>
</p>
