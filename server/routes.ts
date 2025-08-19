import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExtractionJobSchema, type ProcessingStatus } from "@shared/schema";
import { LangExtractService } from "./services/langextract";
import { z } from "zod";

const langExtractService = new LangExtractService();

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize LangExtract service
  try {
    await langExtractService.initialize();
  } catch (error) {
    console.warn("Failed to initialize LangExtract service:", error);
  }

  // Create extraction job
  app.post("/api/extractions", async (req, res) => {
    try {
      const jobData = insertExtractionJobSchema.parse(req.body);
      const job = await storage.createExtractionJob(jobData);

      // Start extraction process in background
      processExtractionJob(job.id).catch(error => {
        console.error(`Failed to process job ${job.id}:`, error);
        storage.updateExtractionJob(job.id, {
          status: "failed",
          results: { error: error.message },
          completedAt: new Date(),
        });
      });

      res.json(job);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Get extraction job status
  app.get("/api/extractions/:id", async (req, res) => {
    try {
      const job = await storage.getExtractionJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Get all extraction jobs
  app.get("/api/extractions", async (req, res) => {
    try {
      const jobs = await storage.getUserExtractionJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Generate visualization
  app.get("/api/extractions/:id/visualization", async (req, res) => {
    try {
      const job = await storage.getExtractionJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== "completed" || !job.results) {
        return res.status(400).json({ message: "Job not completed or has no results" });
      }

      const html = await langExtractService.generateVisualization(
        job.id,
        job.results.extractions || [],
        job.inputText
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate visualization" });
    }
  });

  // Export results
  app.get("/api/extractions/:id/export", async (req, res) => {
    try {
      const format = req.query.format as string || 'json';
      const job = await storage.getExtractionJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.status !== "completed" || !job.results) {
        return res.status(400).json({ message: "Job not completed or has no results" });
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="extraction_${job.id}.json"`);
        res.json({
          jobId: job.id,
          inputText: job.inputText,
          promptDescription: job.promptDescription,
          modelId: job.modelId,
          results: job.results,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        });
      } else if (format === 'csv') {
        const extractions = job.results.extractions || [];
        const csvHeader = 'extraction_class,extraction_text,attributes,position_start,position_end,confidence\n';
        const csvRows = extractions.map(ext => 
          `"${ext.extraction_class}","${ext.extraction_text}","${JSON.stringify(ext.attributes).replace(/"/g, '""')}",${ext.position_start || ''},${ext.position_end || ''},${ext.confidence || ''}`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="extraction_${job.id}.csv"`);
        res.send(csvHeader + csvRows);
      } else {
        res.status(400).json({ message: "Unsupported format. Use 'json' or 'csv'" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to export results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processExtractionJob(jobId: string) {
  const job = await storage.getExtractionJob(jobId);
  if (!job) return;

  try {
    // Update status to processing
    await storage.updateExtractionJob(jobId, { status: "processing" });

    // Run extraction
    const result = await langExtractService.extract({
      text: job.inputText,
      promptDescription: job.promptDescription,
      examples: job.examples,
      modelId: job.modelId,
      extractionPasses: job.extractionPasses || 1,
      maxWorkers: job.maxWorkers || 5,
    });

    // Update job with results
    await storage.updateExtractionJob(jobId, {
      status: "completed",
      results: result,
      completedAt: new Date(),
    });

  } catch (error) {
    console.error(`Extraction job ${jobId} failed:`, error);
    await storage.updateExtractionJob(jobId, {
      status: "failed",
      results: { error: error instanceof Error ? error.message : "Unknown error" },
      completedAt: new Date(),
    });
  }
}
