import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const extractionJobs = pgTable("extraction_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  inputText: text("input_text").notNull(),
  promptDescription: text("prompt_description").notNull(),
  examples: json("examples").notNull(),
  modelId: text("model_id").notNull(),
  extractionPasses: integer("extraction_passes").default(1),
  maxWorkers: integer("max_workers").default(5),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  results: json("results"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertExtractionJobSchema = createInsertSchema(extractionJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).extend({
  examples: z.array(z.object({
    text: z.string(),
    extractions: z.array(z.object({
      extraction_class: z.string(),
      extraction_text: z.string(),
      attributes: z.record(z.string(), z.any()),
    }))
  }))
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertExtractionJob = z.infer<typeof insertExtractionJobSchema>;
export type ExtractionJob = typeof extractionJobs.$inferSelect;

// Types for LangExtract integration
export interface ExtractionResult {
  extraction_class: string;
  extraction_text: string;
  attributes: Record<string, any>;
  position_start?: number;
  position_end?: number;
  confidence?: number;
}

export interface ProcessingStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  currentStep?: string;
  totalExtractions?: number;
  processingTime?: number;
  error?: string;
}
