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
// Determine proxyUrl once at startup (production only)
//
// Priority:
//   1. CLERK_PROXY_URL   — set explicitly by admin
//   2. VITE_CLERK_PROXY_URL — Replit injects this for the frontend build;
//                             it may also be in the API server process env
//   3. REPLIT_DOMAINS    — Replit sets this to the production domain(s)
//   4. fallback to per-request computation from x-forwarded-host header
// ---------------------------------------------------------------------------

function resolveStaticProxyUrl(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  // REPLIT_DOMAINS is the authoritative production domain — always use it to
  // build an absolute proxy URL, even when CLERK_PROXY_URL / VITE_CLERK_PROXY_URL
  // are set but contain only a relative path like "/api/__clerk".
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();

  const makeAbsolute = (val: string): string => {
    if (val.startsWith("https://") || val.startsWith("http://")) return val;
    // Relative path — promote to absolute using the production domain.
    if (domain) return `https://${domain}${val.startsWith("/") ? val : `/${val}`}`;
    return val; // Can't promote without domain; will likely fail — warn below.
  };

  const candidates: Array<{ src: string; raw: string }> = [];

  if (process.env.CLERK_PROXY_URL) {
    candidates.push({ src: "CLERK_PROXY_URL", raw: process.env.CLERK_PROXY_URL });
  }
  if (process.env.VITE_CLERK_PROXY_URL) {
    candidates.push({ src: "VITE_CLERK_PROXY_URL", raw: process.env.VITE_CLERK_PROXY_URL });
  }
  if (domain) {
    candidates.push({ src: "REPLIT_DOMAINS", raw: `https://${domain}${CLERK_PROXY_PATH}` });
  }

  if (candidates.length > 0) {
    const { src, raw } = candidates[0];
    const val = makeAbsolute(raw);
    logger.info({ src, raw, proxyUrl: val }, "Clerk static proxyUrl resolved");
    return val;
  }

  logger.warn("No static proxyUrl source found — will fall back to per-request header computation");
  return undefined;
}

const staticProxyUrl = resolveStaticProxyUrl();

// ---------------------------------------------------------------------------
// Frontend Clerk publishable key (needed to fetch the right JWKS)
// ---------------------------------------------------------------------------

const frontendPublishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;

// ---------------------------------------------------------------------------
// Pre-fetch JWKS at startup and convert to PEM for fast local verification
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

// Log full startup env diagnostics (non-secret portions only)
logger.info(
  {
    nodeEnv: process.env.NODE_ENV,
    staticProxyUrl,
    hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
    hasClerkPublishableKey: !!process.env.CLERK_PUBLISHABLE_KEY,
    hasViteClerkProxyUrl: !!process.env.VITE_CLERK_PROXY_URL,
    viteClerkProxyUrl: process.env.VITE_CLERK_PROXY_URL,
    hasClerkProxyUrl: !!process.env.CLERK_PROXY_URL,
    clerkProxyUrl: process.env.CLERK_PROXY_URL,
    replitDomains: process.env.REPLIT_DOMAINS,
    hasJwtKey: !!clerkJwtKey,
  },
  "Clerk startup diagnostics",
);

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
// Clerk middleware (optional in local dev when CLERK_SECRET_KEY is unset)
// ---------------------------------------------------------------------------

if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => {
      let proxyUrl: string | undefined;

      if (process.env.NODE_ENV === "production") {
        if (staticProxyUrl) {
          proxyUrl = staticProxyUrl;
        } else {
          // Fall back: compute per-request from forwarded headers
          const host = getClerkProxyHost(
            req as { headers: Record<string, string | string[] | undefined> },
          );
          if (host) {
            const proto =
              (req.headers["x-forwarded-proto"] as string | undefined)
                ?.split(",")[0]
                ?.trim() ?? "https";
            proxyUrl = `${proto}://${host}${CLERK_PROXY_PATH}`;

            req.log?.warn(
              { proxyUrl, host, xForwardedProto: req.headers["x-forwarded-proto"] },
              "Clerk proxyUrl computed from headers (no static source)",
            );
          }
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
} else {
  logger.warn("CLERK_SECRET_KEY not set — Clerk auth middleware disabled");
}

app.use("/api", router);

export default app;
