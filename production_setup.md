# Production Deployment Guide for Repograph

This document outlines everything you need to do to take Repograph from your local development environment to a live, scalable production environment.

## Can you use Vercel for hosting?

**Yes, but with some caveats!**

Because Repograph consists of two distinct parts (a Vite React frontend and a Node.js Express backend), the recommended approach is:

1. **Frontend**: Host on **Vercel** (Highly Recommended)
2. **Backend**: Host on a container platform like **Render, Railway, or Fly.io** (Recommended)
3. **Database**: Use a managed PostgreSQL service like **Neon, Supabase, or Vercel Postgres**

**Why not put the Backend on Vercel?**
While Vercel *can* host Express APIs via Serverless Functions, repository analysis using the Gemini API can be a **long-running task**. Vercel's Serverless Functions have strict execution timeouts (10 seconds on the Hobby tier, up to 60 seconds on the Pro tier). If an AI analysis takes longer than that, Vercel will kill the request and return a 504 Gateway Timeout error. A dedicated Node.js server (like Render or Railway) avoids this issue entirely.

---

## 1. Database Provisioning

Currently, the app uses `PGlite` locally (`pglite://.local/repograph-pg`), which is an embedded database that stores data in files. In production, you need a standalone database.

1. Create a free PostgreSQL database on a service like [Neon](https://neon.tech/) or [Supabase](https://supabase.com/).
2. Get your connection string (e.g., `postgresql://user:password@host/dbname`).
3. You will set this as your `DATABASE_URL` environment variable on your backend hosting provider.

## 2. Authentication (Clerk)

You need to switch your Clerk environment from "Development" to "Production".

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com).
2. Follow the prompt to "Deploy to Production".
3. Configure your production domain (e.g., `repograph.yourdomain.com`).
4. Get your live `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

## 3. GitHub OAuth Application

Your local GitHub OAuth app points to `localhost`. You need a new one for production.

1. Go to **Settings > Developer Settings > OAuth Apps** in GitHub.
2. Create a new OAuth app for production.
3. Set the **Homepage URL** to your frontend's live URL (e.g., `https://repograph.yourdomain.com`).
4. Set the **Authorization callback URL** to point to your live backend (e.g., `https://api.repograph.yourdomain.com/api/github/oauth/callback`).
5. Copy the new `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.

## 4. Deploying the Backend (Render / Railway)

Your API server handles the heavy lifting, file uploads, and Gemini AI streaming.

1. Create a new Web Service on [Render](https://render.com/) or [Railway](https://railway.app/) connected to your GitHub repo.
2. **Build Command**: `pnpm install && pnpm run build`
3. **Start Command**: `pnpm --filter @workspace/api-server start` (or `node artifacts/api-server/dist/index.mjs`)
4. **Environment Variables**:
   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://your_live_db_url
   CLERK_SECRET_KEY=sk_live_...
   CLERK_PUBLISHABLE_KEY=pk_live_...
   GITHUB_OAUTH_CLIENT_ID=your_production_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_production_client_secret
   AI_INTEGRATIONS_GEMINI_API_KEY=your_gemini_api_key
   # Do NOT set AI_INTEGRATIONS_GEMINI_BASE_URL
   APP_BASE_URL=https://repograph.yourdomain.com # Your Vercel frontend URL
   ```
5. Deploy the backend and copy the live URL (e.g., `https://repograph-api.onrender.com`).

## 5. Deploying the Frontend (Vercel)

Vercel is perfect for the Vite frontend.

1. Go to [Vercel](https://vercel.com/) and import your GitHub repository.
2. Set the **Framework Preset** to `Vite`.
3. Set the **Root Directory** to `artifacts/developer-painkiller` (or keep it at root and change the build command).
4. **Build Command**: `pnpm run build` (if run from root, it will build the workspace).
5. **Environment Variables** (Notice the `VITE_` prefix for the frontend):
   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
   ```
6. **API Proxying**: In local development, Vite proxies `/api` to the backend. In production, you need to tell the frontend where the backend lives. You'll need to create a `vercel.json` file in your frontend directory to rewrite `/api` traffic to your live backend URL.

### Create `artifacts/developer-painkiller/vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://repograph-api.onrender.com/api/:path*"
    }
  ]
}
```
*(Replace the destination with your actual live backend URL).*

7. Click **Deploy**.

## Summary Checklist

- [ ] Provision a live PostgreSQL Database (Neon/Supabase)
- [ ] Push code to GitHub
- [ ] Create a Production Clerk Instance
- [ ] Create a Production GitHub OAuth App
- [ ] Deploy Backend to Render/Railway and set Environment Variables
- [ ] Create `vercel.json` in the frontend to route `/api` to your new live backend
- [ ] Deploy Frontend to Vercel and set Environment Variables
- [ ] Test the full End-to-End flow online!
