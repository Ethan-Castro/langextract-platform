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
    // Calculate statistics for enhanced visualization
    const entityTypeCounts = extractions.reduce((acc, ext) => {
      acc[ext.extraction_class] = (acc[ext.extraction_class] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgConfidence = extractions.length > 0 
      ? extractions.filter(e => e.confidence).reduce((sum, e) => sum + (e.confidence || 0), 0) / extractions.filter(e => e.confidence).length
      : 0;
    
    const uniqueEntityTypes = Object.keys(entityTypeCounts);
    const highConfidenceEntities = extractions.filter(e => e.confidence && e.confidence > 0.8).length;
    
    // Generate enhanced interactive HTML visualization
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LangExtract Results - Job ${jobId}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        
        .highlight { 
            background: linear-gradient(120deg, #fef3c7 0%, #fcd34d 100%); 
            padding: 3px 6px; 
            border-radius: 6px; 
            border-left: 3px solid #f59e0b; 
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .highlight:hover { 
            transform: translateY(-1px) scale(1.02); 
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            background: linear-gradient(120deg, #fde68a 0%, #f59e0b 100%);
            color: white;
        }
        
        .highlight.active {
            background: linear-gradient(120deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border-left-color: #1d4ed8;
        }
        
        .entity-card {
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .entity-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .entity-card.active {
            border-color: #3b82f6;
            box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
        }
        
        .fade-in { animation: fadeIn 0.5s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .slide-in { animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: transform 0.3s ease;
        }
        
        .stat-card:hover {
            transform: scale(1.05);
        }
        
        .search-highlight {
            background: linear-gradient(120deg, #ef4444 0%, #dc2626 100%);
            color: white;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
        }
        
        .filter-button {
            transition: all 0.2s ease;
        }
        
        .filter-button.active {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            transform: scale(1.05);
        }
        
        .tooltip {
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .confidence-bar {
            height: 4px;
            border-radius: 2px;
            background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%);
        }
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 min-h-screen" x-data="extractionApp()">
    <div class="max-w-7xl mx-auto p-6">
        <!-- Header -->
        <header class="mb-8 text-center fade-in">
            <div class="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                    🧠 LangExtract Results
                </h1>
                <p class="text-gray-600 text-lg">Interactive visualization of extracted entities</p>
                <div class="mt-4 text-sm text-gray-500">Job ID: ${jobId}</div>
            </div>
        </header>

        <!-- Statistics Dashboard -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 fade-in">
            <div class="stat-card text-white rounded-xl p-6 text-center">
                <div class="text-3xl font-bold">${extractions.length}</div>
                <div class="text-sm opacity-90">Total Extractions</div>
            </div>
            <div class="stat-card text-white rounded-xl p-6 text-center">
                <div class="text-3xl font-bold">${uniqueEntityTypes.length}</div>
                <div class="text-sm opacity-90">Entity Types</div>
            </div>
            <div class="stat-card text-white rounded-xl p-6 text-center">
                <div class="text-3xl font-bold">${highConfidenceEntities}</div>
                <div class="text-sm opacity-90">High Confidence</div>
            </div>
            <div class="stat-card text-white rounded-xl p-6 text-center">
                <div class="text-3xl font-bold">${avgConfidence > 0 ? (avgConfidence * 100).toFixed(0) + '%' : 'N/A'}</div>
                <div class="text-sm opacity-90">Avg Confidence</div>
            </div>
        </div>

        <!-- Controls -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8 slide-in">
            <div class="flex flex-wrap gap-4 items-center justify-between">
                <div class="flex flex-wrap gap-2">
                    <button class="filter-button px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                            :class="{ 'active': activeFilter === 'all' }"
                            @click="setFilter('all')">
                        All Entities (${extractions.length})
                    </button>
                    ${uniqueEntityTypes.map(type => `
                        <button class="filter-button px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                                :class="{ 'active': activeFilter === '${type}' }"
                                @click="setFilter('${type}')">
                            ${type} (${entityTypeCounts[type]})
                        </button>
                    `).join('')}
                </div>
                <div class="flex gap-4 items-center">
                    <input type="text" 
                           placeholder="Search entities..." 
                           class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                           x-model="searchTerm"
                           @input="performSearch">
                    <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            @click="clearHighlights">
                        Clear Highlights
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid lg:grid-cols-3 gap-8">
            <!-- Source Text Panel -->
            <div class="lg:col-span-2">
                <div class="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div class="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <h2 class="text-xl font-semibold mb-2">📄 Source Text with Highlights</h2>
                        <p class="text-blue-100 text-sm">Click on highlighted text to see entity details</p>
                    </div>
                    <div class="p-6">
                        <div class="bg-gray-50 rounded-xl p-6 font-mono text-sm leading-relaxed max-h-96 overflow-y-auto border" 
                             id="sourceText">
                            ${this.highlightText(originalText, extractions)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Entities and Charts Panel -->
            <div class="space-y-6">
                <!-- Entity Distribution Chart -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-lg font-semibold mb-4">📊 Entity Distribution</h3>
                    <div class="chart-container">
                        <canvas id="entityChart"></canvas>
                    </div>
                </div>

                <!-- Extracted Entities List -->
                <div class="bg-white rounded-xl shadow-lg">
                    <div class="p-6 bg-gradient-to-r from-green-600 to-blue-600 text-white">
                        <h2 class="text-xl font-semibold">🎯 Extracted Entities</h2>
                        <div class="text-green-100 text-sm mt-1" x-text="filteredEntities.length + ' entities shown'"></div>
                    </div>
                    <div class="p-6 max-h-96 overflow-y-auto">
                        <div class="space-y-3" id="entitiesList">
                            <template x-for="(entity, index) in filteredEntities" :key="index">
                                <div class="entity-card border rounded-xl p-4 hover:bg-gray-50 transition-all duration-300"
                                     :class="{ 'active': selectedEntity === index }"
                                     :data-entity="index"
                                     @click="selectEntity(index)"
                                     @mouseenter="highlightEntity(index)"
                                     @mouseleave="unhighlightEntity(index)">
                                    <div class="flex items-center justify-between mb-3">
                                        <span class="px-3 py-1 text-xs font-semibold rounded-full"
                                              :class="getEntityTypeColor(entity.extraction_class)"
                                              x-text="entity.extraction_class"></span>
                                        <div class="flex items-center space-x-2" x-show="entity.confidence">
                                            <span class="text-xs text-gray-500">Confidence:</span>
                                            <span class="text-xs font-medium" x-text="Math.round(entity.confidence * 100) + '%'"></span>
                                            <div class="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div class="confidence-bar h-full transition-all duration-500"
                                                     :style="'width: ' + (entity.confidence * 100) + '%'"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="font-medium text-gray-900 mb-2" x-text="entity.extraction_text"></div>
                                    <div class="text-sm text-gray-600" x-show="entity.attributes && Object.keys(entity.attributes).length > 0">
                                        <template x-for="[key, value] in Object.entries(entity.attributes || {})" :key="key">
                                            <div class="inline-block mr-3 mb-1">
                                                <span class="font-medium" x-text="key + ':'"></span>
                                                <span x-text="value"></span>
                                            </div>
                                        </template>
                                    </div>
                                    <div class="text-xs text-gray-400 mt-2" x-show="!entity.attributes || Object.keys(entity.attributes).length === 0">
                                        No additional attributes
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tooltip -->
    <div id="tooltip" class="tooltip"></div>

    <script>
        const extractionsData = ${JSON.stringify(extractions)};
        const entityTypeCounts = ${JSON.stringify(entityTypeCounts)};
        
        function extractionApp() {
            return {
                entities: extractionsData,
                filteredEntities: extractionsData,
                activeFilter: 'all',
                selectedEntity: null,
                searchTerm: '',
                
                init() {
                    this.createChart();
                    this.setupTooltips();
                },
                
                setFilter(type) {
                    this.activeFilter = type;
                    if (type === 'all') {
                        this.filteredEntities = this.entities;
                    } else {
                        this.filteredEntities = this.entities.filter(e => e.extraction_class === type);
                    }
                    this.selectedEntity = null;
                },
                
                performSearch() {
                    if (!this.searchTerm) {
                        this.setFilter(this.activeFilter);
                        this.clearSearchHighlights();
                        return;
                    }
                    
                    const term = this.searchTerm.toLowerCase();
                    this.filteredEntities = this.entities.filter(e => 
                        e.extraction_text.toLowerCase().includes(term) ||
                        e.extraction_class.toLowerCase().includes(term) ||
                        (e.attributes && JSON.stringify(e.attributes).toLowerCase().includes(term))
                    );
                    
                    this.highlightSearchResults(term);
                },
                
                selectEntity(index) {
                    this.selectedEntity = index;
                    const entity = this.filteredEntities[index];
                    this.highlightTextInSource(entity.extraction_text);
                },
                
                highlightEntity(index) {
                    const highlights = document.querySelectorAll('.highlight');
                    highlights[index]?.classList.add('active');
                },
                
                unhighlightEntity(index) {
                    const highlights = document.querySelectorAll('.highlight');
                    highlights[index]?.classList.remove('active');
                },
                
                clearHighlights() {
                    document.querySelectorAll('.highlight').forEach(el => {
                        el.classList.remove('active', 'search-highlight');
                    });
                    this.selectedEntity = null;
                },
                
                clearSearchHighlights() {
                    document.querySelectorAll('.search-highlight').forEach(el => {
                        el.classList.remove('search-highlight');
                    });
                },
                
                highlightSearchResults(term) {
                    this.clearSearchHighlights();
                    const sourceText = document.getElementById('sourceText');
                    const highlights = sourceText.querySelectorAll('.highlight');
                    
                    highlights.forEach(highlight => {
                        if (highlight.textContent.toLowerCase().includes(term)) {
                            highlight.classList.add('search-highlight');
                        }
                    });
                },
                
                highlightTextInSource(text) {
                    this.clearHighlights();
                    const highlights = document.querySelectorAll('.highlight');
                    highlights.forEach(highlight => {
                        if (highlight.textContent === text) {
                            highlight.classList.add('active');
                            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    });
                },
                
                getEntityTypeColor(type) {
                    const colors = {
                        'person': 'bg-blue-100 text-blue-800',
                        'location': 'bg-green-100 text-green-800',
                        'organization': 'bg-purple-100 text-purple-800',
                        'date': 'bg-yellow-100 text-yellow-800',
                        'money': 'bg-red-100 text-red-800',
                        'product': 'bg-indigo-100 text-indigo-800'
                    };
                    return colors[type.toLowerCase()] || 'bg-gray-100 text-gray-800';
                },
                
                createChart() {
                    const ctx = document.getElementById('entityChart').getContext('2d');
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
                    
                    new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(entityTypeCounts),
                            datasets: [{
                                data: Object.values(entityTypeCounts),
                                backgroundColor: colors.slice(0, Object.keys(entityTypeCounts).length),
                                borderWidth: 2,
                                borderColor: '#ffffff'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 15
                                    }
                                }
                            },
                            animation: {
                                animateScale: true,
                                animateRotate: true
                            }
                        }
                    });
                },
                
                setupTooltips() {
                    const tooltip = document.getElementById('tooltip');
                    
                    document.querySelectorAll('.highlight').forEach((el, index) => {
                        el.addEventListener('mouseenter', (e) => {
                            const entity = extractionsData[index];
                            if (entity) {
                                tooltip.innerHTML = \`
                                    <div class="font-semibold">\${entity.extraction_class}</div>
                                    <div class="text-xs mt-1">\${entity.extraction_text}</div>
                                    \${entity.confidence ? \`<div class="text-xs mt-1">Confidence: \${Math.round(entity.confidence * 100)}%</div>\` : ''}
                                \`;
                                tooltip.style.left = e.pageX + 10 + 'px';
                                tooltip.style.top = e.pageY - 10 + 'px';
                                tooltip.style.opacity = '1';
                            }
                        });
                        
                        el.addEventListener('mouseleave', () => {
                            tooltip.style.opacity = '0';
                        });
                    });
                }
            }
        }
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
