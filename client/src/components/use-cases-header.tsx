import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, Heart, Building, DollarSign, MessageSquare, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UseCase {
  title: string;
  description: string;
  icon: React.ReactNode;
  example: string;
  prompt: string;
  color: string;
}

const useCases: UseCase[] = [
  {
    title: "Literature Analysis",
    description: "Extract characters, emotions, and relationships from literary texts",
    icon: <BookOpen className="w-5 h-5" />,
    example: "ROMEO. But soft! What light through yonder window breaks? It is the east, and Juliet is the sun.",
    prompt: "Extract characters, emotions, and relationships in order of appearance. Use exact text for extractions.",
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "Medical Information",
    description: "Process clinical notes to extract medications, dosages, and treatments",
    icon: <Heart className="w-5 h-5" />,
    example: "Patient prescribed Metformin 500mg twice daily and Lisinopril 10mg once daily for diabetes management.",
    prompt: "Extract medications, dosages, frequencies, and medical conditions with specific attributes.",
    color: "from-green-500 to-teal-500"
  },
  {
    title: "Legal Documents",
    description: "Extract entities, dates, and contractual relationships from legal texts",
    icon: <Building className="w-5 h-5" />,
    example: "The Agreement between ABC Corp and XYZ Ltd, effective January 1, 2024, establishes terms for service delivery.",
    prompt: "Extract parties, dates, contract types, and legal terms with their relationships.",
    color: "from-blue-500 to-indigo-500"
  },
  {
    title: "Financial Reports",
    description: "Process financial documents to extract numbers, entities, and financial metrics",
    icon: <DollarSign className="w-5 h-5" />,
    example: "Q4 2023 revenue increased 15% to $2.5M, with EBITDA margin improving to 18% driven by cost optimization.",
    prompt: "Extract financial metrics, percentages, amounts, time periods, and business drivers.",
    color: "from-amber-500 to-orange-500"
  },
  {
    title: "Customer Feedback",
    description: "Analyze customer reviews to extract sentiments, issues, and product mentions",
    icon: <MessageSquare className="w-5 h-5" />,
    example: "The new smartphone camera is amazing, but battery life is disappointing. Customer service was very helpful though.",
    prompt: "Extract product features, sentiments, issues, and service experiences with sentiment analysis.",
    color: "from-rose-500 to-red-500"
  },
  {
    title: "Research & News",
    description: "Extract key findings, people, organizations, and data from research articles",
    icon: <Newspaper className="w-5 h-5" />,
    example: "Dr. Sarah Chen from Stanford published breakthrough AI safety research in Nature, involving 500 participants.",
    prompt: "Extract researchers, institutions, publications, findings, and quantitative data.",
    color: "from-cyan-500 to-blue-500"
  }
];

export function UseCasesHeader() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-8">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between text-left p-4 h-auto bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border border-purple-200 rounded-lg"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <BookOpen className="text-white w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Explore Use Cases</h3>
            <p className="text-sm text-gray-600">See what you can extract with LangExtract Platform</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </Button>

      {isExpanded && (
        <div className="mt-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {useCases.map((useCase, index) => (
              <Card key={index} className="card-hover transition-all duration-300 hover:scale-105">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${useCase.color} rounded-lg flex items-center justify-center text-white`}>
                      {useCase.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{useCase.title}</h4>
                      <p className="text-sm text-gray-600 mb-3">{useCase.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Example Text</label>
                      <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-700 border-l-4 border-purple-200">
                        "{useCase.example}"
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suggested Prompt</label>
                      <div className="mt-1 p-2 bg-blue-50 rounded text-sm text-blue-800 border-l-4 border-blue-200">
                        {useCase.prompt}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
                <Newspaper className="text-white w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Getting Started</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Try any of these use cases by copying the example text and prompt into the form below. 
                  You can also upload your own documents or fetch content from URLs.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">PDF Documents</span>
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">Word Files</span>
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">Excel Sheets</span>
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">PowerPoint</span>
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">Web URLs</span>
                  <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">Plain Text</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}