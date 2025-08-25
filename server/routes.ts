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
import puppeteer from "puppeteer";
import type { ExtractionResult } from "@shared/schema";

const langExtractService = new LangExtractService();

// Helper function to generate PDF content
async function generatePDFContent(job: any, extractions: ExtractionResult[], metadata: any): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Generate HTML content for PDF
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LangExtract Results - ${job.id}</title>
        <style>
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                background: #fff;
            }
            .header {
                text-align: center;
                margin-bottom: 40px;
                border-bottom: 3px solid #a855f7;
                padding-bottom: 20px;
            }
            .header h1 {
                color: #a855f7;
                font-size: 32px;
                margin: 0 0 10px 0;
                font-weight: 700;
            }
            .header .subtitle {
                color: #6b7280;
                font-size: 16px;
                margin: 0;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                margin-bottom: 40px;
            }
            .info-card {
                background: #f8fafc;
                padding: 20px;
                border-radius: 12px;
                border-left: 4px solid #a855f7;
            }
            .info-card h3 {
                margin: 0 0 10px 0;
                color: #1f2937;
                font-size: 16px;
                font-weight: 600;
            }
            .info-card p {
                margin: 0;
                color: #6b7280;
                font-size: 14px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 40px;
            }
            .stat-card {
                text-align: center;
                background: #f1f5f9;
                padding: 20px 15px;
                border-radius: 10px;
                border-top: 4px solid #3b82f6;
            }
            .stat-card .number {
                font-size: 28px;
                font-weight: 700;
                color: #3b82f6;
                margin-bottom: 5px;
            }
            .stat-card .label {
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .section {
                margin-bottom: 40px;
            }
            .section-title {
                font-size: 24px;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #e5e7eb;
            }
            .extraction-item {
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 15px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .extraction-header {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }
            .extraction-badge {
                background: #a855f7;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                margin-right: 12px;
            }
            .extraction-meta {
                color: #6b7280;
                font-size: 12px;
            }
            .extraction-text {
                font-size: 16px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 10px;
                background: #fef3c7;
                padding: 8px 12px;
                border-radius: 6px;
                border-left: 4px solid #f59e0b;
            }
            .extraction-attributes {
                background: #f8fafc;
                padding: 12px;
                border-radius: 6px;
                font-size: 13px;
                color: #64748b;
            }
            .source-text {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                padding: 20px;
                border-radius: 8px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 13px;
                line-height: 1.5;
                color: #374151;
                white-space: pre-wrap;
                max-height: 300px;
                overflow-y: auto;
            }
            .footer {
                margin-top: 60px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                color: #9ca3af;
                font-size: 12px;
            }
            .page-break {
                page-break-before: always;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🧠 LangExtract Results</h1>
            <p class="subtitle">Extraction Report Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="info-grid">
            <div class="info-card">
                <h3>Job Information</h3>
                <p><strong>ID:</strong> ${job.id}</p>
                <p><strong>Model:</strong> ${job.modelId}</p>
                <p><strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}</p>
            </div>
            <div class="info-card">
                <h3>Processing Details</h3>
                <p><strong>Status:</strong> ${job.status}</p>
                <p><strong>Passes:</strong> ${job.extractionPasses || 1}</p>
                <p><strong>Workers:</strong> ${job.maxWorkers || 5}</p>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="number">${extractions.length}</div>
                <div class="label">Total Extractions</div>
            </div>
            <div class="stat-card">
                <div class="number">${new Set(extractions.map(e => e.extraction_class)).size}</div>
                <div class="label">Entity Types</div>
            </div>
            <div class="stat-card">
                <div class="number">${metadata.processingTime ? (metadata.processingTime / 1000).toFixed(1) + 's' : 'N/A'}</div>
                <div class="label">Processing Time</div>
            </div>
            <div class="stat-card">
                <div class="number">${metadata.averageConfidence ? (metadata.averageConfidence * 100).toFixed(0) + '%' : 'N/A'}</div>
                <div class="label">Avg Confidence</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Prompt Description</h2>
            <div class="extraction-attributes">
                ${job.promptDescription}
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Extracted Entities (${extractions.length})</h2>
            ${extractions.map(extraction => `
                <div class="extraction-item">
                    <div class="extraction-header">
                        <span class="extraction-badge">${extraction.extraction_class}</span>
                        <span class="extraction-meta">
                            ${extraction.position_start !== undefined ? `Position: ${extraction.position_start}-${extraction.position_end}` : ''}
                            ${extraction.confidence ? `• Confidence: ${(extraction.confidence * 100).toFixed(0)}%` : ''}
                        </span>
                    </div>
                    <div class="extraction-text">${extraction.extraction_text}</div>
                    ${extraction.attributes && Object.keys(extraction.attributes).length > 0 ? `
                        <div class="extraction-attributes">
                            <strong>Attributes:</strong> ${Object.entries(extraction.attributes).map(([key, value]) => `${key}: "${value}"`).join(', ')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="section page-break">
            <h2 class="section-title">Source Text</h2>
            <div class="source-text">${job.inputText.length > 2000 ? job.inputText.substring(0, 2000) + '...\n\n[Text truncated for PDF export]' : job.inputText}</div>
        </div>

        <div class="footer">
            <p>Generated by LangExtract Platform • ${new Date().getFullYear()}</p>
            <p>AI-powered structured data extraction with source grounding</p>
        </div>
    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

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
      } else if (format === 'pdf') {
        const results = job.results as any;
        const extractions = results?.extractions || [];
        const metadata = results?.metadata || {};
        
        // Generate PDF content
        const pdfContent = await generatePDFContent(job, extractions, metadata);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="extraction_${job.id}.pdf"`);
        res.send(pdfContent);
      } else {
        res.status(400).json({ message: "Unsupported format. Use 'json', 'csv', or 'pdf'" });
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

      } catch (extractionError: any) {
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
          
          if (scrapeResult.success && (scrapeResult as any).data?.markdown) {
            text = (scrapeResult as any).data.markdown;
            method = "firecrawl";
          } else if (scrapeResult.success && (scrapeResult as any).data?.html) {
            // Fallback to HTML extraction
            const cheerio = await import('cheerio');
            const $ = cheerio.load((scrapeResult as any).data.html);
            text = $('body').text().trim();
            method = "firecrawl-html";
          }
        } catch (firecrawlError: any) {
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
