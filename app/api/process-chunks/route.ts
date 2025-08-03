import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { CategoryInsights } from '@/lib/promptManager';

// Use Node.js runtime, not Edge
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      reviews, 
      promptTemplate, 
      userApiKey,
      startBatch = 0,  // Which batch to start from
      batchCount = 5   // How many batches to process in this request
    } = body;
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews provided' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const batchSize = 100;
    const totalBatches = Math.ceil(reviews.length / batchSize);
    
    // Process only the requested batches
    const endBatch = Math.min(startBatch + batchCount, totalBatches);
    const results: CategoryInsights[] = [];
    let tokensUsed = 0;
    let cost = 0;
    
    console.log(`Processing batches ${startBatch + 1} to ${endBatch} of ${totalBatches}`);
    
    for (let i = startBatch; i < endBatch; i++) {
      const batchStart = i * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, reviews.length);
      const batch = reviews.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${i + 1} with ${batch.length} reviews`);
      
      const reviewsText = batch
        .map((review: any, index: number) => {
          let text = `Review ${index + 1}: ${review.content}`;
          if (review.rating) text += ` (Rating: ${review.rating}/5)`;
          if (review.title) text += ` [Title: ${review.title}]`;
          return text;
        })
        .join('\n\n');

      const prompt = promptTemplate.replace('{{reviews}}', reviewsText);

      try {
        const completion = await openai.chat.completions.create({
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

        const insights = JSON.parse(completion.choices[0].message.content || '{}') as CategoryInsights;
        results.push(insights);
        
        // Calculate tokens and cost
        const promptTokens = completion.usage?.prompt_tokens || 0;
        const completionTokens = completion.usage?.completion_tokens || 0;
        tokensUsed += promptTokens + completionTokens;
        
        // GPT-4o-mini pricing
        const inputCost = (promptTokens / 1_000_000) * 0.15;
        const outputCost = (completionTokens / 1_000_000) * 0.60;
        cost += inputCost + outputCost;
        
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
        throw error;
      }
      
      // Small delay to avoid rate limits
      if (i < endBatch - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return NextResponse.json({
      results,
      nextBatch: endBatch < totalBatches ? endBatch : null,
      totalBatches,
      batchesProcessed: endBatch - startBatch,
      tokensUsed,
      cost,
      isComplete: endBatch >= totalBatches
    });
    
  } catch (error) {
    console.error('Process chunks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}