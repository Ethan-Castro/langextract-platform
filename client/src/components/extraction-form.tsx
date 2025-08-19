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
      inputText: "Lady Juliet gazed longingly at the stars, her heart aching for Romeo. The moonlight cast a silver glow across her face as she whispered his name into the night.",
      promptDescription: "Extract characters, emotions, and relationships in order of appearance. Use exact text for extractions. Do not paraphrase or overlap entities. Provide meaningful attributes for each entity to add context.",
      examples: [{
        text: "ROMEO. But soft! What light through yonder window breaks? It is the east, and Juliet is the sun.",
        extractions: [
          {
            extraction_class: "character",
            extraction_text: "ROMEO",
            attributes: { emotional_state: "wonder" }
          },
          {
            extraction_class: "emotion",
            extraction_text: "But soft!",
            attributes: { feeling: "gentle awe" }
          },
          {
            extraction_class: "relationship",
            extraction_text: "Juliet is the sun",
            attributes: { type: "metaphor" }
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

    // Validate file type
    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .txt, .pdf, or .docx file",
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
        description: `Extracted ${result.text.length} characters from ${file.name}`,
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
      
      toast({
        title: "Content fetched successfully",
        description: `Extracted ${result.text.length} characters from URL`,
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
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="text-primary mr-2 w-5 h-5" />
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
                      accept=".txt,.pdf,.docx"
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
                          <p className="text-sm text-gray-400">Supports .txt, .pdf, .docx files up to 10MB</p>
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
                        placeholder="https://www.example.com/document.txt"
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
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Bot className="text-secondary mr-2 w-5 h-5" />
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
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ListTodo className="text-accent mr-2 w-5 h-5" />
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
              className="flex-1 bg-primary text-white hover:bg-primary/90"
              disabled={createJobMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {createJobMutation.isPending ? "Starting..." : "Start Extraction"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={createJobMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
