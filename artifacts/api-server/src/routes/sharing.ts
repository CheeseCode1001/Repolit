import { Router } from "express";
import { db } from "@workspace/db";
import { reposTable, analysesTable, sharedReposTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireClerkAuth } from "../middlewares/resolveUser";
import { randomBytes } from "crypto";

const router = Router();

const IdParam = z.object({ id: z.coerce.number() });

// POST /api/repos/:id/share — generate or return a share token
router.post("/repos/:id/share", async (req, res) => {
  const userId = requireClerkAuth(req, res);
  if (!userId) return;

  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [repo] = await db
      .select()
      .from(reposTable)
      .where(and(eq(reposTable.id, parsed.data.id), eq(reposTable.userId, userId)));

    if (!repo) {
      res.status(404).json({ error: "Repo not found" });
      return;
    }

    // Return existing share token if one exists
    const [existing] = await db
      .select()
      .from(sharedReposTable)
      .where(eq(sharedReposTable.repoId, repo.id))
      .limit(1);

    if (existing) {
      res.json({ shareToken: existing.shareToken });
      return;
    }

    // Create new share token
    const shareToken = randomBytes(16).toString("hex");
    await db.insert(sharedReposTable).values({ repoId: repo.id, shareToken });

    res.json({ shareToken });
  } catch (err) {
    req.log.error({ err }, "Failed to create share token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/shared/:token — public view of a shared repo analysis (no auth required)
router.get("/shared/:token", async (req, res) => {
  const { token } = req.params;
  if (!token || token.length > 64) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  try {
    const [shared] = await db
      .select()
      .from(sharedReposTable)
      .where(eq(sharedReposTable.shareToken, token))
      .limit(1);

    if (!shared) {
      res.status(404).json({ error: "Shared analysis not found" });
      return;
    }

    const [repo] = await db
      .select()
      .from(reposTable)
      .where(eq(reposTable.id, shared.repoId));

    if (!repo) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }

    const [analysis] = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.repoId, repo.id))
      .orderBy(desc(analysesTable.createdAt))
      .limit(1);

    res.json({ repo, analysis: analysis ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get shared analysis");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
