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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inputText: "Dr. Sarah Chen, the lead researcher at Stanford University, published groundbreaking findings on AI safety in Nature journal. The study involved 500 participants and took place from 2023 to 2024. Her team discovered critical vulnerabilities that could affect millions of users globally.",
      promptDescription: "Extract people, organizations, locations, dates, numbers, and research findings. Focus on factual information with specific attributes like roles, affiliations, and quantitative data.",
      examples: [{
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
      }],
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
                        <FormLabel>Extraction Passes</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={5}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxWorkers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Workers</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={20}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                          />
                        </FormControl>
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
                  <div className="flex items-center justify-between mb-2">
                    <Label>Example Data</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addExample}
                      className="text-primary hover:text-primary/80"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Example
                    </Button>
                  </div>

                  {form.watch("examples").map((_, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
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
