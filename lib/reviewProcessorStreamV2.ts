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
  reviewsProcessed?: number;
  totalReviews?: number;
}

export class ReviewProcessorStreamV2 {
  private openai: OpenAI;
  private batchSize: number = 100; // Smaller batches for faster processing

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async *processReviewsStream(
    reviews: Review[],
    promptTemplate: string
  ): AsyncGenerator<ProcessingUpdate | { type: 'result'; data: CategoryInsights }, void, unknown> {
    const batches = this.createBatches(reviews);
    const allResults: CategoryInsights[] = [];
    let totalTokensUsed = 0;
    let totalCost = 0;
    let reviewsProcessedCount = 0;
    
    console.log(`Starting to process ${reviews.length} total reviews in ${batches.length} batches`);

    // Process batches and yield updates
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      yield {
        currentBatch: i + 1,
        totalBatches: batches.length,
        status: `Processing batch ${i + 1} of ${batches.length} (${reviewsProcessedCount + 1}-${Math.min(reviewsProcessedCount + batch.length, reviews.length)} of ${reviews.length} reviews)...`,
        tokensUsed: totalTokensUsed,
        estimatedCost: totalCost,
        reviewsProcessed: reviewsProcessedCount,
        totalReviews: reviews.length,
      };

      try {
        const result = await this.processBatch(batch, promptTemplate);
        allResults.push(result.insights);
        totalTokensUsed += result.tokensUsed;
        totalCost += result.cost;
        reviewsProcessedCount += batch.length;

        yield {
          currentBatch: i + 1,
          totalBatches: batches.length,
          status: `Completed batch ${i + 1} of ${batches.length} (${reviewsProcessedCount}/${reviews.length} reviews)`,
          tokensUsed: totalTokensUsed,
          estimatedCost: totalCost,
          reviewsProcessed: reviewsProcessedCount,
          totalReviews: reviews.length,
        };
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isRateLimit = errorMessage.toLowerCase().includes('rate limit') ||
                           errorMessage.toLowerCase().includes('429');
        
        if (isRateLimit) {
          yield {
            currentBatch: i + 1,
            totalBatches: batches.length,
            status: `Rate limit hit. Waiting 10 seconds before retry...`,
            tokensUsed: totalTokensUsed,
            estimatedCost: totalCost,
            reviewsProcessed: reviewsProcessedCount,
            totalReviews: reviews.length,
          };
          
          await new Promise(resolve => setTimeout(resolve, 10000));
          i--; // Retry this batch
          continue;
        }
        
        throw error;
      }
      
      // Small delay between batches to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // AI consolidation only - no basic consolidation
    yield {
      currentBatch: batches.length,
      totalBatches: batches.length,
      status: 'Consolidating insights with AI...',
      tokensUsed: totalTokensUsed,
      estimatedCost: totalCost,
      reviewsProcessed: reviewsProcessedCount,
      totalReviews: reviews.length,
    };
    
    const finalConsolidation = await this.aiConsolidation(allResults);
    totalTokensUsed += finalConsolidation.tokensUsed;
    totalCost += finalConsolidation.cost;
    
    console.log(`Processed ${reviewsProcessedCount} reviews out of ${reviews.length} total`);
    
    yield {
      currentBatch: batches.length,
      totalBatches: batches.length,
      status: `Analysis complete! Processed all ${reviewsProcessedCount} reviews.`,
      tokensUsed: totalTokensUsed,
      estimatedCost: totalCost,
      reviewsProcessed: reviewsProcessedCount,
      totalReviews: reviews.length,
    };

    // Yield final result
    yield {
      type: 'result',
      data: finalConsolidation.insights
    };
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
    console.log(`Processing batch with ${batch.length} reviews`);
    
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

  private async aiConsolidation(
    allBatchResults: CategoryInsights[]
  ): Promise<{ insights: CategoryInsights; tokensUsed: number; cost: number }> {
    // Merge all batch results into one structure for consolidation
    const mergedInsights: CategoryInsights = {};
    
    for (const batchResult of allBatchResults) {
      for (const [category, data] of Object.entries(batchResult)) {
        if (!mergedInsights[category]) {
          mergedInsights[category] = { insights: [] };
        }
        mergedInsights[category].insights.push(...data.insights);
      }
    }
    
    const totalInsights = Object.values(mergedInsights).reduce((acc, cat) => acc + cat.insights.length, 0);
    const totalQuotes = Object.values(mergedInsights).reduce((acc, cat) => 
      acc + cat.insights.reduce((sum, insight) => sum + insight.quotes.length, 0), 0
    );
    
    console.log(`Consolidating ${totalInsights} insights with ${totalQuotes} total quotes`);
    
    const consolidationPrompt = `You are an expert at analyzing and consolidating customer review insights. 
I have collected insights from analyzing ${totalInsights} different insights across multiple batches of reviews.

Your task is to intelligently consolidate these insights by:
1. ONLY merge insights that are TRUE DUPLICATES expressing the exact same issue/benefit
2. PRESERVE DISTINCT insights even if they're in the same general area
3. Keep patterns SHORT and SPECIFIC (5-10 words max) - not full sentences
4. Merge ALL quotes from truly duplicate insights into one
5. Each category should typically have 3-7 distinct insights (not just 1)
6. Translate non-English quotes to English and append " [Originally in {Language}]"

IMPORTANT Guidelines for what to MERGE vs KEEP SEPARATE:

Product Quality Issues:
- MERGE: "Product broke" + "Item broke" → "Product breaks"
- KEEP SEPARATE: "Breaks easily" vs "Defective on arrival" vs "Poor materials"

Packaging & Shipping:
- MERGE: "Box damaged" + "Package damaged" → "Damaged packaging"  
- KEEP SEPARATE: "Damaged packaging" vs "Missing items" vs "Wrong item sent" vs "Late delivery"

Benefits & Use Cases:
- MERGE: "Great for traveling" + "Perfect for travel" → "Great for travel"
- KEEP SEPARATE: "Great for travel" vs "Perfect for office" vs "Kids love it"

Value for Money:
- MERGE: "Good value" + "Great value" → "Good value"
- KEEP SEPARATE: "Good value" vs "Overpriced" vs "Worth the premium"

Here are the insights to consolidate:

${JSON.stringify(mergedInsights, null, 2)}

Please return a JSON object with the same structure, with insights that:
- Preserve DISTINCT patterns within each category
- Only merge TRUE duplicates (same exact issue/benefit)
- Aim for 3-7 insights per category where applicable
- Keep ALL quotes from merged insights
- Use short, specific patterns (5-10 words)`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at consolidating customer insights. Your goal is to preserve distinct insights while only merging true duplicates. Always respond with valid JSON that maintains the exact structure provided.'
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
      // Fall back to unprocessed insights if AI consolidation fails
      return {
        insights: mergedInsights,
        tokensUsed: 0,
        cost: 0
      };
    }
  }
}