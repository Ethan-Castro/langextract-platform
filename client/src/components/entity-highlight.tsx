import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type ExtractionResult } from "@shared/schema";

interface EntityHighlightProps {
  text: string;
  extractions: ExtractionResult[];
  className?: string;
}

export function EntityHighlight({ text, extractions, className = "" }: EntityHighlightProps) {
  const [hoveredEntity, setHoveredEntity] = useState<number | null>(null);

  const getEntityColor = (entityClass: string): string => {
    const colors: Record<string, string> = {
      character: "bg-blue-200 border-blue-500",
      emotion: "bg-green-200 border-green-500",
      relationship: "bg-purple-200 border-purple-500",
      location: "bg-orange-200 border-orange-500",
      organization: "bg-red-200 border-red-500",
    };
    return colors[entityClass] || "bg-gray-200 border-gray-500";
  };

  const highlightText = (): JSX.Element[] => {
    if (!extractions.length) return [<span key="text">{text}</span>];

    // Sort extractions by position to handle overlapping highlights
    const sortedExtractions = [...extractions]
      .map((extraction, originalIndex) => ({ ...extraction, originalIndex }))
      .sort((a, b) => {
        const aStart = a.position_start ?? text.indexOf(a.extraction_text);
        const bStart = b.position_start ?? text.indexOf(b.extraction_text);
        return aStart - bStart;
      });

    const segments: JSX.Element[] = [];
    let lastEnd = 0;

    sortedExtractions.forEach((extraction, index) => {
      const start = extraction.position_start ?? text.indexOf(extraction.extraction_text, lastEnd);
      const end = extraction.position_end ?? start + extraction.extraction_text.length;

      // Add text before this extraction
      if (start > lastEnd) {
        segments.push(
          <span key={`text-${index}`}>
            {text.slice(lastEnd, start)}
          </span>
        );
      }

      // Add highlighted extraction
      const isHovered = hoveredEntity === extraction.originalIndex;
      segments.push(
        <span
          key={`highlight-${index}`}
          className={`
            ${getEntityColor(extraction.extraction_class)} 
            px-1 py-0.5 rounded border-l-2 cursor-pointer
            transition-all duration-200
            ${isHovered ? 'scale-105 shadow-md z-10 relative' : ''}
          `}
          onMouseEnter={() => setHoveredEntity(extraction.originalIndex)}
          onMouseLeave={() => setHoveredEntity(null)}
          title={`${extraction.extraction_class}: ${Object.entries(extraction.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}`}
        >
          {extraction.extraction_text}
        </span>
      );

      lastEnd = Math.max(lastEnd, end);
    });

    // Add remaining text
    if (lastEnd < text.length) {
      segments.push(
        <span key="text-end">
          {text.slice(lastEnd)}
        </span>
      );
    }

    return segments;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm leading-relaxed">
        {highlightText()}
      </div>
      
      {/* Legend */}
      {extractions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Entity Legend</h4>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(extractions.map(e => e.extraction_class))).map(entityClass => (
                <Badge
                  key={entityClass}
                  variant="outline"
                  className={`${getEntityColor(entityClass)} text-gray-800`}
                >
                  {entityClass}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
