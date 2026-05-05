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
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

// ---------------------------------------------------------------------------
// Frontend Clerk publishable key
// Tokens are always signed by the instance that the browser uses, so we must
// verify against that instance's JWKS — not the backend Clerk integration key.
// ---------------------------------------------------------------------------

const frontendPublishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;

// ---------------------------------------------------------------------------
// Pre-fetch JWKS at startup and convert the first key to PEM.
//
// Development Clerk instances expose JWKS at /.well-known/jwks.json (not at
// /v1/jwks).  We try both paths and cache the result as `jwtKey` so every
// request is verified locally with zero network latency.
// ---------------------------------------------------------------------------

async function loadClerkJwtKey(): Promise<string | undefined> {
  if (!frontendPublishableKey) return undefined;

  try {
    const base64Part = frontendPublishableKey.replace(/^pk_(test|live)_/, "");
    const fapiDomain = Buffer.from(base64Part, "base64")
      .toString()
      .replace(/\$$/, "");

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
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Clerk proxy must be mounted before json/urlencoded body parsers
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Clerk middleware — per-request proxyUrl
//
// In production, clerkProxyMiddleware stamps the JWT with
//   iss = `${protocol}://${host}/api/__clerk`
// so clerkMiddleware MUST receive the identical proxyUrl, otherwise the
// issuer check fails and every request gets 401.
//
// We use the request-callback form so the URL is computed fresh from each
// request's forwarding headers — the same logic getClerkProxyHost uses in
// clerkProxyMiddleware, ensuring they always agree.
//
// In development (NODE_ENV !== "production") proxyUrl is omitted so the
// issuer is checked against the direct FAPI URL instead.
// ---------------------------------------------------------------------------

app.use(
  clerkMiddleware((req) => {
    let proxyUrl: string | undefined;

    if (process.env.NODE_ENV === "production") {
      const host = getClerkProxyHost(req as { headers: Record<string, string | string[] | undefined> });
      if (host) {
        const proto =
          (req.headers["x-forwarded-proto"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ?? "https";
        proxyUrl = `${proto}://${host}${CLERK_PROXY_PATH}`;
      }
    }

    return {
      publishableKey: frontendPublishableKey,
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: clerkJwtKey,
      proxyUrl,
    };
  }),
);

app.use("/api", router);

export default app;
