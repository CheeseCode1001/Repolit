import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { createPublicKey } from "crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";

// ---------------------------------------------------------------------------
// Resolve the frontend's Clerk instance public key.
//
// VITE_CLERK_PUBLISHABLE_KEY is the key used by the browser — tokens are
// always signed by that instance's private key, so we must verify against it.
// ---------------------------------------------------------------------------

const frontendPublishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;

// ---------------------------------------------------------------------------
// proxyUrl — must match exactly what the browser's ClerkProvider uses.
//
// In production Replit sets VITE_CLERK_PROXY_URL to the deployed domain's
// /api/__clerk path.  When the proxy is active, Clerk stamps that URL as the
// JWT `iss` claim.  Passing the same value here lets the middleware accept
// those tokens.  In dev (VITE_CLERK_PROXY_URL unset) proxyUrl stays undefined
// and the middleware checks iss against the direct FAPI URL instead.
// ---------------------------------------------------------------------------

const proxyUrl = process.env.VITE_CLERK_PROXY_URL || undefined;

// ---------------------------------------------------------------------------
// Pre-fetch the JWKS at startup and convert the first key to PEM.
//
// Development Clerk instances expose JWKS at /.well-known/jwks.json (not at
// /v1/jwks).  We fetch it once at startup and pass it as `jwtKey` so no
// per-request network call is made and the wrong path is never hit.
// ---------------------------------------------------------------------------

async function loadClerkJwtKey(): Promise<string | undefined> {
  if (!frontendPublishableKey) return undefined;

  try {
    const base64Part = frontendPublishableKey.replace(/^pk_(test|live)_/, "");
    const fapiDomain = Buffer.from(base64Part, "base64")
      .toString()
      .replace(/\$$/, "");

    // Try standard path first, then well-known path
    for (const path of ["/v1/jwks", "/.well-known/jwks.json"]) {
      const url = `https://${fapiDomain}${path}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const jwks = (await res.json()) as { keys: object[] };
        if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pem = createPublicKey({ key: jwks.keys[0] as any, format: "jwk" }).export({
          type: "spki",
          format: "pem",
        }) as string;

        logger.info({ fapiDomain, path }, "Clerk JWT key loaded from JWKS");
        return pem;
      } catch {
        // try next path
      }
    }
    logger.warn({ fapiDomain }, "Clerk JWKS not found at any known path");
    return undefined;
  } catch (err) {
    logger.error({ err }, "Failed to load Clerk JWKS");
    return undefined;
  }
}

const clerkJwtKey = await loadClerkJwtKey();

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware({
    publishableKey: frontendPublishableKey,
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtKey: clerkJwtKey,
    proxyUrl,
  }),
);

app.use("/api", router);

export default app;
