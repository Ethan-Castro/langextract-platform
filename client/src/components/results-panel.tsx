import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type ExtractionJob, type ExtractionResult } from "@shared/schema";
import { BarChart3, Download, Table, Eye, EyeOff, ExternalLink, Search } from "lucide-react";

interface ResultsPanelProps {
  job: ExtractionJob;
}

export function ResultsPanel({ job }: ResultsPanelProps) {
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all");
  const [highlightsVisible, setHighlightsVisible] = useState(true);

  if (job.status === "pending" || job.status === "processing") {
    return null;
  }

  if (job.status === "failed") {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Extraction Failed</h3>
            <p className="text-red-600 mb-4">
              {(job.results as any)?.error || "An unknown error occurred during extraction."}
            </p>
            <p className="text-sm text-gray-600">
              Please check your input text, API key, and model configuration.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const results = job.results as any;
  const extractions: ExtractionResult[] = results?.extractions || [];
  const metadata = results?.metadata || {};

  // Group extractions by type
  const entityTypes = Array.from(new Set(extractions.map(e => e.extraction_class)));
  const filteredExtractions = selectedEntityType === "all" 
    ? extractions 
    : extractions.filter(e => e.extraction_class === selectedEntityType);

  const handleExport = async (format: "json" | "csv" | "pdf") => {
    try {
      const response = await fetch(`/api/extractions/${job.id}/export?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extraction_${job.id}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
    }
  };

  const handleVisualize = () => {
    window.open(`/api/extractions/${job.id}/visualization`, '_blank');
  };

  const highlightText = (text: string, extractions: ExtractionResult[]) => {
    if (!highlightsVisible) return text;

    let highlightedText = text;
    const sortedExtractions = [...extractions].sort((a, b) => 
      (b.position_start || text.indexOf(b.extraction_text)) - (a.position_start || text.indexOf(a.extraction_text))
    );

    sortedExtractions.forEach((extraction, index) => {
      const startPos = extraction.position_start ?? text.indexOf(extraction.extraction_text);
      if (startPos !== -1) {
        const beforeText = highlightedText.slice(0, startPos);
        const afterText = highlightedText.slice(startPos + extraction.extraction_text.length);
        highlightedText = beforeText + 
          `<span class="bg-gradient-to-r from-yellow-200 to-yellow-300 px-1 py-0.5 rounded border-l-2 border-yellow-500 hover:scale-105 transition-transform cursor-pointer" data-entity="${index}">${extraction.extraction_text}</span>` + 
          afterText;
      }
    });

    return highlightedText;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Results Summary Card */}
      <Card className="card-hover">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center mr-4">
                <BarChart3 className="text-white w-5 h-5" />
              </div>
              Extraction Results
            </h3>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
              >
                <Download className="w-4 h-4 mr-1" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
              >
                <Table className="w-4 h-4 mr-1" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
              >
                <Download className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVisualize}
              >
                <Eye className="w-4 h-4 mr-1" />
                Visualize
              </Button>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-l-4 border-blue-500 card-hover">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {metadata.totalExtractions || extractions.length}
              </div>
              <div className="text-sm font-semibold text-blue-800">Total Extractions</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-l-4 border-green-500 card-hover">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {metadata.uniqueClasses || entityTypes.length}
              </div>
              <div className="text-sm font-semibold text-green-800">Entity Types</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-l-4 border-purple-500 card-hover">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {results?.processingTime ? `${(results.processingTime / 1000).toFixed(1)}s` : 'N/A'}
              </div>
              <div className="text-sm font-semibold text-purple-800">Processing Time</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border-l-4 border-amber-500 card-hover">
              <div className="text-3xl font-bold text-amber-600 mb-2">
                {metadata.averageConfidence ? `${(metadata.averageConfidence * 100).toFixed(0)}%` : 'N/A'}
              </div>
              <div className="text-sm font-semibold text-amber-800">Avg. Confidence</div>
            </div>
          </div>

          {/* Extracted Entities */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Extracted Entities</h4>
            
            {/* Entity Type Filter */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedEntityType === "all" ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => setSelectedEntityType("all")}
              >
                All ({extractions.length})
              </Badge>
              {entityTypes.map(type => {
                const count = extractions.filter(e => e.extraction_class === type).length;
                return (
                  <Badge
                    key={type}
                    variant={selectedEntityType === type ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => setSelectedEntityType(type)}
                  >
                    {type} ({count})
                  </Badge>
                );
              })}
            </div>

            {/* Entities List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredExtractions.map((extraction, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline">{extraction.extraction_class}</Badge>
                        {extraction.position_start !== undefined && (
                          <span className="text-sm text-gray-500">
                            Position: {extraction.position_start}-{extraction.position_end}
                          </span>
                        )}
                        {extraction.confidence && (
                          <span className="text-sm text-gray-500">
                            Confidence: {(extraction.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 mb-1">
                        {extraction.extraction_text}
                      </div>
                      {extraction.attributes && Object.keys(extraction.attributes).length > 0 && (
                        <div className="text-xs text-gray-500">
                          <strong>Attributes:</strong>{" "}
                          {Object.entries(extraction.attributes)
                            .map(([key, value]) => `${key}: "${value}"`)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source Text with Highlighting */}
      <Card className="card-hover">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center mr-4">
                <Search className="text-white w-5 h-5" />
              </div>
              Source Text with Highlights
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHighlightsVisible(!highlightsVisible)}
            >
              {highlightsVisible ? (
                <>
                  <EyeOff className="w-4 h-4 mr-1" />
                  Hide Highlights
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Show Highlights
                </>
              )}
            </Button>
          </div>
          
          <div
            className="bg-gray-50 rounded-lg p-4 font-mono text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: highlightText(job.inputText, extractions)
            }}
          />
        </CardContent>
      </Card>

      {/* Interactive Visualization Preview */}
      <Card className="card-hover">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center">
              <div className="w-10 h-10 gradient-accent rounded-lg flex items-center justify-center mr-4">
                <BarChart3 className="text-white w-5 h-5" />
              </div>
              Interactive Visualization
            </h3>
            <Button onClick={handleVisualize} className="gradient-accent text-white hover:scale-105 transition-all duration-200 glow-primary py-3 px-6 text-lg font-semibold">
              <ExternalLink className="w-5 h-5 mr-2" />
              Open Full Visualization
            </Button>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl p-12 text-center border-2 border-dashed border-purple-300 card-hover">
            <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center mx-auto mb-6 glow-primary">
              <BarChart3 className="w-10 h-10 text-white animate-bounce-subtle" />
            </div>
            <p className="text-xl text-gray-700 mb-6 font-semibold">Interactive HTML visualization available</p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Click "Open Full Visualization" to see the detailed interactive view with entity highlighting,
              relationship graphs, and detailed analytics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
