import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reposTable } from "./repos";

export const sharedReposTable = pgTable("shared_repos", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").notNull().references(() => reposTable.id, { onDelete: "cascade" }),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSharedRepoSchema = createInsertSchema(sharedReposTable).omit({ id: true, createdAt: true });
export type InsertSharedRepo = z.infer<typeof insertSharedRepoSchema>;
export type SharedRepo = typeof sharedReposTable.$inferSelect;
