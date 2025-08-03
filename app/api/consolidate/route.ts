import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { CategoryInsights } from '@/lib/promptManager';

export const maxDuration = 120; // 2 minutes for larger consolidations

export async function POST(request: NextRequest) {
  try {
    const { batchResults, userApiKey } = await request.json();
    
    if (!batchResults || !Array.isArray(batchResults)) {
      return NextResponse.json({ error: 'No batch results provided' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    
    // Merge all batch results
    const mergedInsights: CategoryInsights = {};
    
    for (const batchResult of batchResults) {
      for (const [category, data] of Object.entries(batchResult as CategoryInsights)) {
        if (!mergedInsights[category]) {
          mergedInsights[category] = { insights: [] };
        }
        // Limit quotes to prevent payload from being too large
        const limitedInsights = data.insights.map(insight => ({
          ...insight,
          quotes: insight.quotes.slice(0, 10) // Max 10 quotes per insight
        }));
        mergedInsights[category].insights.push(...limitedInsights);
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

    const completion = await openai.chat.completions.create({
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

    const consolidatedInsights = JSON.parse(completion.choices[0].message.content || '{}') as CategoryInsights;

    // Calculate tokens and cost for GPT-4o
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    
    // GPT-4o pricing
    const inputCost = (promptTokens / 1_000_000) * 2.50;
    const outputCost = (completionTokens / 1_000_000) * 10.00;
    const totalCost = inputCost + outputCost;

    return NextResponse.json({
      results: consolidatedInsights,
      tokensUsed: totalTokens,
      cost: totalCost
    });
    
  } catch (error) {
    console.error('Consolidation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Consolidation failed' },
      { status: 500 }
    );
  }
}