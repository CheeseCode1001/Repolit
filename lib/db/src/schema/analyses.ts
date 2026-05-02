import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reposTable } from "./repos";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").notNull().references(() => reposTable.id, { onDelete: "cascade" }),
  summary: text("summary"),
  architecture: text("architecture"),
  onboarding: text("onboarding"),
  security: text("security"),
  startHere: text("start_here"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
