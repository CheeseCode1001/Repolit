import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/jwt";

export const ANON_ID_HEADER = "x-anon-id";
export const ANON_PREFIX = "anon_";

// Limits for different user tiers
export const ANON_REPO_LIMIT = 1;
export const FREE_REPO_LIMIT = 2;
export const POINTS_PER_SCAN = 10;
export const POINTS_COST_EXTRA_SCAN = 10;

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAnon?: boolean;
    }
  }
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
 * Express middleware that extracts the JWT token from cookies or Authorization header
 * and sets req.userId and req.isAnon.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7);
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.isAnon = false;
      return next();
    }
  }

  // Fallback to anonymous session
  const anonId = req.headers[ANON_ID_HEADER];
  if (typeof anonId === "string" && anonId.length > 0 && anonId.length <= 64) {
    req.userId = `${ANON_PREFIX}${anonId}`;
    req.isAnon = true;
  }

  next();
}

export function resolveUserId(req: Request): string | null {
  return req.userId || null;
}

/**
 * Middleware that requires a resolved user (Authenticated OR anonymous).
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
 * Middleware that requires an authenticated user (no anon allowed).
 */
export function requireAuth(req: Request, res: Response): string | null {
  const userId = resolveUserId(req);
  if (!userId || req.isAnon) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

// Deprecated name, keeping for backward compatibility in case I missed renaming some imports
export const requireClerkAuth = requireAuth;
