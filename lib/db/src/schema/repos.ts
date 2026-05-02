import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reposTable = pgTable("repos", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  description: text("description"),
  language: text("language"),
  stars: integer("stars"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRepoSchema = createInsertSchema(reposTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepo = z.infer<typeof insertRepoSchema>;
export type Repo = typeof reposTable.$inferSelect;
