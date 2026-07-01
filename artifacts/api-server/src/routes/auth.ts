import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateToken } from "../lib/jwt";
import { requireAuth } from "../middlewares/resolveUser";
import { sendVerificationEmail, sendWelcomeEmail, sendWelcomeBackEmail } from "../lib/email";

const router = Router();

const SignupBody = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]*$/),
  email: z.string().email(),
  password: z.string().min(6), // password strength will be checked on frontend, but we enforce min 6 here
});

const LoginBody = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

const VerifyEmailBody = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

// GET /api/auth/check-username/:username
router.get("/auth/check-username/:username", async (req, res) => {
  const username = req.params.username;
  if (!username) { res.json({ available: false }); return; }

  const existing = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.username, username))
    .limit(1);

  res.json({ available: existing.length === 0 });
});

// POST /api/auth/signup
router.post("/auth/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { username, email, password } = parsed.data;

  // Check if username or email exists
  const existing = await db
    .select({ userId: userProfilesTable.userId, username: userProfilesTable.username, email: userProfilesTable.email })
    .from(userProfilesTable)
    .where(or(eq(userProfilesTable.username, username), eq(userProfilesTable.email, email)))
    .limit(2);

  if (existing.length > 0) {
    if (existing.some(u => u.username === username)) {
      res.status(400).json({ error: "Username already taken" }); return;
    }
    if (existing.some(u => u.email === email)) {
      res.status(400).json({ error: "Email already in use" }); return;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();
  const verificationCode = crypto.randomBytes(32).toString("hex");

  await db.insert(userProfilesTable).values({
    userId,
    username,
    email,
    passwordHash,
    verificationCode: null,
    emailVerified: true,
    displayName: username,
  });

  // Send welcome email
  await sendWelcomeEmail(email, username);

  const token = generateToken({ userId });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ userId, username, email, emailVerified: true });
});

// POST /api/auth/verify-email
router.post("/auth/verify-email", async (req, res) => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, code } = parsed.data;

  const [user] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.email, email))
    .limit(1);

  if (!user || user.verificationCode !== code) {
    res.status(400).json({ error: "Invalid verification code or email" });
    return;
  }

  if (user.emailVerified) {
    res.json({ success: true, message: "Email already verified" });
    return;
  }

  await db.update(userProfilesTable)
    .set({ emailVerified: true, verificationCode: null, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, user.userId));

  // Send welcome email
  await sendWelcomeEmail(user.email!, user.username!);

  res.json({ success: true });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { login, password } = parsed.data;

  const [user] = await db
    .select()
    .from(userProfilesTable)
    .where(or(eq(userProfilesTable.username, login), eq(userProfilesTable.email, login)))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken({ userId: user.userId });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Send welcome back email asynchronously
  if (user.email) {
    sendWelcomeBackEmail(user.email, user.username!).catch(err => {
      req.log.error({ err }, "Failed to send welcome back email");
    });
  }

  res.json({ userId: user.userId, username: user.username, email: user.email, emailVerified: user.emailVerified });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  if (!req.userId || req.isAnon) {
    res.json({ user: null });
    return;
  }

  const [user] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId))
    .limit(1);

  if (!user) {
    res.json({ user: null });
    return;
  }

  res.json({
    user: {
      userId: user.userId,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      points: user.points,
      githubUsername: user.githubUsername,
    }
  });
});

export default router;
