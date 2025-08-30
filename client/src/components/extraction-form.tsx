import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { insertExtractionJobSchema, type ExtractionJob } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileText, Upload, Link, Bot, ListTodo, Play, RotateCcw, Plus, X, Loader2, Download } from "lucide-react";

const formSchema = insertExtractionJobSchema;

type FormData = z.infer<typeof formSchema>;

interface ExtractionFormProps {
  onJobCreated: (job: ExtractionJob) => void;
}

export function ExtractionForm({ onJobCreated }: ExtractionFormProps) {
  const [inputType, setInputType] = useState<"text" | "file" | "url">("file");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [useExamples, setUseExamples] = useState(false);
  const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);
  const [generatingExampleIndex, setGeneratingExampleIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inputText: "Dr. Sarah Chen, the lead researcher at Stanford University, published groundbreaking findings on AI safety in Nature journal. The study involved 500 participants and took place from 2023 to 2024. Her team discovered critical vulnerabilities that could affect millions of users globally.",
      promptDescription: "Extract people, organizations, locations, dates, numbers, and research findings. Focus on factual information with specific attributes like roles, affiliations, and quantitative data.",
      examples: [],
      modelId: "gemini-2.5-flash",
      extractionPasses: 1,
      maxWorkers: 5,
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: FormData): Promise<ExtractionJob> => {
      const response = await apiRequest("POST", "/api/extractions", data);
      return response.json();
    },
    onSuccess: (job) => {
      toast({
        title: "Extraction Started",
        description: "Your text extraction job has been queued for processing.",
      });
      onJobCreated(job);
      queryClient.invalidateQueries({ queryKey: ['/api/extractions'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Start Extraction",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createJobMutation.mutate(data);
  };

  const resetForm = () => {
    form.reset();
    setUploadedFile(null);
    setUrlInput("");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Enhanced file type validation for comprehensive support
    const allowedExtensions = ['.txt', '.docx', '.pdf', '.xlsx', '.xls', '.pptx', '.ppt', '.html', '.htm', '.json', '.csv', '.md'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast({
        title: "Unsupported file type",
        description: `Please upload one of: ${allowedExtensions.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingFile(true);
    setUploadedFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process file');
      }

      const result = await response.json();
      form.setValue('inputText', result.text);
      
      toast({
        title: "File uploaded successfully",
        description: `Extracted ${result.extractedLength?.toLocaleString() || result.text.length.toLocaleString()} characters from ${file.name}${result.fallbackExtraction ? ' (basic extraction)' : ''}`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process the uploaded file",
        variant: "destructive",
      });
      setUploadedFile(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!urlInput) {
      toast({
        title: "URL required",
        description: "Please enter a URL to fetch content from",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingUrl(true);

    try {
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch URL content');
      }

      const result = await response.json();
      form.setValue('inputText', result.text);
      
      const methodDescription = result.method === 'firecrawl' ? 'via FireCrawl AI' : 
                               result.method === 'firecrawl-html' ? 'via FireCrawl HTML' : 
                               'via basic scraping';
      
      toast({
        title: "Content fetched successfully",
        description: `Extracted ${result.length?.toLocaleString() || result.text.length.toLocaleString()} characters ${methodDescription}`,
      });
    } catch (error) {
      toast({
        title: "Fetch failed",
        description: "Failed to fetch content from the URL",
        variant: "destructive",
      });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const addExample = () => {
    const currentExamples = form.getValues("examples");
    form.setValue("examples", [
      ...currentExamples,
      {
        text: "",
        extractions: []
      }
    ]);
  };

  const removeExample = (index: number) => {
    const currentExamples = form.getValues("examples");
    form.setValue("examples", currentExamples.filter((_, i) => i !== index));
  };

  const generateExamples = async () => {
    const promptDescription = form.getValues("promptDescription");
    if (!promptDescription.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a prompt description before generating examples.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingExamples(true);
    try {
      const response = await fetch("/api/generate-examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptDescription,
          count: 2
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate examples");
      }

      const result = await response.json();
      
      // Add generated examples to the form
      const currentExamples = form.getValues("examples");
      const newExamples = [...currentExamples, ...result.examples];
      form.setValue("examples", newExamples);
      
      // Enable examples if not already enabled
      if (!useExamples) {
        setUseExamples(true);
      }

      toast({
        title: "Examples Generated!",
        description: `Successfully generated ${result.generated} example${result.generated > 1 ? 's' : ''} using AI.`,
      });
    } catch (error) {
      console.error("Failed to generate examples:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate examples. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingExamples(false);
    }
  };

  const generateSingleExample = async (index: number) => {
    const promptDescription = form.getValues("promptDescription");
    if (!promptDescription.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a prompt description before generating examples.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingExampleIndex(index);
    try {
      const response = await fetch("/api/generate-examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptDescription,
          count: 1
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate example");
      }

      const result = await response.json();
      
      if (result.examples && result.examples.length > 0) {
        // Replace the example at the specific index
        const currentExamples = form.getValues("examples");
        const updatedExamples = [...currentExamples];
        updatedExamples[index] = result.examples[0];
        form.setValue("examples", updatedExamples);

        toast({
          title: "Example Generated!",
          description: "Successfully generated a new example using AI.",
        });
      }
    } catch (error) {
      console.error("Failed to generate example:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate example. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingExampleIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Input Source Card */}
          <Card className="card-hover animate-slide-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center mr-3">
                    <FileText className="text-white w-4 h-4" />
                  </div>
                  Input Source
                </h3>
              </div>

              <Tabs value={inputType} onValueChange={(value: any) => setInputType(value)} className="mb-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Text Input
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    File Upload
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    URL
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="text">
                  <FormField
                    control={form.control}
                    name="inputText"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Textarea
                              {...field}
                              placeholder="Paste your text here..."
                              className="min-h-32 resize-none"
                            />
                            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                              {field.value?.length || 0} characters
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="file">
                  <div className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.docx,.pdf,.xlsx,.xls,.pptx,.ppt,.html,.htm,.json,.csv,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                    >
                      {isProcessingFile ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                          <p className="text-gray-600">Processing file...</p>
                        </div>
                      ) : uploadedFile ? (
                        <div className="flex flex-col items-center">
                          <FileText className="w-12 h-12 text-primary mb-4" />
                          <p className="text-gray-900 font-medium mb-2">{uploadedFile.name}</p>
                          <p className="text-sm text-gray-500 mb-4">
                            {(uploadedFile.size / 1024).toFixed(1)} KB
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                            >
                              Replace File
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedFile(null);
                                form.setValue('inputText', '');
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-2">Drag and drop files here, or click to select</p>
                          <p className="text-sm text-gray-400">Supports TXT, DOCX, PDF, Excel, PowerPoint, HTML, JSON, CSV, Markdown up to 10MB</p>
                          <Button type="button" className="mt-4" variant="outline">
                            Choose Files
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="url">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/article or document URL (AI-powered scraping)"
                        type="url"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUrlFetch();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleUrlFetch}
                        disabled={isFetchingUrl || !urlInput}
                      >
                        {isFetchingUrl ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Fetch'
                        )}
                      </Button>
                    </div>
                    {isFetchingUrl && (
                      <p className="text-sm text-gray-500 text-center">Fetching content from URL...</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Model Configuration Card */}
          <Card className="card-hover animate-slide-up">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center mr-3">
                  <Bot className="text-white w-4 h-4" />
                </div>
                Model Configuration
              </h3>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="modelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Model</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</SelectItem>
                          <SelectItem value="gemini-2.5-pro">gemini-2.5-pro</SelectItem>
                          <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                          <SelectItem value="gemma2:2b">gemma2:2b (Local)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="extractionPasses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Extraction Passes
                          <div className="group relative">
                            <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50">
                              Number of times to run extraction on the same text. Multiple passes can improve accuracy by refining results, especially for complex documents. 1-2 passes are usually sufficient.
                            </div>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={5}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                            placeholder="1"
                          />
                        </FormControl>
                        <div className="text-xs text-gray-500">
                          Run extraction multiple times to improve accuracy (1-5)
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxWorkers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Max Workers
                          <div className="group relative">
                            <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50">
                              Number of parallel workers for processing large documents. Higher values process faster but use more API calls. 5-10 works well for most documents.
                            </div>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={20}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                            placeholder="5"
                          />
                        </FormControl>
                        <div className="text-xs text-gray-500">
                          Parallel processing for large texts (1-20)
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>


              </div>
            </CardContent>
          </Card>

          {/* Extraction Task Configuration */}
          <Card className="card-hover animate-slide-up">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3">
                  <ListTodo className="text-white w-4 h-4" />
                </div>
                Extraction Task
              </h3>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="promptDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe what you want to extract..."
                          className="min-h-24 resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Example Data Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Label>Example Data</Label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="useExamples"
                          checked={useExamples}
                          onChange={(e) => {
                            setUseExamples(e.target.checked);
                            if (!e.target.checked) {
                              form.setValue("examples", []);
                            } else if (form.getValues("examples").length === 0) {
                              // Add default example when enabling
                              form.setValue("examples", [{
                                text: "Dr. John Smith from MIT published a paper in Science journal about quantum computing breakthroughs in December 2023.",
                                extractions: [
                                  {
                                    extraction_class: "person",
                                    extraction_text: "Dr. John Smith",
                                    attributes: { title: "Dr.", role: "researcher", affiliation: "MIT" }
                                  },
                                  {
                                    extraction_class: "organization",
                                    extraction_text: "MIT",
                                    attributes: { type: "university", field: "technology" }
                                  },
                                  {
                                    extraction_class: "publication",
                                    extraction_text: "Science journal",
                                    attributes: { type: "academic_journal", prestige: "high" }
                                  },
                                  {
                                    extraction_class: "research_topic",
                                    extraction_text: "quantum computing breakthroughs",
                                    attributes: { field: "computer_science", significance: "breakthrough" }
                                  },
                                  {
                                    extraction_class: "date",
                                    extraction_text: "December 2023",
                                    attributes: { granularity: "month", type: "publication_date" }
                                  }
                                ]
                              }]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="useExamples" className="text-sm text-gray-600 cursor-pointer">
                          Provide example data to improve accuracy (optional)
                        </label>
                      </div>
                    </div>
                    {useExamples && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateExamples}
                          disabled={isGeneratingExamples}
                          className="text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
                        >
                          {isGeneratingExamples ? (
                            <>
                              <div className="w-4 h-4 mr-1 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600"></div>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Generate with AI
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addExample}
                          className="text-primary hover:text-primary/80"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Manual
                        </Button>
                      </div>
                    )}
                  </div>

                  {useExamples && form.watch("examples").map((_, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Example {index + 1}</h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => generateSingleExample(index)}
                            disabled={generatingExampleIndex === index}
                            className="text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
                          >
                            {generatingExampleIndex === index ? (
                              <>
                                <div className="w-3 h-3 mr-1 animate-spin rounded-full border border-purple-300 border-t-purple-600"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                Generate AI
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExample(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <FormField
                        control={form.control}
                        name={`examples.${index}.text`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-gray-600">Example Text</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                className="text-sm min-h-16 resize-none bg-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`examples.${index}.extractions`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-gray-600">Extractions (JSON)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={JSON.stringify(field.value, null, 2)}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(e.target.value);
                                    field.onChange(parsed);
                                  } catch {
                                    // Invalid JSON, keep the text value
                                  }
                                }}
                                className="text-sm font-mono min-h-24 resize-none bg-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}

                  {useExamples && form.watch("examples").length === 0 && (
                    <div className="text-center py-8 bg-gradient-to-br from-purple-50 to-cyan-50 border border-dashed border-purple-200 rounded-lg">
                      <div className="mb-4">
                        <svg className="w-12 h-12 mx-auto text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <p className="text-gray-600 mb-1 font-medium">No examples added yet</p>
                        <p className="text-sm text-gray-500">Generate AI examples or add manual ones to improve extraction accuracy</p>
                      </div>
                      <div className="flex justify-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateExamples}
                          disabled={isGeneratingExamples}
                          className="text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
                        >
                          {isGeneratingExamples ? (
                            <>
                              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600"></div>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Generate with AI
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addExample}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Manual Example
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button
              type="submit"
              className="flex-1 gradient-primary text-white hover:scale-105 transition-all duration-200 glow-primary text-lg py-6 font-semibold"
              disabled={createJobMutation.isPending}
            >
              <Play className="w-5 h-5 mr-2" />
              {createJobMutation.isPending ? "Starting..." : "Start Extraction"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={createJobMutation.isPending}
              className="card-hover py-6 text-lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
