import OpenAI from 'openai';
import { CategoryInsights } from './promptManager';

export interface Review {
  content: string;
  rating: number;
  title?: string;
}

export interface ProcessingUpdate {
  currentBatch: number;
  totalBatches: number;
  status: string;
  tokensUsed?: number;
  estimatedCost?: number;
}

export class ReviewProcessor {
  private openai: OpenAI;
  private batchSize: number = 50; // Optimized for ~5000 words per batch

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async processReviews(
    reviews: Review[],
    promptTemplate: string,
    onUpdate?: (update: ProcessingUpdate) => void
  ): Promise<CategoryInsights> {
    const batches = this.createBatches(reviews);
    const allResults: CategoryInsights[] = [];
    let totalTokensUsed = 0;
    let totalCost = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      onUpdate?.({
        currentBatch: i + 1,
        totalBatches: batches.length,
        status: `Processing batch ${i + 1} of ${batches.length}...`,
      });

      try {
        const result = await this.processBatch(batch, promptTemplate);
        allResults.push(result.insights);
        totalTokensUsed += result.tokensUsed;
        totalCost += result.cost;

        onUpdate?.({
          currentBatch: i + 1,
          totalBatches: batches.length,
          status: `Completed batch ${i + 1} of ${batches.length}`,
          tokensUsed: totalTokensUsed,
          estimatedCost: totalCost,
        });
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
        onUpdate?.({
          currentBatch: i + 1,
          totalBatches: batches.length,
          status: `Error in batch ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Basic consolidation
    const basicConsolidated = this.consolidateResults(allResults);
    
    // AI-powered consolidation using GPT-4o
    onUpdate?.({
      currentBatch: batches.length,
      totalBatches: batches.length,
      status: 'Consolidating insights with AI...',
      tokensUsed: totalTokensUsed,
      estimatedCost: totalCost,
    });
    
    const finalConsolidation = await this.aiConsolidation(basicConsolidated, onUpdate);
    totalTokensUsed += finalConsolidation.tokensUsed;
    totalCost += finalConsolidation.cost;
    
    onUpdate?.({
      currentBatch: batches.length,
      totalBatches: batches.length,
      status: 'Analysis complete!',
      tokensUsed: totalTokensUsed,
      estimatedCost: totalCost,
    });

    return finalConsolidation.insights;
  }

  private createBatches(reviews: Review[]): Review[][] {
    const batches: Review[][] = [];
    for (let i = 0; i < reviews.length; i += this.batchSize) {
      batches.push(reviews.slice(i, i + this.batchSize));
    }
    return batches;
  }

  private async processBatch(
    batch: Review[],
    promptTemplate: string
  ): Promise<{ insights: CategoryInsights; tokensUsed: number; cost: number }> {
    const reviewsText = batch
      .map((review, index) => {
        let text = `Review ${index + 1}: ${review.content}`;
        if (review.rating) text += ` (Rating: ${review.rating}/5)`;
        if (review.title) text += ` [Title: ${review.title}]`;
        return text;
      })
      .join('\n\n');

    const prompt = promptTemplate.replace('{{reviews}}', reviewsText);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing customer reviews and extracting actionable insights. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0].message.content || '{}';
    const insights = JSON.parse(responseContent) as CategoryInsights;

    // Calculate tokens and cost
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    
    // GPT-4o-mini pricing
    const inputCost = (promptTokens / 1_000_000) * 0.15;
    const outputCost = (completionTokens / 1_000_000) * 0.60;
    const totalCost = inputCost + outputCost;

    return {
      insights,
      tokensUsed: totalTokens,
      cost: totalCost
    };
  }

  private consolidateResults(results: CategoryInsights[]): CategoryInsights {
    const consolidated: CategoryInsights = {};

    for (const result of results) {
      for (const [category, data] of Object.entries(result)) {
        if (!consolidated[category]) {
          consolidated[category] = { insights: [] };
        }

        // Merge insights
        for (const insight of data.insights) {
          // Check if similar insight already exists
          const existingInsight = consolidated[category].insights.find(
            existing => this.areSimilarInsights(existing, insight)
          );

          if (existingInsight) {
            // Merge quotes
            const uniqueQuotes = new Set([...existingInsight.quotes, ...insight.quotes]);
            existingInsight.quotes = Array.from(uniqueQuotes);
            
            // Update context if the new one is more detailed
            if (insight.context.length > existingInsight.context.length) {
              existingInsight.context = insight.context;
            }
          } else {
            // Add as new insight
            consolidated[category].insights.push({
              quotes: [...insight.quotes],
              context: insight.context,
              pattern: insight.pattern
            });
          }
        }
      }
    }

    return consolidated;
  }

  private areSimilarInsights(insight1: { pattern?: string }, insight2: { pattern?: string }): boolean {
    // Check if patterns are similar (case-insensitive)
    if (insight1.pattern && insight2.pattern) {
      const pattern1 = insight1.pattern.toLowerCase();
      const pattern2 = insight2.pattern.toLowerCase();
      
      // Check for significant overlap in patterns
      const words1 = pattern1.split(/\s+/);
      const words2 = pattern2.split(/\s+/);
      const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
      
      return commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
    }
    
    return false;
  }

  private async aiConsolidation(
    consolidatedInsights: CategoryInsights,
    onUpdate?: (update: ProcessingUpdate) => void
  ): Promise<{ insights: CategoryInsights; tokensUsed: number; cost: number }> {
    const consolidationPrompt = `You are an expert at analyzing and consolidating customer review insights. 
I have collected insights from analyzing ${Object.values(consolidatedInsights).reduce((acc, cat) => acc + cat.insights.length, 0)} different insights across multiple batches of reviews.

Your task is to intelligently consolidate these insights by:
1. ELIMINATE DUPLICATE INSIGHTS - If multiple insights say essentially the same thing, merge them into ONE
2. Keep patterns SHORT and SPECIFIC (5-10 words max) - not full sentences
3. Examples of good patterns: "Damaged packaging", "Bitter aftertaste", "Fast shipping", "Poor customer service"
4. Examples of bad patterns: "Customers are complaining about damaged packaging", "Many users report a bitter aftertaste"
5. Merge ALL quotes from similar insights into the consolidated insight
6. Make context descriptions ACTION-ORIENTED and BRIEF
7. IMPORTANT: If any customer quotes are in a language other than English:
   - Translate them accurately to English while preserving the original meaning and sentiment
   - Append " [Originally in {Language}]" at the end of the translated quote

Here are the insights to consolidate:

${JSON.stringify(consolidatedInsights, null, 2)}

Please return a JSON object with the same structure, but with CONSOLIDATED insights that:
- ELIMINATE redundant insights - merge similar ones
- Use SHORT patterns (5-10 words, no sentences)
- Group ALL quotes from similar insights together
- Translate non-English quotes and mark them with [Originally in {Language}]
- Make context descriptions brief and actionable
- Significantly reduce the total number of insights by merging duplicates

CRITICAL: The goal is FEWER, CLEARER insights. If 5 insights all talk about "damaged packaging", return just ONE insight with ALL the quotes.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at consolidating customer insights with multilingual capabilities. You can accurately detect and translate reviews from any language to English while preserving meaning and sentiment. Always respond with valid JSON that maintains the exact structure provided.'
          },
          {
            role: 'user',
            content: consolidationPrompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const responseContent = completion.choices[0].message.content || '{}';
      const consolidatedInsights = JSON.parse(responseContent) as CategoryInsights;

      // Calculate tokens and cost for GPT-4o
      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;
      
      // GPT-4o pricing (as of 2024)
      const inputCost = (promptTokens / 1_000_000) * 2.50;  // $2.50 per 1M input tokens
      const outputCost = (completionTokens / 1_000_000) * 10.00;  // $10.00 per 1M output tokens
      const totalCost = inputCost + outputCost;

      return {
        insights: consolidatedInsights,
        tokensUsed: totalTokens,
        cost: totalCost
      };
    } catch (error) {
      console.error('AI consolidation error:', error);
      // Fall back to basic consolidation if AI consolidation fails
      return {
        insights: consolidatedInsights,
        tokensUsed: 0,
        cost: 0
      };
    }
  }
}