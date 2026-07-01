import { Router } from "express";
import { verifyToken } from "../lib/jwt";

const router = Router();

// GET /api/debug — exposes runtime auth diagnostics
// This endpoint does NOT require auth — it shows what auth state the server sees.
router.get("/debug", (req, res) => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7);
  }

  let jwtPayload: any = null;
  if (token) {
    try {
      jwtPayload = verifyToken(token);
    } catch {
      jwtPayload = { error: "failed to decode" };
    }
  }

  res.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    auth: {
      userId: req.userId || null,
      isAnon: req.isAnon || false,
      hasToken: !!token,
      jwtPayload,
    },
    requestHeaders: {
      host: req.headers.host ?? null,
      "x-forwarded-host": req.headers["x-forwarded-host"] ?? null,
      "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? null,
      "x-forwarded-for": req.headers["x-forwarded-for"] ?? null,
      origin: req.headers.origin ?? null,
      referer: req.headers.referer ?? null,
      "x-anon-id": req.headers["x-anon-id"] ?? null,
    }
  });
});

export default router;
