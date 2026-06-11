import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const ANON_ID_HEADER = "x-anon-id";
export const ANON_PREFIX = "anon_";

// Limits for different user tiers
export const ANON_REPO_LIMIT = 1;
export const FREE_REPO_LIMIT = 2;
export const POINTS_PER_SCAN = 10;
export const POINTS_COST_EXTRA_SCAN = 10;

/**
 * Resolves the effective user ID from either Clerk auth or anonymous session header.
 * Anonymous users get an "anon_<uuid>" user ID derived from the X-Anon-Id header.
 */
export function resolveUserId(req: Request): string | null {
  const { userId } = getAuth(req);
  if (userId) return userId;

  const anonId = req.headers[ANON_ID_HEADER];
  if (typeof anonId === "string" && anonId.length > 0 && anonId.length <= 64) {
    return `${ANON_PREFIX}${anonId}`;
  }

  return null;
}

export function isAnonUserId(userId: string): boolean {
  return userId.startsWith(ANON_PREFIX);
}

/**
 * Ensures a user profile row exists for the given userId.
 * Creates one if it doesn't exist yet.
 */
export async function ensureUserProfile(userId: string): Promise<void> {
  const existing = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userProfilesTable).values({
      userId,
      isAnon: isAnonUserId(userId),
      points: 0,
      extraScansUnlocked: 0,
    }).onConflictDoNothing();
  }
}

/**
 * Middleware that requires a resolved user (Clerk OR anonymous).
 * Sets res.locals.userId for downstream handlers.
 */
export function requireAnyUser(req: Request, res: Response): string | null {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication or anonymous session required" });
    return null;
  }
  return userId;
}

/**
 * Middleware that requires a Clerk-authenticated user (no anon allowed).
 */
export function requireClerkAuth(req: Request, res: Response): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}
