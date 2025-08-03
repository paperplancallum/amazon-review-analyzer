export const DEFAULT_PROMPT_TEMPLATE = `Analyze these customer reviews and extract insights for the following categories:

1. Product Quality Issues
2. Packaging & Shipping Experiences  
3. Benefits & Use Cases
4. Value for Money Judgments
5. Authenticity Concerns & Trust Signals
6. Taste, Texture & Sensory Descriptions (if applicable to the product)
7. Competitor Comparisons
8. Unexpected Uses & Discoveries
9. Customer Service Experiences
10. Usage Patterns & Frequency
11. Gift-Giving & Special Occasions
12. Product Education Gaps

Reviews to analyze:
{{reviews}}

For each category where insights are found, provide:
- Multiple exact customer quotes (verbatim) - capture ALL relevant quotes
- Context explaining the insight (brief and actionable)
- Pattern: SHORT phrase (5-10 words max) - NOT a full sentence
  Good examples: "Damaged packaging", "Bitter taste", "Excellent value"
  Bad examples: "Customers are reporting damaged packaging", "Many users find the taste bitter"

IMPORTANT: 
- Extract as many relevant quotes as possible for each category
- Include the full, exact customer language (in whatever language they wrote)
- Keep quotes in their original language - they will be translated later
- If no insights exist for a category, omit it from the response

Format your response as valid JSON with this structure:
{
  "category_name": {
    "insights": [
      {
        "quotes": ["exact quote 1", "exact quote 2", "exact quote 3"],
        "context": "explanation of what these quotes reveal",
        "pattern": "common theme or pattern identified"
      }
    ]
  }
}`;

export interface ProcessedInsight {
  quotes: string[];
  context: string;
  pattern: string;
}

export interface CategoryInsights {
  [category: string]: {
    insights: ProcessedInsight[];
  };
}

export class PromptManager {
  private template: string;

  constructor(template: string = DEFAULT_PROMPT_TEMPLATE) {
    this.template = template;
  }

  generatePrompt(reviews: string[]): string {
    const reviewsText = reviews
      .map((review, index) => `Review ${index + 1}: ${review}`)
      .join('\n\n');
    
    return this.template.replace('{{reviews}}', reviewsText);
  }

  updateTemplate(newTemplate: string): void {
    this.template = newTemplate;
  }

  getTemplate(): string {
    return this.template;
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  estimateCost(promptTokens: number, completionTokens: number): number {
    // GPT-4o-mini pricing (as of 2024)
    // Input: $0.15 per 1M tokens
    // Output: $0.60 per 1M tokens
    const inputCost = (promptTokens / 1_000_000) * 0.15;
    const outputCost = (completionTokens / 1_000_000) * 0.60;
    return inputCost + outputCost;
  }
}