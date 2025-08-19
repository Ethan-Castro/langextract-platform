import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExtractionJobSchema, type ProcessingStatus } from "@shared/schema";
import { LangExtractService } from "./services/langextract";
import { z } from "zod";
import multer from "multer";
import fs from "fs/promises";
import fetch from "node-fetch";
import mammoth from "mammoth";
import { spawn } from "child_process";
import FirecrawlApp from "@mendable/firecrawl-js";
import path from "path";
import os from "os";

const langExtractService = new LangExtractService();

// Helper function to extract text from files using Python script
async function extractTextFromFile(filePath: string, mimeType?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['scripts/enhanced_langextract_runner.py'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const config = {
      inputText: "",
      filePath: filePath,
      promptDescription: "Extract text content",
      examples: [],
      modelId: "gemini-2.5-flash"
    };

    pythonProcess.stdin.write(JSON.stringify(config));
    pythonProcess.stdin.end();

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Text extraction failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        if (result.success && result.extractedText) {
          resolve(result.extractedText);
        } else {
          reject(new Error(result.error || 'Failed to extract text'));
        }
      } catch (e) {
        reject(new Error(`Failed to parse extraction result: ${output}`));
      }
    });
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

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

      const results = job.results as any;
      const html = await langExtractService.generateVisualization(
        job.id,
        results?.extractions || [],
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
        const results = job.results as any;
        const extractions = results?.extractions || [];
        const csvHeader = 'extraction_class,extraction_text,attributes,position_start,position_end,confidence\n';
        const csvRows = extractions.map((ext: any) => 
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

  // Enhanced file upload endpoint with comprehensive format support
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Save file temporarily for Python processing
      const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${req.file.originalname}`);
      await fs.writeFile(tempFilePath, req.file.buffer);

      try {
        // Use Python script to extract text from various file formats
        const extractedText = await extractTextFromFile(tempFilePath, req.file.mimetype);
        
        if (!extractedText || extractedText.trim().length === 0) {
          return res.status(400).json({ 
            message: "No text could be extracted from this file",
            supportedFormats: [".txt", ".docx", ".pdf", ".xlsx", ".pptx", ".html", ".json", ".csv", ".md"]
          });
        }

        res.json({
          text: extractedText.trim(),
          filename: req.file.originalname,
          size: req.file.size,
          fileType: req.file.mimetype,
          extractedLength: extractedText.length
        });

      } catch (extractionError) {
        console.error("Enhanced extraction failed, trying fallback:", extractionError);
        
        // Fallback to basic extraction for txt and docx
        let text = "";
        
        if (req.file.mimetype === 'text/plain' || req.file.originalname.endsWith('.txt')) {
          text = req.file.buffer.toString('utf-8');
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          try {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
          } catch (error) {
            return res.status(400).json({ 
              message: "Failed to parse file. Enhanced extraction unavailable.",
              error: extractionError.message 
            });
          }
        } else {
          return res.status(400).json({ 
            message: "Unsupported file type. Enhanced extraction failed.",
            error: extractionError.message,
            supportedFormats: [".txt", ".docx"] 
          });
        }

        if (!text || text.trim().length === 0) {
          return res.status(400).json({ message: "No text content found in the file" });
        }

        res.json({
          text: text.trim(),
          filename: req.file.originalname,
          size: req.file.size,
          fallbackExtraction: true
        });
      } finally {
        // Clean up temp file
        fs.unlink(tempFilePath).catch(() => {});
      }

    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to process uploaded file" });
    }
  });

  // Enhanced URL fetch endpoint with FireCrawl integration
  app.post("/api/fetch-url", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      let text = "";
      let method = "basic";

      // Try FireCrawl first if API key is available
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
      if (firecrawlApiKey) {
        try {
          const app = new FirecrawlApp({ apiKey: firecrawlApiKey });
          const scrapeResult = await app.scrapeUrl(url, {
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            waitFor: 2000,
          });
          
          if (scrapeResult.success && scrapeResult.data?.markdown) {
            text = scrapeResult.data.markdown;
            method = "firecrawl";
          } else if (scrapeResult.success && scrapeResult.data?.html) {
            // Fallback to HTML extraction
            const cheerio = await import('cheerio');
            const $ = cheerio.load(scrapeResult.data.html);
            text = $('body').text().trim();
            method = "firecrawl-html";
          }
        } catch (firecrawlError) {
          console.log("FireCrawl failed, falling back to basic fetch:", firecrawlError.message);
        }
      }

      // Fallback to basic fetch if FireCrawl didn't work
      if (!text) {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/html')) {
          const html = await response.text();
          const cheerio = await import('cheerio');
          const $ = cheerio.load(html);
          
          // Remove script and style elements
          $('script, style, nav, footer, header, aside').remove();
          
          // Extract main content
          const mainContent = $('main, article, .content, .post, .entry').first();
          text = mainContent.length > 0 ? mainContent.text() : $('body').text();
          text = text.replace(/\s+/g, ' ').trim();
          method = "basic-html";
        } else if (contentType.includes('text/')) {
          text = await response.text();
          method = "basic-text";
        } else {
          throw new Error(`Unsupported content type: ${contentType}`);
        }
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ 
          message: "No text content could be extracted from this URL",
          method: method
        });
      }

      res.json({ 
        text: text.trim(), 
        url: url,
        method: method,
        length: text.length
      });

    } catch (error) {
      console.error("URL fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch content from URL",
        error: error.message
      });
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
      prompt_description: job.promptDescription,  // Use snake_case for Python script
      examples: job.examples as any,
      model_id: job.modelId,  // Use snake_case for Python script
      extraction_passes: job.extractionPasses || 1,  // Use snake_case for Python script
      max_workers: job.maxWorkers || 5,  // Use snake_case for Python script
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
