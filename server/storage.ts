import { type User, type InsertUser, type ExtractionJob, type InsertExtractionJob, type ProcessingStatus } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createExtractionJob(job: InsertExtractionJob): Promise<ExtractionJob>;
  getExtractionJob(id: string): Promise<ExtractionJob | undefined>;
  updateExtractionJob(id: string, updates: Partial<ExtractionJob>): Promise<ExtractionJob | undefined>;
  getUserExtractionJobs(userId?: string): Promise<ExtractionJob[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private extractionJobs: Map<string, ExtractionJob>;

  constructor() {
    this.users = new Map();
    this.extractionJobs = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createExtractionJob(insertJob: InsertExtractionJob): Promise<ExtractionJob> {
    const id = randomUUID();
    const job: ExtractionJob = {
      ...insertJob,
      id,
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
      results: null,
    };
    this.extractionJobs.set(id, job);
    return job;
  }

  async getExtractionJob(id: string): Promise<ExtractionJob | undefined> {
    return this.extractionJobs.get(id);
  }

  async updateExtractionJob(id: string, updates: Partial<ExtractionJob>): Promise<ExtractionJob | undefined> {
    const job = this.extractionJobs.get(id);
    if (!job) return undefined;

    const updatedJob = { ...job, ...updates };
    this.extractionJobs.set(id, updatedJob);
    return updatedJob;
  }

  async getUserExtractionJobs(userId?: string): Promise<ExtractionJob[]> {
    const jobs = Array.from(this.extractionJobs.values());
    if (userId) {
      return jobs.filter(job => job.userId === userId);
    }
    return jobs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
}

export const storage = new MemStorage();
