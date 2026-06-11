import { Router } from "express";
import { requireClerkAuth } from "../middlewares/resolveUser";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import * as crypto from "crypto";

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "";
const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.REPLIT_DOMAINS?.split(",")[0]
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost:80";

const CALLBACK_URL = `${BASE_URL}/api/github/oauth/callback`;

const oauthStates = new Map<string, { userId: string; expiresAt: number }>();

function pruneStates() {
  const now = Date.now();
  for (const [k, v] of oauthStates) {
    if (v.expiresAt < now) oauthStates.delete(k);
  }
}

router.get("/github/oauth/start", (req, res) => {
  const userId = requireClerkAuth(req, res);
  if (!userId) return;
  if (!GITHUB_CLIENT_ID) {
    res.status(503).json({ error: "GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID." });
    return;
  }
  pruneStates();
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: "read:user repo",
    state,
  });
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ url });
});

router.get("/github/oauth/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state) {
    res.status(400).send("Missing code or state");
    return;
  }

  pruneStates();
  const entry = oauthStates.get(state);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).send("Invalid or expired state");
    return;
  }
  oauthStates.delete(state);
  const { userId } = entry;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      logger.error({ err: tokenData.error }, "GitHub OAuth token exchange failed");
      res.redirect(`${BASE_URL}/profile?github_error=token_exchange`);
      return;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const ghUser = await userRes.json() as { login?: string };

    await db
      .update(userProfilesTable)
      .set({
        githubAccessToken: tokenData.access_token,
        githubUsername: ghUser.login ?? null,
        updatedAt: new Date(),
      })
      .where(eq(userProfilesTable.userId, userId));

    res.redirect(`${BASE_URL}/profile?github=connected`);
  } catch (err) {
    logger.error({ err }, "GitHub OAuth callback error");
    res.redirect(`${BASE_URL}/profile?github_error=server`);
  }
});

router.get("/github/repos", async (req, res) => {
  const userId = requireClerkAuth(req, res);
  if (!userId) return;
  const q = (req.query.q as string | undefined) ?? "";
  const page = parseInt((req.query.page as string | undefined) ?? "1", 10);
  const perPage = parseInt((req.query.per_page as string | undefined) ?? "30", 10);

  const [profile] = await db
    .select({ githubAccessToken: userProfilesTable.githubAccessToken })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);

  if (!profile?.githubAccessToken) {
    res.status(403).json({ error: "GitHub not connected" });
    return;
  }

  try {
    const params = new URLSearchParams({
      sort: "updated",
      per_page: String(perPage),
      page: String(page),
      type: "all",
    });
    if (q) params.set("q", q);

    const endpoint = q
      ? `https://api.github.com/search/repositories?q=${encodeURIComponent(q + " user:@me")}&sort=updated&per_page=${perPage}&page=${page}`
      : `https://api.github.com/user/repos?${params.toString()}`;

    const ghRes = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${profile.githubAccessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!ghRes.ok) {
      if (ghRes.status === 401) {
        await db
          .update(userProfilesTable)
          .set({ githubAccessToken: null, githubUsername: null, updatedAt: new Date() })
          .where(eq(userProfilesTable.userId, userId));
        res.status(401).json({ error: "GitHub token expired. Please reconnect." });
        return;
      }
      res.status(ghRes.status).json({ error: "GitHub API error" });
      return;
    }

    const data = await ghRes.json() as any;
    const items: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      html_url: string;
      private: boolean;
      language: string | null;
      stargazers_count: number;
      updated_at: string;
    }> = q ? (data.items ?? []) : (Array.isArray(data) ? data : []);

    const repos = items.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description ?? null,
      htmlUrl: r.html_url,
      private: r.private,
      language: r.language ?? null,
      stargazersCount: r.stargazers_count,
      updatedAt: r.updated_at,
    }));

    res.json(repos);
  } catch (err) {
    logger.error({ err }, "Error fetching GitHub repos");
    res.status(500).json({ error: "Failed to fetch GitHub repositories" });
  }
});

router.delete("/github/disconnect", async (req, res) => {
  const userId = requireClerkAuth(req, res);
  if (!userId) return;
  await db
    .update(userProfilesTable)
    .set({ githubAccessToken: null, githubUsername: null, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, userId));
  res.json({ ok: true });
});

export default router;
