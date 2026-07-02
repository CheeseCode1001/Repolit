import { Router } from "express";
import { db } from "@workspace/db";
import { reposTable, analysesTable, userProfilesTable } from "@workspace/db";
import { eq, desc, count, sql, and } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { z } from "zod";
import multer from "multer";
import {
  resolveUserId,
  requireClerkAuth,
  isAnonUserId,
  ensureUserProfile,
  ANON_REPO_LIMIT,
  FREE_REPO_LIMIT,
  POINTS_PER_SCAN,
  POINTS_COST_EXTRA_SCAN,
} from "../middlewares/resolveUser";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const CreateRepoBody = z.object({ url: z.string().url() });
const IdParam = z.object({ id: z.coerce.number() });
const ChatBody = z.object({ question: z.string().min(1).max(2000) });

// Require any user (Clerk or anon). Returns userId or null.
function requireAuth(req: any, res: any): string | null {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], name: parts[1] };
  } catch {
    return null;
  }
}

async function fetchGitHubRepoMeta(owner: string, name: string, userToken?: string | null) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: githubHeaders(userToken),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      description?: string;
      language?: string;
      stargazers_count?: number;
    };
    return {
      description: data.description ?? null,
      language: data.language ?? null,
      stars: data.stargazers_count ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchRepoTree(owner: string, name: string, userToken?: string | null): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/git/trees/HEAD?recursive=1`,
      { headers: githubHeaders(userToken) }
    );
    if (!res.ok) return "";
    const data = await res.json() as { tree?: { path?: string; type?: string }[] };
    const files = (data.tree ?? [])
      .filter((f) => f.type === "blob" && f.path)
      .map((f) => f.path!)
      .slice(0, 300);
    return files.join("\n");
  } catch {
    return "";
  }
}

async function fetchFileContent(owner: string, name: string, path: string, userToken?: string | null): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/${path}`,
      { headers: githubHeaders(userToken) }
    );
    if (!res.ok) return "";
    const data = await res.json() as { content?: string; encoding?: string };
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, 8000);
    }
    return "";
  } catch {
    return "";
  }
}

function githubHeaders(userToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = userToken || process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchCommitHistory(owner: string, name: string, userToken?: string | null): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/commits?per_page=30`,
      { headers: githubHeaders(userToken) }
    );
    if (!res.ok) {
      return "[]";
    }
    const data = await res.json() as Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      author?: { login: string; avatar_url: string } | null;
      html_url: string;
    }>;
    if (!Array.isArray(data)) return "[]";
    const commits = data.map((c) => ({
      sha: c.sha?.slice(0, 7) ?? "",
      message: c.commit?.message?.split("\n")[0] ?? "",
      author: c.commit?.author?.name ?? "",
      login: c.author?.login ?? null,
      avatar: c.author?.avatar_url ?? null,
      date: c.commit?.author?.date ?? "",
      url: c.html_url ?? "",
    }));
    return JSON.stringify(commits);
  } catch {
    return "[]";
  }
}

/**
 * Check if a user can create a new repo scan.
 * Returns null if allowed, or an error message if blocked.
 */
async function checkScanLimit(userId: string): Promise<string | null> {
  const isAnon = isAnonUserId(userId);
  const limit = isAnon ? ANON_REPO_LIMIT : FREE_REPO_LIMIT;

  const [result] = await db
    .select({ cnt: count() })
    .from(reposTable)
    .where(eq(reposTable.userId, userId));

  const currentCount = Number(result.cnt);

  if (currentCount < limit) return null; // under limit, allowed

  if (isAnon) {
    return `Anonymous users can only analyze ${ANON_REPO_LIMIT} repository. Sign in to analyze more.`;
  }

  // Check if user has points for extra scans
  const [profile] = await db
    .select({ points: userProfilesTable.points, extraScansUnlocked: userProfilesTable.extraScansUnlocked })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);

  const totalAllowed = FREE_REPO_LIMIT + (profile?.extraScansUnlocked ?? 0);
  if (currentCount < totalAllowed) return null;

  const pts = profile?.points ?? 0;
  if (pts >= POINTS_COST_EXTRA_SCAN) {
    // Deduct points and unlock one extra scan
    await db
      .update(userProfilesTable)
      .set({
        points: pts - POINTS_COST_EXTRA_SCAN,
        extraScansUnlocked: (profile?.extraScansUnlocked ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(userProfilesTable.userId, userId));
    return null; // unlocked with points
  }

  return `Free tier allows ${FREE_REPO_LIMIT} repositories. Earn ${POINTS_COST_EXTRA_SCAN} points to unlock more (you have ${pts} pts).`;
}

// GET /api/repos — returns only the current user's repos
router.get("/repos", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const repos = await db.select().from(reposTable)
      .where(eq(reposTable.userId, userId))
      .orderBy(desc(reposTable.createdAt))
      .limit(20);
    res.json(repos);
  } catch (err) {
    req.log.error({ err }, "Failed to list repos");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/repos
router.post("/repos", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreateRepoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { url } = parsed.data;
  const parsed_url = parseGitHubUrl(url);
  if (!parsed_url) {
    res.status(400).json({ error: "Only GitHub repository URLs are supported" });
    return;
  }

  const { owner, name } = parsed_url;

  try {
    // Check if this user already has this repo
    const existing = await db.select().from(reposTable)
      .where(and(eq(reposTable.url, url), eq(reposTable.userId, userId)))
      .limit(1);
    if (existing.length > 0) {
      res.status(200).json(existing[0]);
      return;
    }

    // Check scan limits
    const limitError = await checkScanLimit(userId);
    if (limitError) {
      res.status(403).json({ error: limitError });
      return;
    }

    let userToken: string | null = null;
    if (!isAnonUserId(userId)) {
      const [profile] = await db
        .select({ githubAccessToken: userProfilesTable.githubAccessToken })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId))
        .limit(1);
      userToken = profile?.githubAccessToken ?? null;
    }

    const meta = await fetchGitHubRepoMeta(owner, name, userToken);
    const [repo] = await db.insert(reposTable).values({
      userId,
      url,
      name,
      owner,
      description: meta?.description ?? null,
      language: meta?.language ?? null,
      stars: meta?.stars ?? null,
      status: "pending",
    }).returning();

    // Ensure profile exists for points tracking
    if (!isAnonUserId(userId)) {
      await ensureUserProfile(userId);
    }

    res.status(201).json(repo);
  } catch (err) {
    req.log.error({ err }, "Failed to create repo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/repos/:id
router.get("/repos/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [repo] = await db.select().from(reposTable)
      .where(and(eq(reposTable.id, parsed.data.id), eq(reposTable.userId, userId)));
    if (!repo) {
      res.status(404).json({ error: "Repo not found" });
      return;
    }
    res.json(repo);
  } catch (err) {
    req.log.error({ err }, "Failed to get repo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/repos/:id
router.delete("/repos/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(reposTable)
      .where(and(eq(reposTable.id, parsed.data.id), eq(reposTable.userId, userId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete repo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/repos/:id/analyze — SSE streaming analysis
router.post("/repos/:id/analyze", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  let repo: typeof reposTable.$inferSelect;
  try {
    const [found] = await db.select().from(reposTable)
      .where(and(eq(reposTable.id, parsed.data.id), eq(reposTable.userId, userId)));
    if (!found) {
      res.status(404).json({ error: "Repo not found" });
      return;
    }
    repo = found;
  } catch (err) {
    req.log.error({ err }, "Failed to look up repo before analysis");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let aborted = false;
  req.on("close", () => { aborted = true; });

  const send = (data: object) => {
    if (!aborted) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let userToken: string | null = null;
    if (!isAnonUserId(userId)) {
      const [profile] = await db
        .select({ githubAccessToken: userProfilesTable.githubAccessToken })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId))
        .limit(1);
      userToken = profile?.githubAccessToken ?? null;
    }

    await db.update(reposTable).set({ status: "analyzing" }).where(eq(reposTable.id, repo.id));
    send({ step: "Fetching repository tree..." });

    const tree = await fetchRepoTree(repo.owner, repo.name, userToken);

    send({ step: "Reading key files..." });
    const keyFiles = tree.split("\n").filter(f =>
      /README|package\.json|requirements|setup\.py|Cargo\.toml|go\.mod|Makefile|docker|\.env\.example|tsconfig|main\.(ts|js|py|go|rs)|app\.(ts|js|tsx)|index\.(ts|js)/i.test(f)
    ).slice(0, 8);

    const fileContents: string[] = [];
    for (const file of keyFiles) {
      const content = await fetchFileContent(repo.owner, repo.name, file, userToken);
      if (content) fileContents.push(`=== ${file} ===\n${content}`);
    }

    const context = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "N/A"}
Language: ${repo.language ?? "Unknown"}
Stars: ${repo.stars ?? 0}

File tree (up to 300 files):
${tree}

Key file contents:
${fileContents.join("\n\n")}`;

    send({ step: "Analyzing architecture..." });

    const summaryPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a senior software architect explaining a codebase to a mid-level developer.

Analyze this GitHub repository and provide a clear, opinionated explanation covering:
1. What this project does and why it exists
2. The tech stack and WHY those technologies were chosen (tradeoffs and alternatives considered)
3. Key components and their responsibilities
4. How data flows through the system end-to-end
5. Notable design patterns or architectural decisions — and why they were made that way
6. Any suggestions or improvements you'd recommend as a senior engineer

Be specific to this codebase. Avoid generic boilerplate. Write like you're onboarding a teammate, not documenting for a README.

${context}` }] }],
      config: { maxOutputTokens: 8192 },
    });

    send({ step: "Generating architecture diagram..." });

    const architecturePromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a software architect. Generate a Mermaid.js diagram showing the architecture or data flow of this repository.

STRICT RULES for the Mermaid syntax:
- Output ONLY valid Mermaid syntax. Start with graph TD or flowchart TD or sequenceDiagram.
- No markdown fences, no explanation text — just the raw Mermaid code.
- Node labels must NOT contain parentheses (), angle brackets <>, or HTML tags like <br>.
- Keep node labels short (max 4 words). Use underscores instead of spaces if needed.
- Use simple alphanumeric node IDs (e.g., A, B, AuthModule, DBLayer).
- Do NOT include file paths in node labels.

Example of CORRECT syntax:
graph TD
    Client --> API_Server
    API_Server --> Auth_Middleware
    Auth_Middleware --> DB

${context}` }] }],
      config: { maxOutputTokens: 4096 },
    });

    send({ step: "Writing onboarding guide..." });

    const onboardingPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a senior developer advocate writing an onboarding guide for a new contributor to this repository.

Write a comprehensive but practical guide covering:
1. Prerequisites and what you need to know before starting
2. Setup steps with exact commands
3. Folder structure explained — what goes where and why
4. How to run, test, and verify your changes
5. How the main pieces connect (give a mental model)
6. Common gotchas or things that trip up new contributors
7. Your first contribution: where to start and what to avoid

Use markdown with clear headers, code blocks, and bullet points. Be specific to this codebase — reference real file paths and real commands where possible.

${context}` }] }],
      config: { maxOutputTokens: 8192 },
    });

    send({ step: "Running security scan..." });

    const securityPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a security engineer performing a code review. Analyze this repository for potential security issues.

Look for:
- Hardcoded secrets, tokens, or credentials
- Insecure authentication or authorization patterns
- Missing input validation or sanitization
- Dependency concerns (outdated, vulnerable, or suspicious packages)
- Common vulnerabilities (SSRF, injection, XSS, CSRF, open redirects)
- Insecure data handling or storage
- Missing rate limiting or abuse protection

Return a JSON array of findings. Each finding must have:
{
  "severity": "critical" | "high" | "medium" | "low" | "info",
  "title": string (short, specific),
  "description": string (what the issue is and where),
  "recommendation": string (specific actionable fix)
}

Return ONLY the JSON array, no markdown fences or extra text.

${context}` }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    send({ step: "Building Start Here guide..." });

    const startHerePromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a senior engineer mentoring a new developer who just joined the team.

A new developer needs to understand this codebase quickly. Identify the 5-7 most important files or locations they should read FIRST — the ones that will give the greatest understanding with the least time investment.

Return a JSON array where each item has:
{
  "file": string (relative file path, e.g. "src/server.ts"),
  "title": string (short descriptive name, e.g. "Main Application Entry"),
  "why": string (2-3 sentences: why THIS file matters, what reading it teaches you, what mental model it unlocks),
  "insight": string (1 key thing to notice or understand when reading this file — a senior engineer's observation)
}

Order by priority (most important first). Be specific to this actual codebase — use real file paths from the tree. Do not include generic files like .gitignore or LICENSE unless they are genuinely important.

Return ONLY the JSON array, no markdown fences or extra text.

${context}` }] }],
      config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
    });

    send({ step: "Fetching commit history..." });
    const commitHistoryPromise = fetchCommitHistory(repo.owner, repo.name, userToken);

    const [summaryResult, archResult, onboardingResult, securityResult, startHereResult, commitHistory] = await Promise.all([
      summaryPromise, architecturePromise, onboardingPromise, securityPromise, startHerePromise, commitHistoryPromise
    ]);

    const summary = summaryResult.text ?? "";
    const architecture = archResult.text ?? "";
    const onboarding = onboardingResult.text ?? "";
    const security = securityResult.text ?? "";
    const startHere = startHereResult.text ?? "";

    send({ step: "Saving results..." });

    await db.delete(analysesTable).where(eq(analysesTable.repoId, repo.id));

    const [analysis] = await db.insert(analysesTable).values({
      repoId: repo.id,
      summary,
      architecture,
      onboarding,
      security,
      startHere,
      commitHistory,
    }).returning();

    await db.update(reposTable).set({ status: "done", updatedAt: new Date() }).where(eq(reposTable.id, repo.id));

    // Award points for authenticated (non-anon) users
    if (!isAnonUserId(userId)) {
      await ensureUserProfile(userId);
      await db
        .update(userProfilesTable)
        .set({
          points: sql`${userProfilesTable.points} + ${POINTS_PER_SCAN}`,
          updatedAt: new Date(),
        })
        .where(eq(userProfilesTable.userId, userId));
    }

    send({ step: "done", analysis });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Analysis failed");
    await db.update(reposTable).set({ status: "error", updatedAt: new Date() }).where(eq(reposTable.id, repo.id));
    send({ step: "error", error: err instanceof Error ? err.message : "Analysis failed" });
    res.end();
  }
});

// GET /api/repos/:id/analysis
router.get("/repos/:id/analysis", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [repo] = await db.select({ id: reposTable.id }).from(reposTable)
      .where(and(eq(reposTable.id, parsed.data.id), eq(reposTable.userId, userId)));
    if (!repo) {
      res.status(404).json({ error: "Repo not found" });
      return;
    }

    const [analysis] = await db.select().from(analysesTable)
      .where(eq(analysesTable.repoId, parsed.data.id))
      .orderBy(desc(analysesTable.createdAt))
      .limit(1);
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "Failed to get analysis");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/repos/:id/chat — ask a contextual question about the repo
router.post("/repos/:id/chat", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsedId = IdParam.safeParse(req.params);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsedBody = ChatBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { question } = parsedBody.data;

  try {
    const [repo] = await db.select().from(reposTable)
      .where(and(eq(reposTable.id, parsedId.data.id), eq(reposTable.userId, userId)));
    if (!repo) {
      res.status(404).json({ error: "Repo not found" });
      return;
    }

    const [analysis] = await db.select().from(analysesTable)
      .where(eq(analysesTable.repoId, repo.id))
      .orderBy(desc(analysesTable.createdAt))
      .limit(1);

    const context = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "N/A"}
Language: ${repo.language ?? "Unknown"}

${analysis?.summary ? `CODEBASE OVERVIEW:\n${analysis.summary}\n` : ""}
${analysis?.onboarding ? `ONBOARDING GUIDE:\n${analysis.onboarding}\n` : ""}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a senior engineer who deeply knows the ${repo.owner}/${repo.name} codebase. A developer is asking you a question about it.

Answer as if you are that senior engineer — be specific, reference real file paths and module names where relevant, explain WHY things work the way they do, and include any tradeoffs or gotchas worth knowing.

If the question asks "where is X", point to specific files. If it asks "how do I do Y", give concrete steps. If it asks "why is Z designed this way", explain the reasoning and tradeoffs.

CODEBASE CONTEXT:
${context}

DEVELOPER QUESTION: ${question}

Answer concisely but completely. Use markdown formatting with code blocks and bullet points where helpful.` }] }],
      config: { maxOutputTokens: 4096 },
    });

    res.json({ answer: result.text ?? "Unable to generate an answer." });
  } catch (err) {
    req.log.error({ err }, "Chat failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/repos/upload — analyze a zip or folder upload
router.post("/repos/upload", upload.single("file"), async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  // Check scan limits
  const limitError = await checkScanLimit(userId);
  if (limitError) {
    res.status(403).json({ error: limitError });
    return;
  }

  const fileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const repoName = fileName.replace(/\.(zip|tar\.gz|tgz)$/, "").slice(0, 50) || "uploaded-project";

  try {
    let fileTree = "";
    let fileContents = "";

    if (req.file.mimetype === "application/zip" || fileName.endsWith(".zip")) {
      // Use JSZip to extract the zip
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(req.file.buffer);
      const entries: string[] = [];
      const contentParts: string[] = [];

      zip.forEach((relativePath, file) => {
        if (!file.dir) entries.push(relativePath);
      });

      fileTree = entries.slice(0, 300).join("\n");

      // Read key files
      const keyEntries = entries.filter(f =>
        /README|package\.json|requirements|setup\.py|Cargo\.toml|go\.mod|Makefile|tsconfig|main\.(ts|js|py|go|rs)|app\.(ts|js|tsx)|index\.(ts|js)/i.test(f)
      ).slice(0, 8);

      for (const entry of keyEntries) {
        try {
          const content = await zip.file(entry)?.async("string");
          if (content) contentParts.push(`=== ${entry} ===\n${content.slice(0, 8000)}`);
        } catch { /* skip */ }
      }

      fileContents = contentParts.join("\n\n");
    } else {
      // Plain text / other formats — treat as single file
      fileTree = fileName;
      fileContents = `=== ${fileName} ===\n${req.file.buffer.toString("utf8").slice(0, 16000)}`;
    }

    const [repo] = await db.insert(reposTable).values({
      userId,
      url: `local://${repoName}`,
      name: repoName,
      owner: "local",
      description: `Uploaded from ${fileName}`,
      language: null,
      stars: null,
      status: "analyzing",
    }).returning();

    if (!isAnonUserId(userId)) {
      await ensureUserProfile(userId);
    }

    res.status(201).json(repo);

    // Run analysis in background (fire-and-forget after response is sent)
    setImmediate(async () => {
      try {
        const context = `Uploaded project: ${repoName}
Source: ${fileName}

File tree:
${fileTree}

Key file contents:
${fileContents}`;

        const [summaryResult, archResult, onboardingResult, securityResult, startHereResult] = await Promise.all([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: `You are a senior software architect. Analyze this uploaded codebase and explain it as you would to a mid-level developer joining the team. Cover what it does, the tech stack, key components, data flow, and design decisions.\n\n${context}` }] }],
            config: { maxOutputTokens: 8192 },
          }),
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: `Generate a Mermaid.js architecture diagram for this codebase. Start with graph TD. Use simple alphanumeric IDs. No markdown fences.\n\n${context}` }] }],
            config: { maxOutputTokens: 4096 },
          }),
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: `Write an onboarding guide for a new contributor to this codebase. Include setup steps, folder structure, how to run it, and common gotchas. Use markdown.\n\n${context}` }] }],
            config: { maxOutputTokens: 8192 },
          }),
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: `Perform a security review of this codebase. Return a JSON array of findings with fields: severity, title, description, recommendation. Return ONLY the JSON array.\n\n${context}` }] }],
            config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
          }),
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: `Identify 5-7 priority files to read first. Return a JSON array with fields: file, title, why, insight. Return ONLY the JSON array.\n\n${context}` }] }],
            config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
          }),
        ]);

        await db.insert(analysesTable).values({
          repoId: repo.id,
          summary: summaryResult.text ?? "",
          architecture: archResult.text ?? "",
          onboarding: onboardingResult.text ?? "",
          security: securityResult.text ?? "",
          startHere: startHereResult.text ?? "",
          commitHistory: "[]",
        });

        await db.update(reposTable)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(reposTable.id, repo.id));

        // Award points for authenticated users
        if (!isAnonUserId(userId)) {
          await db
            .update(userProfilesTable)
            .set({ points: sql`${userProfilesTable.points} + ${POINTS_PER_SCAN}`, updatedAt: new Date() })
            .where(eq(userProfilesTable.userId, userId));
        }
      } catch (err) {
        await db.update(reposTable)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(reposTable.id, repo.id));
      }
    });
  } catch (err) {
    req.log.error({ err }, "Upload analysis failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats — filtered by current user if authenticated
router.get("/stats", async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      res.json({ totalRepos: 0, totalAnalyses: 0, languageCounts: {}, recentRepos: [], points: 0 });
      return;
    }

    const [totalReposResult] = await db.select({ count: count() }).from(reposTable)
      .where(eq(reposTable.userId, userId));
    const recentRepos = await db.select().from(reposTable)
      .where(eq(reposTable.userId, userId))
      .orderBy(desc(reposTable.createdAt))
      .limit(5);

    const userRepoIds = recentRepos.map(r => r.id);
    let totalAnalysesCount = 0;
    if (userRepoIds.length > 0) {
      const [totalAnalysesResult] = await db.select({ count: count() }).from(analysesTable)
        .where(sql`${analysesTable.repoId} IN (SELECT id FROM repos WHERE user_id = ${userId})`);
      totalAnalysesCount = Number(totalAnalysesResult.count);
    }

    const langRows = await db.select({
      language: reposTable.language,
      cnt: count(),
    }).from(reposTable)
      .where(and(eq(reposTable.userId, userId), sql`${reposTable.language} IS NOT NULL`))
      .groupBy(reposTable.language);

    const languageCounts: Record<string, number> = {};
    for (const row of langRows) {
      if (row.language) languageCounts[row.language] = Number(row.cnt);
    }

    // Get points for authenticated users
    let points = 0;
    if (!isAnonUserId(userId)) {
      const [profile] = await db
        .select({ points: userProfilesTable.points })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId))
        .limit(1);
      points = profile?.points ?? 0;
    }

    res.json({
      totalRepos: Number(totalReposResult.count),
      totalAnalyses: totalAnalysesCount,
      languageCounts,
      recentRepos,
      points,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
