import { GoogleGenAI } from "@google/genai";

export interface GeneratedExample {
  text: string;
  extractions: Array<{
    extraction_class: string;
    extraction_text: string;
    attributes: Record<string, any>;
  }>;
}

export class GeminiExampleService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not found in environment variables");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateExample(promptDescription: string): Promise<GeneratedExample> {
    try {
      const systemPrompt = `You are an expert at creating training examples for AI extraction tasks. 
Given a prompt description, generate a realistic example text and corresponding extractions.

The response must be valid JSON in this exact format:
{
  "text": "example text content",
  "extractions": [
    {
      "extraction_class": "entity_type",
      "extraction_text": "specific text span",
      "attributes": {"key": "value"}
    }
  ]
}

Guidelines:
- Create realistic, varied example text (2-4 sentences)
- Include 3-5 relevant extractions that match the prompt
- Use meaningful entity classes and attributes
- Make attributes specific and useful
- Ensure extracted text appears in the example text
- Keep it professional and factual`;

      const userPrompt = `Create a training example for this extraction task:

Prompt Description: ${promptDescription}

Generate realistic example text and corresponding extractions that would help train an AI model for this task.`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              extractions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    extraction_class: { type: "string" },
                    extraction_text: { type: "string" },
                    attributes: { type: "object" }
                  },
                  required: ["extraction_class", "extraction_text", "attributes"]
                }
              }
            },
            required: ["text", "extractions"]
          }
        },
        contents: userPrompt,
      });

      const rawJson = response.text;
      if (!rawJson) {
        throw new Error("Empty response from Gemini");
      }

      const result = JSON.parse(rawJson) as GeneratedExample;
      
      // Validate the result
      if (!result.text || !result.extractions || !Array.isArray(result.extractions)) {
        throw new Error("Invalid response format from Gemini");
      }

      if (result.extractions.length === 0) {
        throw new Error("No extractions generated");
      }

      return result;
    } catch (error) {
      console.error("Failed to generate example with Gemini:", error);
      throw new Error(`Failed to generate example: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateMultipleExamples(promptDescription: string, count: number = 2): Promise<GeneratedExample[]> {
    const examples: GeneratedExample[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const example = await this.generateExample(promptDescription);
        examples.push(example);
        
        // Add a small delay between requests to be respectful to the API
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to generate example ${i + 1}:`, error);
        // Continue generating other examples even if one fails
      }
    }

    if (examples.length === 0) {
      throw new Error("Failed to generate any examples");
    }

    return examples;
  }
}