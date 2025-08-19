import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { type ExtractionJob } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  jobId: string;
}

export function ProcessingStatus({ jobId }: ProcessingStatusProps) {
  const { data: job } = useQuery<ExtractionJob>({
    queryKey: ['/api/extractions', jobId],
    refetchInterval: 1000, // Poll every second for updates
  });

  if (!job || job.status !== "processing") {
    return null;
  }

  // Mock progress calculation based on time elapsed
  const startTime = job.createdAt ? new Date(job.createdAt).getTime() : Date.now();
  const elapsed = Date.now() - startTime;
  const estimatedTotal = 30000; // 30 seconds estimated
  const progress = Math.min((elapsed / estimatedTotal) * 100, 95);

  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `0:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Loader2 className="animate-spin text-primary mr-2 w-5 h-5" />
            Processing Document
          </h3>
          <span className="text-sm text-gray-500">
            {formatElapsedTime(elapsed)}
          </span>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="text-sm text-gray-600">
            Processing with {job.modelId}...
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>What's happening:</strong> Your text is being analyzed by the AI model to extract
              structured information according to your specifications. This may take a few moments
              depending on the text length and model selected.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
