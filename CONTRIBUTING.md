# Contributing to Repolit

Thanks for your interest in contributing to Repolit. We're happy to have you here.

Please take a moment to review this document before submitting your first pull request. We also strongly recommend that you check for open issues and pull requests to see if someone else is working on something similar.

---

## Table of Contents

1. [Prerequisites and What You Need to Know](#1-prerequisites-and-what-you-need-to-know)
2. [Setup Steps with Exact Commands](#2-setup-steps-with-exact-commands)
3. [Folder Structure Explained](#3-folder-structure-explained)
4. [How to Run, Test, and Verify Your Changes](#4-how-to-run-test-and-verify-your-changes)
5. [How the Main Pieces Connect](#5-how-the-main-pieces-connect-a-mental-model)
6. [Common Gotchas](#6-common-gotchas-or-things-that-trip-up-new-contributors)
7. [Your First Contribution](#7-your-first-contribution-where-to-start-and-what-to-avoid)
8. [Branch Naming](#branch-naming)
9. [Pull Requests](#pull-requests)
10. [Commit Convention](#commit-convention)
11. [Requests for New Components](#requests-for-new-components)

---

## 1. Prerequisites and What You Need to Know

Before you dive into the code, here's what we recommend you're familiar with:

### Core Technologies

| Technology | Purpose |
|---|---|
| **TypeScript** | Repograph is built entirely with TypeScript. Strong typing is central to our development philosophy. |
| **Node.js** | The backend API server runs on Node.js. |
| **React** | Our frontend is a React application, leveraging functional components and hooks. |
| **Express.js** | The backbone of our API server. |
| **PNPM** | We use PNPM workspaces for our monorepo management. |
| **Drizzle ORM** | For type-safe database interactions. |
| **Zod** | Used for schema validation on both the frontend and backend, particularly for API request/response validation. |
| **OpenAPI & Orval** | We define our API using OpenAPI (formerly Swagger), and use Orval to generate type-safe API clients and Zod schemas automatically. |
| **Clerk** | Our chosen solution for authentication and user management. |
| **Git** | For version control. |

### Key Concepts

- **Monorepo Structure** — Understanding how different packages (`artifacts/` and `lib/`) coexist and interact within a single repository.
- **API Client Generation** — How changes in the OpenAPI specification (`lib/api-spec/openapi.yaml`) lead to updated, type-safe client code.
- **Database Migrations** — The process of evolving the database schema using Drizzle.
- **Environment Variables** — How to manage configuration for different environments.

### Tools

- **Git** — Essential for cloning the repository and managing your contributions.
- **Code Editor** — VS Code is highly recommended due to its excellent TypeScript support and integration with Node.js and React.
- **Browser** — For testing the frontend application.
- **API Client** *(Optional but Recommended)* — Tools like Postman or Insomnia can be helpful for testing API endpoints directly.

---

## 2. Setup Steps with Exact Commands

Follow these steps to get your local development environment ready.

### 2.1. Clone the Repository

```bash
git clone https://github.com/CheeseCode1001/Repolit.git
cd Repolit
```

### 2.2. Install PNPM

If you don't have PNPM installed globally, install it using npm:

```bash
npm install -g pnpm
```

### 2.3. Install Dependencies

Navigate to the root of the cloned repository and install all project dependencies using PNPM. This will install dependencies for all workspaces.

```bash
pnpm install
```

### 2.4. Configure Environment Variables

Repograph relies on several environment variables for its configuration, especially for Clerk authentication, GitHub OAuth, and Gemini AI integration.

**1. Create your `.env` file** — Copy the example environment file:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

**2. Populate `.env`** — Open `.env` and fill in the required values:

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Get this from your Clerk dashboard (a test key is sufficient for local development). |
| `CLERK_SECRET_KEY` | Also from your Clerk dashboard. |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | Required for GitHub repository scanning. Register an OAuth application on GitHub with the callback URL `http://localhost:5173/api/github/oauth/callback`. |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Essential for the core AI analysis features. Get this from [Google AI Studio](https://aistudio.google.com/). |
| `DATABASE_URL` | By default, Repograph uses `pglite://.local/repograph-pg`, which is an embedded PostgreSQL-compatible database. This means you **do not** need to install PostgreSQL locally to get started! If you prefer to use a full PostgreSQL instance, uncomment and configure the `postgresql://` line. |

### 2.5. Database Setup

With pglite as the default, the database setup is largely handled for you. However, you need to ensure the schema is up-to-date.

**Run Database Migrations:**

```bash
pnpm --filter @workspace/db run migrate
```

This command applies any pending schema changes defined in `lib/db/src/schema/` to your local database. You can inspect the Drizzle configuration in `lib/db/drizzle.config.ts`.

### 2.6. Generate API Clients and Zod Schemas

Our API client and Zod schemas are automatically generated from `lib/api-spec/openapi.yaml`. Whenever the API specification changes, you **must** regenerate these files to maintain type safety across the frontend and backend.

```bash
pnpm --filter @workspace/api-spec run generate
```

This command will update files in:

- `lib/api-client-react/src/generated/`
- `lib/api-zod/src/generated/`

### 2.7. Start the Development Servers

Repograph consists of two main applications: the frontend and the API server. You'll need to run both concurrently.

Open **two separate terminal windows/tabs**:

**Terminal 1 — Start the API Server:**

```bash
cd artifacts/api-server
pnpm dev
```

> The API server will typically start on `http://127.0.0.1:8080` (configured by `API_PORT` in `.env`).

**Terminal 2 — Start the Frontend Application:**

```bash
cd artifacts/frontend
pnpm dev
```

> The frontend will typically start on `http://localhost:5173` (configured by `PORT` in `.env`).

Once both are running, open your browser to `http://localhost:5173` to access the Repograph application!

---

## 3. Folder Structure Explained

Understanding the monorepo structure is key to navigating the Repograph codebase. We use PNPM workspaces to manage shared code and applications.

```
.
├── .agents/                    # Internal notes/documentation from AI agents
├── artifacts/                  # Main applications (what gets deployed)
│   ├── api-server/             # The Express.js backend API
│   │   ├── src/
│   │   │   ├── app.ts          # Express app setup, middlewares, Clerk integration
│   │   │   ├── index.ts        # Server entry point, port configuration
│   │   │   ├── lib/            # Shared utilities (e.g., logger)
│   │   │   ├── middlewares/    # Custom Express middleware (Clerk proxy, user resolution)
│   │   │   └── routes/         # API endpoint definitions (repos, github, health, etc.)
│   │   ├── build.mjs           # Build script for the API server
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/               # The React (Vite) frontend application
│       ├── public/             # Static assets (favicons, manifest, etc.)
│       ├── scripts/dev.mjs     # Dev server script
│       ├── src/
│       │   ├── App.tsx         # Main application component
│       │   ├── components/     # Reusable UI components
│       │   │   └── ui/         # Shadcn UI components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # Frontend utilities (notifications, utils.ts)
│       │   ├── main.tsx        # Frontend entry point
│       │   └── pages/          # Main application pages (home, repo, profile, shared)
│       ├── package.json
│       └── tsconfig.json
├── lib/                        # Shared libraries and packages
│   ├── api-client-react/       # React Query client (generated by Orval)
│   │   └── src/generated/      # ⚠️ DO NOT EDIT MANUALLY
│   ├── api-spec/               # OpenAPI specification and Orval configuration
│   │   ├── openapi.yaml        # The source of truth for our API specification
│   │   └── orval.config.ts     # Configuration for Orval to generate clients
│   ├── api-zod/                # Zod schemas for API validation (generated by Orval)
│   │   └── src/generated/      # ⚠️ DO NOT EDIT MANUALLY
│   ├── db/                     # Database schema definitions and client (Drizzle ORM)
│   │   ├── drizzle.config.ts   # DrizzleKit configuration
│   │   └── src/schema/         # Drizzle table definitions (analyses, repos, user-profiles)
│   └── integrations-gemini-ai/ # Gemini AI integration client and logic
│       ├── src/batch/          # Batch processing utilities for AI
│       ├── src/client.ts       # Main Gemini AI client
│       └── src/image/          # Image-related AI processing
├── scripts/                    # Root-level utility scripts (post-merge, setup-db)
├── tsconfig.base.json          # Base TypeScript configuration inherited by all packages
└── pnpm-workspace.yaml         # Defines the PNPM monorepo workspaces
```

### Key Highlights

- **`artifacts/`** — These are the deployable units of our application. `api-server` is the backend, and `frontend` is the web UI.
- **`lib/`** — This directory contains shared code and utilities that are used by one or more `artifacts/` packages. Keeping these separate ensures reusability and clear boundaries.
- **`api-spec` is critical** — it defines our API contract. Changes here drive code generation.
- **`api-client-react` and `api-zod` are generated code** — never edit files in their `src/generated` directories manually.
- **`.agents/memory/`** — These files are internal notes or documentation snippets containing specific technical requirements or best practices, like `api-zod-tsconfig.md` which details a `tsconfig.json` requirement for `lib/api-zod`.

---

## 4. How to Run, Test, and Verify Your Changes

### 4.1. Running the Application

As detailed in [Section 2.7](#27-start-the-development-servers), run the frontend and API server concurrently in separate terminals:

```bash
# Terminal 1 (API server)
cd artifacts/api-server
pnpm dev

# Terminal 2 (Frontend)
cd artifacts/frontend
pnpm dev
```

The application will be accessible at `http://localhost:5173`.

### 4.2. Testing and Verification

While we don't currently have comprehensive automated test suites explicitly listed, here's how you can verify your changes:

#### Frontend Changes

- Simply refresh your browser at `http://localhost:5173`. Vite provides fast HMR (Hot Module Replacement) for many changes.
- Interact with the UI to ensure new components or features behave as expected.

#### API Server Changes

- **Manual Testing:** Use your browser or an API client (like Postman or `curl`) to send requests to your local API server (`http://127.0.0.1:8080`).
- **Through Frontend:** Many API changes will be reflected by interacting with the frontend, which consumes the API.
- **Logs:** Monitor the API server terminal for `pino` logs, which provide detailed request/response information and error messages.

#### Type Checking

Always run type checks, especially before committing:

```bash
# For the API server
cd artifacts/api-server
pnpm typecheck

# For the frontend
cd artifacts/frontend
pnpm typecheck
```

For any `lib` package, navigate to that package's directory and run `pnpm typecheck`.

#### API Spec Changes and Codegen

If you modify `lib/api-spec/openapi.yaml` (e.g., adding a new endpoint or modifying an existing one):

1. Update `openapi.yaml`.
2. Regenerate the API clients and schemas:
   ```bash
   pnpm --filter @workspace/api-spec run generate
   ```
3. Run type checks in `lib/api-client-react`, `lib/api-zod`, `artifacts/frontend`, and `artifacts/api-server` to ensure everything is consistent.

#### Database Changes

If you modify the Drizzle schemas in `lib/db/src/schema/`:

1. Update your schema files.
2. Generate a new migration:
   ```bash
   pnpm --filter @workspace/db run generate-migration <migration-name>
   ```
   Replace `<migration-name>` with a descriptive name.
3. Apply the migration:
   ```bash
   pnpm --filter @workspace/db run migrate
   ```
4. Verify changes using a database client or by observing the application's behavior.

---

## 5. How the Main Pieces Connect (A Mental Model)

Think of Repograph as a well-oiled machine with distinct but interconnected parts:

### The API Specification (`lib/api-spec`) — *The Contract*

This is the blueprint for all communication within the system. `lib/api-spec/openapi.yaml` defines every endpoint, its expected inputs (request bodies, query params), and its possible outputs (response schemas). It's the **single source of truth** for the API.

### Code Generation (`orval`) — *Automated Plumbing*

Produces `lib/api-client-react` & `lib/api-zod`:

- When the API spec changes, `orval` automatically generates **type-safe API clients** in `lib/api-client-react`. The frontend uses these generated hooks (e.g., React Query hooks) to make calls to the backend. This ensures the frontend always knows exactly what data to send and what to expect back, catching many errors at compile-time.
- Simultaneously, `orval` generates **Zod validation schemas** in `lib/api-zod`. The API server uses these to validate incoming requests, ensuring that data sent from the frontend (or any other client) conforms to the expected structure.

### The Frontend (`artifacts/frontend`) — *The User Interface*

This is what users interact with:

- A React application built with Vite.
- Uses components from `src/components/` and `src/components/ui/`.
- Communicates with the API server exclusively through the generated `lib/api-client-react` hooks, ensuring type safety and consistency.
- Handles user authentication and sessions via Clerk React SDK.

### The API Server (`artifacts/api-server`) — *The Brains and Data Orchestrator*

An Express.js application, serving as the backend:

- **Authentication:** Integrates with Clerk via `@clerk/express` middleware to secure API routes.
- **Request Handling:** Routes (`src/routes/`) receive requests. Before processing, they often use `lib/api-zod` schemas to validate the incoming data.
- **Core Logic:** Contains the business logic for repository analysis, profile management, sharing, etc.
- **Database Interaction:** Communicates with the PostgreSQL database (or PGLite) via `lib/db` using Drizzle ORM.
- **AI Integration:** Leverages `lib/integrations-gemini-ai` to perform repository scanning and generate reports using Gemini AI models.

### The Database (`lib/db`) — *The Memory*

- Defines our data models (tables, relationships) using Drizzle schema files (`src/schema/`).
- Stores all persistent application data, such as user profiles, repositories, analysis results, and conversations.

### In Essence

> The `api-spec` acts as the definitive contract. Orval translates this contract into executable, type-safe code for both the frontend (`client-react`) and backend (`api-zod`). The frontend uses its generated client to talk to the `api-server`, which uses its generated schemas for validation, interacts with the `db` for data persistence, and leverages AI integrations for core functionality.

---

## 6. Common Gotchas or Things That Trip Up New Contributors

| Gotcha | Details |
|---|---|
| **Missing `.env` Variables** | The application (especially Clerk, GitHub, and Gemini AI features) won't function correctly if required variables in `.env` are missing or misconfigured. Always double-check `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `AI_INTEGRATIONS_GEMINI_API_KEY`. |
| **Forgetting `pnpm install`** | Always run `pnpm install` from the **root** of the repository (`Repolit/`) initially to install all workspace dependencies. If you add a new dependency to a specific `package.json` later, run `pnpm install` from the root again. |
| **API Spec / Codegen Mismatches** | If you change an API endpoint but forget to update `lib/api-spec/openapi.yaml` and run `pnpm --filter @workspace/api-spec run generate`, you will encounter runtime errors or TypeScript type mismatches. **Always regenerate clients after API spec changes!** |
| **Database Migrations** | After modifying a Drizzle schema file in `lib/db/src/schema/`, you **must** generate a new migration and apply it to your database. Failing to do so will result in runtime errors. |
| **TypeScript `dom` Lib for `lib/api-zod`** | `lib/api-zod/tsconfig.json` requires `"lib": ["es2022", "dom"]`. This is because `File` (used in multipart form data handling) is a DOM type. If you remove `dom`, `tsc --build` will fail. |
| **Running Commands in Wrong Workspace** | `pnpm dev` in `artifacts/frontend` starts the frontend; `pnpm dev` in `artifacts/api-server` starts the backend. Use `pnpm --filter <workspace-name> <command>` for root-level execution. |
| **Port Conflicts** | The frontend uses `5173` and the API server uses `8080`. If you have other services running on these ports, update `PORT` and `API_PORT` in your `.env` file. |
| **Clerk OAuth Redirect URLs** | For GitHub OAuth to work with Clerk locally, ensure your GitHub OAuth application's callback URL is precisely `http://localhost:5173/api/github/oauth/callback`. |

---

## 7. Your First Contribution: Where to Start and What to Avoid

Making your first contribution is exciting! Here's some guidance to ensure a smooth experience.

### ✅ Where to Start

#### Minor UI Fixes / Improvements (`artifacts/frontend/`)

- Fix a small visual bug (e.g., a misaligned element, incorrect styling).
- Improve accessibility for an existing component.
- Add a simple new UI element (e.g., a "Back" button to a page) using existing `src/components/ui/` components.
- Refine text or labels for clarity.
- **Example:** Adjusting the layout of `artifacts/frontend/src/components/github-repo-picker.tsx` or updating a component in `artifacts/frontend/src/components/ui/`.

#### Documentation or Readme Enhancements

- Improve this onboarding guide! (Submit a PR suggesting additions or clarifications).
- Clarify a point in `.agents/memory/`.

#### Small API Endpoint Additions

- **Frontend-only:** Add a new client-side route (`artifacts/frontend/src/pages/`) with a basic component that doesn't require backend interaction.
- **Backend-only:** Add a new health check endpoint to `artifacts/api-server/src/routes/health.ts` that returns a simple static message. Remember to update `lib/api-spec/openapi.yaml` and regenerate!

#### Explore and Understand

Spend time reading the code, especially in `src/routes/` for the API server and `src/pages/` for the frontend. Understand how `lib/db/src/schema/repos.ts` defines a repository and how `artifacts/api-server/src/routes/repos.ts` interacts with it.

### 🚫 What to Avoid (For Your First Contribution)

- **Large-scale Refactorings** — Avoid significant architectural changes or large-scale code overhauls, especially in core `lib/` packages or critical `artifacts/api-server` logic. These require deep understanding and prior discussion.
- **Major Database Schema Changes** — Altering existing tables in `lib/db/src/schema/` can have far-reaching implications and might involve complex migration strategies.
- **Modifying Generated Code** — Never manually edit files within `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/`. These files are overwritten every time you run the generate script. If you need to change something that affects these files, modify `lib/api-spec/openapi.yaml` and then regenerate.

---

## Branch Naming

Use the following convention for branch names:

| Prefix | Example |
|---|---|
| `feature/` | `feature/add-github-sync` |
| `fix/` | `fix/oauth-bug` |
| `docs/` | `docs/update-readme` |
| `refactor/` | `refactor/api-client` |

---

## Pull Requests

Please ensure:

- Your PR titles are concise
- Your commit messages do not have emojis
- Your commit messages are concise
- Code compiles
- Typecheck passes
- Lint passes
- Documentation updated
- Screenshots included for UI changes

Always run the full `pnpm registry:build` before committing.

---

## Commit Convention

Before you create a Pull Request, please check whether your commits comply with the commit conventions used in this repository.

When you create a commit we kindly ask you to follow the convention `category(scope or module): message` in your commit message while using one of the following categories:

| Category | Description |
|---|---|
| `feat` / `feature` | All changes that introduce completely new code or new features |
| `fix` | Changes that fix a bug (ideally you will additionally reference an issue if present) |
| `refactor` | Any code related change that is not a fix nor a feature |
| `docs` | Changing existing or creating new documentation (i.e. README, docs for usage of a lib or CLI usage) |
| `build` | All changes regarding the build of the software, changes to dependencies or the addition of new dependencies |
| `test` | All changes regarding tests (adding new tests or changing existing ones) |
| `ci` | All changes regarding the configuration of continuous integration (i.e. GitHub Actions, CI system) |
| `chore` | All changes to the repository that do not fit into any of the above categories |

**Example:**

```
feat(components): add new prop to the avatar component
```

If you are interested in the detailed specification you can visit [conventionalcommits.org](https://www.conventionalcommits.org/).

---

## Requests for New Components

If you have a request for a new component, please open a discussion on GitHub. We'll be happy to help you out.
