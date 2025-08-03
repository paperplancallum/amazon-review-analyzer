import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60; // 1 minute per category should be plenty

export async function POST(request: NextRequest) {
  try {
    const { category, insights, userApiKey } = await request.json();
    
    if (!category || !insights || !Array.isArray(insights)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    
    const totalInsights = insights.length;
    const totalQuotes = insights.reduce((sum, insight) => sum + insight.quotes.length, 0);
    
    console.log(`Consolidating ${totalInsights} insights with ${totalQuotes} quotes for category: ${category}`);
    
    const consolidationPrompt = `You are an expert at analyzing and consolidating customer review insights. 
I have collected ${totalInsights} insights for the "${category}" category from analyzing multiple batches of reviews.

Your task is to intelligently consolidate these insights by:
1. ONLY merge insights that are TRUE DUPLICATES expressing the exact same issue/benefit
2. PRESERVE DISTINCT insights even if they're in the same general area
3. Keep patterns SHORT and SPECIFIC (5-10 words max) - not full sentences
4. Merge ALL quotes from truly duplicate insights into one
5. This category should typically have 3-7 distinct insights (not just 1)
6. Translate non-English quotes to English and append " [Originally in {Language}]"

IMPORTANT Guidelines for "${category}":

${getCategoryGuidelines(category)}

Here are the insights to consolidate:

${JSON.stringify(insights, null, 2)}

Please return a JSON array of consolidated insights that:
- Preserve DISTINCT patterns within this category
- Only merge TRUE duplicates (same exact issue/benefit)
- Aim for 3-7 insights where applicable
- Keep ALL quotes from merged insights
- Use short, specific patterns (5-10 words)`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at consolidating customer insights. Your goal is to preserve distinct insights while only merging true duplicates. Always respond with valid JSON that represents an array of insight objects.'
        },
        {
          role: 'user',
          content: consolidationPrompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const response = JSON.parse(completion.choices[0].message.content || '{}');
    const consolidatedInsights = response.insights || response || [];

    // Calculate tokens and cost for GPT-4o
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    
    // GPT-4o pricing
    const inputCost = (promptTokens / 1_000_000) * 2.50;
    const outputCost = (completionTokens / 1_000_000) * 10.00;
    const totalCost = inputCost + outputCost;

    return NextResponse.json({
      insights: consolidatedInsights,
      tokensUsed: totalTokens,
      cost: totalCost
    });
    
  } catch (error) {
    console.error('Category consolidation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Consolidation failed' },
      { status: 500 }
    );
  }
}

function getCategoryGuidelines(category: string): string {
  const guidelines: { [key: string]: string } = {
    'Product Quality Issues': `- MERGE: "Product broke" + "Item broke" → "Product breaks"
- KEEP SEPARATE: "Breaks easily" vs "Defective on arrival" vs "Poor materials"`,
    
    'Packaging & Shipping Experiences': `- MERGE: "Box damaged" + "Package damaged" → "Damaged packaging"  
- KEEP SEPARATE: "Damaged packaging" vs "Missing items" vs "Wrong item sent" vs "Late delivery"`,
    
    'Benefits & Use Cases': `- MERGE: "Great for traveling" + "Perfect for travel" → "Great for travel"
- KEEP SEPARATE: "Great for travel" vs "Perfect for office" vs "Kids love it"`,
    
    'Value for Money Judgments': `- MERGE: "Good value" + "Great value" → "Good value"
- KEEP SEPARATE: "Good value" vs "Overpriced" vs "Worth the premium"`,
    
    'Authenticity Concerns & Trust Signals': `- MERGE: "Fake product" + "Counterfeit item" → "Counterfeit product"
- KEEP SEPARATE: "Counterfeit product" vs "Trusted seller" vs "Genuine article"`,
    
    'Taste, Texture & Sensory Descriptions (if applicable to the product)': `- MERGE: "Tastes great" + "Great taste" → "Great taste"
- KEEP SEPARATE: "Great taste" vs "Bitter aftertaste" vs "Smooth texture"`,
    
    'Competitor Comparisons': `- MERGE: "Better than Brand X" + "Superior to Brand X" → "Better than Brand X"
- KEEP SEPARATE: Different competitor comparisons`,
    
    'Unexpected Uses & Discoveries': `- MERGE: Similar unexpected uses
- KEEP SEPARATE: Different creative uses or discoveries`,
    
    'Customer Service Experiences': `- MERGE: "Great support" + "Excellent support" → "Great support"
- KEEP SEPARATE: "Great support" vs "Slow response" vs "Unhelpful staff"`,
    
    'Usage Patterns & Frequency': `- MERGE: "Daily use" + "Use every day" → "Daily use"
- KEEP SEPARATE: "Daily use" vs "Weekly use" vs "Special occasions"`,
    
    'Gift-Giving & Special Occasions': `- MERGE: "Great gift" + "Perfect gift" → "Great gift"
- KEEP SEPARATE: "Great gift" vs "Birthday gift" vs "Holiday present"`,
    
    'Product Education Gaps': `- MERGE: Similar knowledge gaps
- KEEP SEPARATE: Different areas of confusion or missing information`
  };
  
  return guidelines[category] || 'Apply general consolidation principles for this category.';
}