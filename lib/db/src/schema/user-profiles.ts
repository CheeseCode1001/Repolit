import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(), // Generated UUID
  isAnon: boolean("is_anon").notNull().default(false),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationCode: text("verification_code"),
  displayName: text("display_name"),
  username: text("username"),
  bio: text("bio"),
  avatarConfig: text("avatar_config"),
  points: integer("points").notNull().default(0),
  extraScansUnlocked: integer("extra_scans_unlocked").notNull().default(0),
  githubAccessToken: text("github_access_token"),
  githubUsername: text("github_username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
