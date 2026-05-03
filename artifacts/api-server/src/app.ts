import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { createPublicKey } from "crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

// ---------------------------------------------------------------------------
// Resolve the frontend's Clerk instance public key.
//
// VITE_CLERK_PUBLISHABLE_KEY and CLERK_PUBLISHABLE_KEY can be set to different
// Clerk apps in Replit. We always derive the signing-key material from the
// same instance that issued the session tokens (i.e. the frontend instance)
// so that Bearer-token verification succeeds.
//
// Clerk's backend SDK fetches JWKS from <fapi>/v1/jwks, but development
// instances expose it at <fapi>/.well-known/jwks.json instead.  We pre-fetch
// at startup, convert the first JWK to PEM, and supply it as `jwtKey` so no
// network round-trip is needed per-request and the wrong path is never hit.
// ---------------------------------------------------------------------------

const frontendPublishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;

async function loadClerkJwtKey(): Promise<string | undefined> {
  if (!frontendPublishableKey) return undefined;

  try {
    const base64Part = frontendPublishableKey.replace(/^pk_(test|live)_/, "");
    const fapiDomain = Buffer.from(base64Part, "base64")
      .toString()
      .replace(/\$$/, "");

    const url = `https://${fapiDomain}/.well-known/jwks.json`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ status: res.status, url }, "Clerk JWKS fetch failed");
      return undefined;
    }

    const jwks = (await res.json()) as { keys: object[] };
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      logger.warn("Clerk JWKS response contained no keys");
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pem = createPublicKey({ key: jwks.keys[0] as any, format: "jwk" }).export({
      type: "spki",
      format: "pem",
    }) as string;

    logger.info({ fapiDomain }, "Clerk JWT key loaded from JWKS");
    return pem;
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
  clerkMiddleware((req) => {
    const host = getClerkProxyHost(req);

    // In production the proxy middleware tells Clerk's backend that the Frontend
    // API is reachable at <origin>/api/__clerk.  Clerk then stamps that URL as
    // the JWT `iss` claim.  We must pass the same proxyUrl here so the
    // middleware accepts those tokens instead of rejecting them for an issuer
    // mismatch.  In development (NODE_ENV !== "production") the proxy is a
    // no-op, tokens are issued directly by the Clerk FAPI, and proxyUrl must
    // be omitted.
    const proxyUrl =
      process.env.NODE_ENV === "production" && host
        ? `${req.headers["x-forwarded-proto"] ?? "https"}://${host}${CLERK_PROXY_PATH}`
        : undefined;

    return {
      publishableKey: publishableKeyFromHost(host ?? "", frontendPublishableKey),
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: clerkJwtKey,
      proxyUrl,
    };
  }),
);

app.use("/api", router);

export default app;
