import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { ExtractionResult, ProcessingStatus } from "@shared/schema";

interface LangExtractConfig {
  text: string;
  prompt_description: string;  // Snake case for Python compatibility
  examples: Array<{
    text: string;
    extractions: ExtractionResult[];
  }>;
  model_id: string;  // Snake case for Python compatibility
  extraction_passes?: number;  // Snake case for Python compatibility
  max_workers?: number;  // Snake case for Python compatibility
  api_key?: string;  // Snake case for Python compatibility
}

interface LangExtractResponse {
  extractions: ExtractionResult[];
  processingTime: number;
  metadata: {
    totalExtractions: number;
    uniqueClasses: number;
    averageConfidence: number;
  };
}

export class LangExtractService {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    // Try to find Python installation
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.scriptPath = path.join(process.cwd(), 'scripts', 'langextract_runner.py');
  }

  async initialize() {
    // Ensure the Python script exists
    await this.ensurePythonScript();
    
    // Install langextract if not available
    await this.ensureLangExtractInstalled();
  }

  private async ensurePythonScript() {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    
    try {
      await fs.access(scriptsDir);
    } catch {
      await fs.mkdir(scriptsDir, { recursive: true });
    }

    const pythonScript = `
import json
import sys
import os
from typing import Dict, List, Any
import argparse

try:
    import langextract as lx
except ImportError:
    print(json.dumps({"error": "langextract not installed. Please install with: pip install langextract"}))
    sys.exit(1)

def run_extraction(config: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Prepare examples
        examples = []
        for example in config["examples"]:
            extractions = []
            for ext in example["extractions"]:
                extractions.append(lx.data.Extraction(
                    extraction_class=ext["extraction_class"],
                    extraction_text=ext["extraction_text"],
                    attributes=ext["attributes"]
                ))
            examples.append(lx.data.ExampleData(
                text=example["text"],
                extractions=extractions
            ))

        # Get API key from environment or config
        api_key = config.get("api_key") or os.getenv("GOOGLE_API_KEY") or os.getenv("LANGEXTRACT_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        
        # Suppress progress output
        import io
        import contextlib
        
        # Capture stdout to suppress progress messages
        with contextlib.redirect_stdout(io.StringIO()):
            # Run extraction
            result = lx.extract(
                text_or_documents=config["text"],
                prompt_description=config["prompt_description"],
                examples=examples,
                model_id=config["model_id"],
                extraction_passes=config.get("extraction_passes", 1),
                max_workers=config.get("max_workers", 5),
                api_key=api_key
            )

        # Process results
        extractions = []
        if hasattr(result, 'extractions'):
            for extraction in result.extractions:
                extractions.append({
                    "extraction_class": extraction.extraction_class,
                    "extraction_text": extraction.extraction_text,
                    "attributes": extraction.attributes,
                    "position_start": getattr(extraction, 'position_start', None),
                    "position_end": getattr(extraction, 'position_end', None),
                    "confidence": getattr(extraction, 'confidence', None)
                })

        # Calculate metadata
        unique_classes = len(set(ext["extraction_class"] for ext in extractions))
        confidences = [ext.get("confidence", 1.0) for ext in extractions if ext.get("confidence") is not None]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return {
            "success": True,
            "extractions": extractions,
            "metadata": {
                "total_extractions": len(extractions),
                "unique_classes": unique_classes,
                "average_confidence": avg_confidence
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="JSON config file path")
    args = parser.parse_args()

    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
        
        result = run_extraction(config)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
`;

    await fs.writeFile(this.scriptPath, pythonScript);
  }

  private async ensureLangExtractInstalled(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, ['-c', 'import langextract; print("OK")']);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Try to install langextract
          const installProcess = spawn(this.pythonPath, ['-m', 'pip', 'install', 'langextract']);
          
          installProcess.on('close', (installCode) => {
            if (installCode === 0) {
              resolve();
            } else {
              reject(new Error('Failed to install langextract. Please install it manually: pip install langextract'));
            }
          });
        }
      });
    });
  }

  async extract(config: LangExtractConfig): Promise<LangExtractResponse> {
    const startTime = Date.now();
    
    // Create temporary config file
    const configPath = path.join(process.cwd(), 'temp', `config_${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Run Python script
      const result = await this.runPythonScript(configPath);
      
      const processingTime = Date.now() - startTime;
      
      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      return {
        extractions: result.extractions || [],
        processingTime,
        metadata: {
          totalExtractions: result.metadata?.total_extractions || 0,
          uniqueClasses: result.metadata?.unique_classes || 0,
          averageConfidence: result.metadata?.average_confidence || 0,
        }
      };

    } finally {
      // Clean up temp file
      try {
        await fs.unlink(configPath);
      } catch (error) {
        console.warn('Failed to clean up temp config file:', error);
      }
    }
  }

  private async runPythonScript(configPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [this.scriptPath, '--config', configPath]);
      
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python script output: ${stdout}\nError: ${error}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  async generateVisualization(jobId: string, extractions: ExtractionResult[], originalText: string): Promise<string> {
    // Generate interactive HTML visualization
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LangExtract Results - Job ${jobId}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .highlight { background: linear-gradient(120deg, #fef3c7 0%, #fcd34d 100%); padding: 2px 4px; border-radius: 4px; border-left: 3px solid #f59e0b; }
        .highlight:hover { transform: scale(1.05); transition: transform 0.2s; }
    </style>
</head>
<body class="bg-gray-50 p-8">
    <div class="max-w-6xl mx-auto">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">LangExtract Results</h1>
            <p class="text-gray-600">Interactive visualization of extracted entities</p>
        </header>
        
        <div class="grid lg:grid-cols-2 gap-8">
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-semibold mb-4">Source Text</h2>
                <div class="bg-gray-50 rounded p-4 font-mono text-sm leading-relaxed" id="sourceText">
                    ${this.highlightText(originalText, extractions)}
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-semibold mb-4">Extracted Entities</h2>
                <div class="space-y-4" id="entitiesList">
                    ${extractions.map((ext, index) => `
                        <div class="border rounded p-3 hover:bg-gray-50" data-entity="${index}">
                            <div class="flex items-center space-x-2 mb-2">
                                <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                    ${ext.extraction_class}
                                </span>
                            </div>
                            <div class="font-medium text-gray-900 mb-1">${ext.extraction_text}</div>
                            <div class="text-sm text-gray-600">
                                ${Object.entries(ext.attributes).map(([key, value]) => 
                                    `<strong>${key}:</strong> ${value}`
                                ).join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Interactive highlighting
        document.querySelectorAll('[data-entity]').forEach((el, index) => {
            el.addEventListener('mouseenter', () => {
                document.querySelectorAll('.highlight')[index]?.classList.add('bg-yellow-300');
            });
            el.addEventListener('mouseleave', () => {
                document.querySelectorAll('.highlight')[index]?.classList.remove('bg-yellow-300');
            });
        });
    </script>
</body>
</html>`;

    return html;
  }

  private highlightText(text: string, extractions: ExtractionResult[]): string {
    let highlightedText = text;
    
    // Sort extractions by position to avoid overlap issues
    const sortedExtractions = [...extractions].sort((a, b) => 
      (b.position_start || 0) - (a.position_start || 0)
    );

    sortedExtractions.forEach((extraction, index) => {
      if (extraction.position_start !== undefined && extraction.position_end !== undefined) {
        const before = highlightedText.slice(0, extraction.position_start);
        const highlighted = `<span class="highlight" data-entity="${index}">${extraction.extraction_text}</span>`;
        const after = highlightedText.slice(extraction.position_end);
        highlightedText = before + highlighted + after;
      } else {
        // Fallback: simple text replacement
        highlightedText = highlightedText.replace(
          extraction.extraction_text,
          `<span class="highlight" data-entity="${index}">${extraction.extraction_text}</span>`
        );
      }
    });

    return highlightedText;
  }
}
