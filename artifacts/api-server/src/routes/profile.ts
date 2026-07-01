import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/resolveUser";

const router = Router();

const UpdateProfileBody = z.object({
  displayName: z.string().max(64).optional(),
  username: z.string().max(32).regex(/^[a-zA-Z0-9_-]*$/).optional(),
  bio: z.string().max(200).optional(),
  avatarConfig: z.string().max(2000).optional(),
});

// GET /api/profile — get current user profile (auth users only)
router.get("/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/profile — update current user profile
router.put("/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
    if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
    if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio;
    if (parsed.data.avatarConfig !== undefined) updateData.avatarConfig = parsed.data.avatarConfig;

    const [updated] = await db
      .update(userProfilesTable)
      .set(updateData)
      .where(eq(userProfilesTable.userId, userId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/profile — delete the user's account
router.delete("/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    res.clearCookie("token");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
