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
import type { ExtractionResult } from "@shared/schema";
import { GeminiExampleService } from "./services/gemini";

const langExtractService = new LangExtractService();
let geminiExampleService: GeminiExampleService | null = null;

// Initialize Gemini service if API key is available
try {
  geminiExampleService = new GeminiExampleService();
} catch (error) {
  console.warn("Gemini service not available:", error);
}

// Helper function to generate enhanced PDF content with professional design
async function generatePDFContent(job: any, extractions: ExtractionResult[], metadata: any): Promise<Buffer> {
  console.log("Generating enhanced PDF content with professional design...");
  
  // Calculate statistics
  const entityTypeCounts = extractions.reduce((acc, ext) => {
    acc[ext.extraction_class] = (acc[ext.extraction_class] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const avgConfidence = extractions.length > 0 
    ? extractions.filter(e => e.confidence).reduce((sum, e) => sum + (e.confidence || 0), 0) / extractions.filter(e => e.confidence).length
    : 0;
  
  const uniqueEntityTypes = Object.keys(entityTypeCounts);
  const textLength = job.inputText.length;
  
  // Create enhanced HTML content with professional styling
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LangExtract Results Report - ${job.id}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.7;
            color: #1f2937;
            background: #ffffff;
            font-size: 14px;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .header .subtitle {
            font-size: 16px;
            font-weight: 300;
            opacity: 0.9;
        }
        
        .header .timestamp {
            font-size: 13px;
            margin-top: 15px;
            opacity: 0.8;
        }
        
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 30px;
        }
        
        .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .card-header {
            margin-bottom: 20px;
        }
        
        .card-title {
            font-size: 18px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .card-subtitle {
            font-size: 13px;
            color: #6b7280;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 28px;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .entity-types {
            margin-bottom: 25px;
        }
        
        .entity-type-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            margin: 8px 0;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
        }
        
        .entity-type-name {
            font-weight: 500;
            color: #374151;
        }
        
        .entity-type-count {
            background: #3b82f6;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .extraction {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 20px;
            margin: 15px 0;
            background: #ffffff;
            transition: all 0.2s ease;
        }
        
        .extraction:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .extraction-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .extraction-type {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .confidence-badge {
            background: #10b981;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        }
        
        .extraction-text {
            font-weight: 600;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            padding: 12px 15px;
            border-radius: 8px;
            margin: 12px 0;
            border-left: 4px solid #f59e0b;
            font-size: 15px;
        }
        
        .attributes {
            background: #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            font-size: 13px;
            border: 1px solid #e2e8f0;
        }
        
        .attribute-item {
            display: flex;
            margin: 5px 0;
        }
        
        .attribute-key {
            font-weight: 600;
            color: #374151;
            margin-right: 8px;
            min-width: 80px;
        }
        
        .attribute-value {
            color: #6b7280;
        }
        
        .source-text {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 20px;
            border-radius: 10px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            line-height: 1.8;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .section-title {
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            margin: 35px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
            position: relative;
        }
        
        .section-title::before {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 60px;
            height: 2px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .footer {
            margin-top: 50px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
        
        .footer-logo {
            font-weight: 700;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        @media print {
            body { background: white !important; }
            .container { padding: 15mm; }
            .card { box-shadow: none; }
            .extraction:hover { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 LangExtract Results Report</h1>
            <div class="subtitle">AI-Powered Structured Data Extraction Analysis</div>
            <div class="timestamp">Generated on ${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Job Information</div>
                    <div class="card-subtitle">Extraction job details and configuration</div>
                </div>
                <div style="space-y: 10px;">
                    <div style="margin-bottom: 8px;"><strong>Job ID:</strong> ${job.id}</div>
                    <div style="margin-bottom: 8px;"><strong>Model:</strong> ${job.modelId}</div>
                    <div style="margin-bottom: 8px;"><strong>Status:</strong> <span style="color: #10b981; font-weight: 600;">${job.status.toUpperCase()}</span></div>
                    <div style="margin-bottom: 8px;"><strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}</div>
                    ${job.completedAt ? `<div><strong>Completed:</strong> ${new Date(job.completedAt).toLocaleString()}</div>` : ''}
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Processing Summary</div>
                    <div class="card-subtitle">Key metrics and performance data</div>
                </div>
                <div style="space-y: 10px;">
                    <div style="margin-bottom: 8px;"><strong>Text Length:</strong> ${textLength.toLocaleString()} characters</div>
                    <div style="margin-bottom: 8px;"><strong>Processing Time:</strong> ${metadata.processingTime ? (metadata.processingTime / 1000).toFixed(2) + 's' : 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Average Confidence:</strong> ${avgConfidence > 0 ? (avgConfidence * 100).toFixed(1) + '%' : 'N/A'}</div>
                    <div><strong>Extraction Rate:</strong> ${textLength > 0 ? (extractions.length / textLength * 1000).toFixed(2) : '0'} entities/1k chars</div>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${extractions.length}</div>
                <div class="stat-label">Total Extractions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueEntityTypes.length}</div>
                <div class="stat-label">Entity Types</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${extractions.filter(e => e.attributes && Object.keys(e.attributes).length > 0).length}</div>
                <div class="stat-label">With Attributes</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${extractions.filter(e => e.confidence && e.confidence > 0.8).length}</div>
                <div class="stat-label">High Confidence</div>
            </div>
        </div>

        <h2 class="section-title">Prompt Description</h2>
        <div class="card">
            <div style="font-size: 15px; line-height: 1.7; color: #374151;">${job.promptDescription}</div>
        </div>

        <h2 class="section-title">Entity Type Breakdown</h2>
        <div class="entity-types">
            ${Object.entries(entityTypeCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([type, count]) => `
                <div class="entity-type-item">
                    <span class="entity-type-name">${type}</span>
                    <span class="entity-type-count">${count}</span>
                </div>
            `).join('')}
        </div>

        <div class="page-break"></div>
        
        <h2 class="section-title">Extracted Entities (${extractions.length})</h2>
        ${extractions.map((extraction, index) => `
            <div class="extraction">
                <div class="extraction-header">
                    <span class="extraction-type">${extraction.extraction_class}</span>
                    ${extraction.confidence ? `<span class="confidence-badge">${(extraction.confidence * 100).toFixed(0)}%</span>` : ''}
                </div>
                <div class="extraction-text">${extraction.extraction_text}</div>
                ${extraction.attributes && Object.keys(extraction.attributes).length > 0 ? `
                    <div class="attributes">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">Attributes:</div>
                        ${Object.entries(extraction.attributes).map(([key, value]) => `
                            <div class="attribute-item">
                                <span class="attribute-key">${key}:</span>
                                <span class="attribute-value">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('')}

        <div class="page-break"></div>
        
        <h2 class="section-title">Source Text</h2>
        <div class="source-text">${job.inputText.length > 3000 ? 
          job.inputText.substring(0, 3000) + '\n\n[Text truncated for PDF export - showing first 3000 characters]' : 
          job.inputText
        }</div>

        <div class="footer">
            <div class="footer-logo">LangExtract Platform</div>
            <div>AI-powered structured data extraction • ${new Date().getFullYear()}</div>
            <div style="margin-top: 5px; font-size: 11px;">Report generated with advanced natural language processing</div>
        </div>
    </div>
</body>
</html>`;

  // For now, return the HTML as a basic "PDF" - in a production environment,
  // you would use a proper HTML-to-PDF service or library
  // This is a fallback approach when Puppeteer is not available
  
  try {
    // Try to use dynamic import for puppeteer as a fallback
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
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
  } catch (puppeteerError) {
    console.warn("Puppeteer not available, using HTML-to-PDF fallback:", puppeteerError);
    
    // Enhanced fallback: return HTML with print-friendly styles
    const printableHtml = htmlContent.replace(
      '<head>',
      `<head>
        <style>
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
          }
        </style>`
    );
    
    // Return as HTML with proper headers for browser PDF generation
    return Buffer.from(printableHtml, 'utf8');
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
    } catch (error: any) {
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
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Get all extraction jobs
  app.get("/api/extractions", async (req, res) => {
    try {
      const jobs = await storage.getUserExtractionJobs();
      res.json(jobs);
    } catch (error: any) {
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
    } catch (error: any) {
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
        try {
          const results = job.results as any;
          const extractions = results?.extractions || [];
          const metadata = results?.metadata || {};
          
          console.log(`Generating PDF for job ${job.id} with ${extractions.length} extractions`);
          
          // Generate PDF content
          const pdfContent = await generatePDFContent(job, extractions, metadata);
          
          // Check if it's HTML fallback or actual PDF
          const contentType = pdfContent.toString('utf8').startsWith('<!DOCTYPE html') ? 'text/html' : 'application/pdf';
          
          if (contentType === 'text/html') {
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', 'inline');
            res.send(pdfContent.toString('utf8'));
          } else {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="extraction_${job.id}.pdf"`);
            res.send(pdfContent);
          }
        } catch (pdfError: any) {
          console.error("PDF generation error:", pdfError);
          return res.status(500).json({ 
            message: "Failed to generate PDF", 
            error: pdfError?.message || "Unknown PDF error" 
          });
        }
      } else {
        res.status(400).json({ message: "Unsupported format. Use 'json', 'csv', or 'pdf'" });
      }
    } catch (error: any) {
      res.status(500).json({ message: "Failed to export results" });
    }
  });

  // Generate examples using Gemini AI
  app.post("/api/generate-examples", async (req, res) => {
    try {
      if (!geminiExampleService) {
        return res.status(400).json({ 
          message: "AI example generation not available. Please ensure GEMINI_API_KEY is configured." 
        });
      }

      const { promptDescription, count = 1 } = req.body;
      
      if (!promptDescription || typeof promptDescription !== 'string') {
        return res.status(400).json({ 
          message: "promptDescription is required and must be a string" 
        });
      }

      const requestedCount = Math.min(Math.max(1, parseInt(count) || 1), 3); // Limit to 1-3 examples
      
      const examples = await geminiExampleService.generateMultipleExamples(
        promptDescription, 
        requestedCount
      );

      res.json({ 
        examples,
        generated: examples.length,
        requested: requestedCount
      });
    } catch (error: any) {
      console.error("Failed to generate examples:", error);
      res.status(500).json({ 
        message: "Failed to generate examples",
        details: error?.message || "Unknown error"
      });
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
          } catch (error: any) {
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

    } catch (error: any) {
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

    } catch (error: any) {
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
