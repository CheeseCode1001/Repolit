import { Router } from "express";
import { getAuth } from "@clerk/express";
import { CLERK_PROXY_PATH, getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router = Router();

// GET /api/debug — exposes runtime auth diagnostics
// This endpoint does NOT require auth — it shows what auth state the server sees.
router.get("/debug", (req, res) => {
  const authHeader = req.headers.authorization;
  let jwtPayload: Record<string, unknown> | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = Buffer.from(padded, "base64").toString("utf8");
        jwtPayload = JSON.parse(json) as Record<string, unknown>;
      } catch {
        jwtPayload = { error: "failed to decode" };
      }
    }
  }

  const host = getClerkProxyHost(req as { headers: Record<string, string | string[] | undefined> });
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ?? "https";

  const computedProxyUrl =
    process.env.NODE_ENV === "production" && host
      ? `${proto}://${host}${CLERK_PROXY_PATH}`
      : null;

  // Safe: getAuth won't throw here since clerkMiddleware ran
  let userId: string | null = null;
  try {
    userId = getAuth(req).userId;
  } catch {
    userId = null;
  }

  res.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    auth: {
      userId,
      hasAuthHeader: !!authHeader,
      bearerTokenPresent: authHeader?.startsWith("Bearer ") ?? false,
      jwtIss: jwtPayload?.iss ?? null,
      jwtSub: jwtPayload?.sub ?? null,
      jwtExp: jwtPayload?.exp ?? null,
      jwtAzp: jwtPayload?.azp ?? null,
    },
    proxyUrl: {
      static_CLERK_PROXY_URL: process.env.CLERK_PROXY_URL ?? null,
      static_VITE_CLERK_PROXY_URL: process.env.VITE_CLERK_PROXY_URL ?? null,
      computedFromHeaders: computedProxyUrl,
    },
    requestHeaders: {
      host: req.headers.host ?? null,
      "x-forwarded-host": req.headers["x-forwarded-host"] ?? null,
      "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? null,
      "x-forwarded-for": req.headers["x-forwarded-for"] ?? null,
      origin: req.headers.origin ?? null,
      referer: req.headers.referer ?? null,
    },
    clerEnv: {
      hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
      hasClerkPublishableKey: !!process.env.CLERK_PUBLISHABLE_KEY,
      clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY?.slice(0, 20) + "...",
      hasViteClerkPublishableKey: !!process.env.VITE_CLERK_PUBLISHABLE_KEY,
      viteClerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY?.slice(0, 20) + "...",
    },
  });
});

export default router;
