import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExtractionForm } from "@/components/extraction-form";
import { ResultsPanel } from "@/components/results-panel";
import { ProcessingStatus } from "@/components/processing-status";
import { UseCasesHeader } from "@/components/use-cases-header";
import { Brain, CheckCircle, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractionJob } from "@shared/schema";

export default function Home() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery<ExtractionJob[]>({
    queryKey: ['/api/extractions'],
    refetchInterval: 2000, // Poll for updates
  });

  const activeJob = jobs.find(job => job.id === activeJobId);

  const handleJobCreated = (job: ExtractionJob) => {
    setActiveJobId(job.id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 glass-effect">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center glow-primary">
                <Brain className="text-white w-4 h-4 animate-bounce-subtle" />
              </div>
              <h1 className="text-xl font-bold text-gradient">LangExtract</h1>
              <span className="text-xs bg-primary/15 text-primary px-3 py-1 rounded-full font-semibold animate-pulse-slow">Platform</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Extract Structured Data from{" "}
            <span className="text-gradient">
              Any File or URL
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto mb-10 leading-relaxed">
            Upload documents (PDF, Word, Excel, PowerPoint, etc.) or paste URLs for AI-powered extraction.
            Support for Gemini and OpenAI with comprehensive file processing and web scraping via FireCrawl.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-base text-gray-600">
            <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border card-hover">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
              All File Formats
            </div>
            <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border card-hover">
              <CheckCircle className="w-5 h-5 text-blue-500 mr-3" />
              AI Web Scraping
            </div>
            <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border card-hover">
              <CheckCircle className="w-5 h-5 text-purple-500 mr-3" />
              Source Grounding
            </div>
            <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border card-hover">
              <CheckCircle className="w-5 h-5 text-orange-500 mr-3" />
              Visual Extraction
            </div>
          </div>
        </div>

        {/* Use Cases Section */}
        <UseCasesHeader />

        {/* Main Application Grid */}
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-5">
            <ExtractionForm onJobCreated={handleJobCreated} />
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-6">
            {activeJob?.status === "processing" && (
              <ProcessingStatus jobId={activeJob.id} />
            )}
            
            {activeJob && (
              <ResultsPanel job={activeJob} />
            )}

            {!activeJob && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center card-hover animate-slide-up">
                <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center mx-auto mb-6 glow-primary">
                  <Brain className="w-10 h-10 text-white animate-bounce-subtle" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Extract</h3>
                <p className="text-lg text-gray-600 mb-8">
                  Configure your extraction task on the left to see results here.
                </p>
                <div className="text-base text-gray-500 bg-gray-50 rounded-lg p-4 border-l-4 border-primary">
                  Start by entering your text, selecting a model, and defining your extraction prompt.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Brain className="text-white w-4 h-4" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">LangExtract Platform</h3>
              </div>
              <p className="text-gray-600 mb-4 max-w-md">
                Professional-grade AI-powered text extraction platform supporting multiple LLM providers
                with precise source grounding and interactive visualizations.
              </p>
              <div className="flex space-x-4">
                <a href="https://github.com/google/langextract" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="https://github.com/google/langextract" className="hover:text-gray-900 transition-colors">Documentation</a></li>
                <li><a href="https://github.com/google/langextract#api-key-setup-for-cloud-models" className="hover:text-gray-900 transition-colors">API Reference</a></li>
                <li><a href="https://github.com/google/langextract/tree/main/examples" className="hover:text-gray-900 transition-colors">Examples</a></li>
                <li><a href="https://github.com/google/langextract#quick-start" className="hover:text-gray-900 transition-colors">Tutorials</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="https://github.com/google/langextract/discussions" className="hover:text-gray-900 transition-colors">Community</a></li>
                <li><a href="https://github.com/google/langextract/issues" className="hover:text-gray-900 transition-colors">Issues</a></li>
                <li><a href="https://github.com/google/langextract/blob/main/CONTRIBUTING.md" className="hover:text-gray-900 transition-colors">Contributing</a></li>
                <li><a href="https://github.com/google/langextract/security" className="hover:text-gray-900 transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              © 2025 Google LLC. Licensed under Apache License 2.0.
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-sm text-gray-400">Powered by</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-primary">Gemini</span>
                <span className="text-gray-300">•</span>
                <span className="text-sm font-medium text-green-600">OpenAI</span>
                <span className="text-gray-300">•</span>
                <span className="text-sm font-medium text-orange-600">Ollama</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
