import { Router } from "express";
import { db } from "@workspace/db";
import { reposTable, analysesTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { z } from "zod";

const router = Router();

const CreateRepoBody = z.object({ url: z.string().url() });
const IdParam = z.object({ id: z.coerce.number() });

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

async function fetchGitHubRepoMeta(owner: string, name: string) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: { Accept: "application/vnd.github+json" },
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

async function fetchRepoTree(owner: string, name: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/git/trees/HEAD?recursive=1`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return "";
    const data = await res.json() as { tree?: { path?: string; type?: string }[] };
    const files = (data.tree ?? [])
      .filter((f) => f.type === "blob" && f.path)
      .map((f) => f.path!)
      .slice(0, 200);
    return files.join("\n");
  } catch {
    return "";
  }
}

async function fetchFileContent(owner: string, name: string, path: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/${path}`,
      { headers: { Accept: "application/vnd.github+json" } }
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

// GET /api/repos
router.get("/repos", async (req, res) => {
  try {
    const repos = await db.select().from(reposTable).orderBy(desc(reposTable.createdAt)).limit(20);
    res.json(repos);
  } catch (err) {
    req.log.error({ err }, "Failed to list repos");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/repos
router.post("/repos", async (req, res) => {
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
    const existing = await db.select().from(reposTable).where(eq(reposTable.url, url)).limit(1);
    if (existing.length > 0) {
      res.status(201).json(existing[0]);
      return;
    }

    const meta = await fetchGitHubRepoMeta(owner, name);
    const [repo] = await db.insert(reposTable).values({
      url,
      name,
      owner,
      description: meta?.description ?? null,
      language: meta?.language ?? null,
      stars: meta?.stars ?? null,
      status: "pending",
    }).returning();

    res.status(201).json(repo);
  } catch (err) {
    req.log.error({ err }, "Failed to create repo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/repos/:id
router.get("/repos/:id", async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [repo] = await db.select().from(reposTable).where(eq(reposTable.id, parsed.data.id));
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
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(reposTable).where(eq(reposTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete repo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/repos/:id/analyze — SSE streaming analysis
router.post("/repos/:id/analyze", async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [repo] = await db.select().from(reposTable).where(eq(reposTable.id, parsed.data.id));
  if (!repo) {
    res.status(404).json({ error: "Repo not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    await db.update(reposTable).set({ status: "analyzing" }).where(eq(reposTable.id, repo.id));
    send({ step: "Fetching repository tree..." });

    const tree = await fetchRepoTree(repo.owner, repo.name);

    send({ step: "Reading key files..." });
    const keyFiles = tree.split("\n").filter(f =>
      /README|package\.json|requirements|setup\.py|Cargo\.toml|go\.mod|Makefile|docker|\.env\.example/i.test(f)
    ).slice(0, 5);

    const fileContents: string[] = [];
    for (const file of keyFiles) {
      const content = await fetchFileContent(repo.owner, repo.name, file);
      if (content) fileContents.push(`=== ${file} ===\n${content}`);
    }

    const context = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "N/A"}
Language: ${repo.language ?? "Unknown"}
Stars: ${repo.stars ?? 0}

File tree (first 200 files):
${tree}

Key file contents:
${fileContents.join("\n\n")}`;

    send({ step: "Analyzing architecture..." });

    const summaryPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a senior software architect. Analyze this GitHub repository and provide a concise high-level summary (2-3 paragraphs) covering: purpose, tech stack, key components, and notable patterns.\n\n${context}` }] }],
      config: { maxOutputTokens: 8192 },
    });

    send({ step: "Generating architecture diagrams..." });

    const architecturePromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a software architect. Generate a Mermaid.js diagram showing the architecture or data flow of this repository. Output ONLY valid Mermaid syntax (start with graph TD or flowchart TD or sequenceDiagram etc). No markdown fences, no explanation.\n\n${context}` }] }],
      config: { maxOutputTokens: 8192 },
    });

    send({ step: "Writing onboarding guide..." });

    const onboardingPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a developer advocate. Write a clear onboarding guide for new contributors to this repository. Include: prerequisites, setup steps, folder structure explanation, how to run/test, and first contribution tips. Use markdown with headers and bullet points.\n\n${context}` }] }],
      config: { maxOutputTokens: 8192 },
    });

    send({ step: "Running security scan..." });

    const securityPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `You are a security engineer. Analyze this repository for potential security issues. Look for: hardcoded secrets, insecure patterns, missing auth checks, dependency concerns, and common vulnerabilities. Return a JSON array of findings, each with {severity: "critical"|"high"|"medium"|"low"|"info", title: string, description: string, recommendation: string}. Return ONLY the JSON array, no markdown.\n\n${context}` }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const [summaryResult, archResult, onboardingResult, securityResult] = await Promise.all([
      summaryPromise, architecturePromise, onboardingPromise, securityPromise
    ]);

    const summary = summaryResult.text ?? "";
    const architecture = archResult.text ?? "";
    const onboarding = onboardingResult.text ?? "";
    const security = securityResult.text ?? "";

    send({ step: "Saving results..." });

    // Delete old analysis if exists
    await db.delete(analysesTable).where(eq(analysesTable.repoId, repo.id));

    const [analysis] = await db.insert(analysesTable).values({
      repoId: repo.id,
      summary,
      architecture,
      onboarding,
      security,
    }).returning();

    await db.update(reposTable).set({ status: "done", updatedAt: new Date() }).where(eq(reposTable.id, repo.id));

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
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
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

// GET /api/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalReposResult] = await db.select({ count: count() }).from(reposTable);
    const [totalAnalysesResult] = await db.select({ count: count() }).from(analysesTable);
    const recentRepos = await db.select().from(reposTable).orderBy(desc(reposTable.createdAt)).limit(5);

    const langRows = await db.select({
      language: reposTable.language,
      cnt: count(),
    }).from(reposTable).where(sql`${reposTable.language} IS NOT NULL`).groupBy(reposTable.language);

    const languageCounts: Record<string, number> = {};
    for (const row of langRows) {
      if (row.language) languageCounts[row.language] = Number(row.cnt);
    }

    res.json({
      totalRepos: Number(totalReposResult.count),
      totalAnalyses: Number(totalAnalysesResult.count),
      languageCounts,
      recentRepos,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
