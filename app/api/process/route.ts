import { NextRequest, NextResponse } from 'next/server';
import { ReviewProcessor } from '@/lib/reviewProcessor';

// Increase Vercel function timeout to maximum (5 minutes for Pro/Enterprise, 10 seconds for Hobby)
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { reviews, promptTemplate, userApiKey } = await request.json();
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews provided' }, { status: 400 });
    }

    if (!promptTemplate) {
      return NextResponse.json({ error: 'No prompt template provided' }, { status: 400 });
    }

    // Use user-provided key if available, otherwise fall back to server key
    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please provide an API key.' },
        { status: 500 }
      );
    }

    // Add timeout warning for large datasets
    const estimatedBatches = Math.ceil(reviews.length / 200);
    const estimatedTimeSeconds = estimatedBatches * 10; // ~10 seconds per batch
    
    if (estimatedTimeSeconds > 240) { // Warning if over 4 minutes
      console.warn(`Large dataset detected: ${reviews.length} reviews, ${estimatedBatches} batches. Estimated time: ${Math.round(estimatedTimeSeconds / 60)} minutes`);
    }

    // Create a readable stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const processor = new ReviewProcessor(apiKey);

        try {
          const results = await processor.processReviews(
            reviews,
            promptTemplate,
            (update) => {
              // Send progress updates to the client
              const data = JSON.stringify({ type: 'progress', ...update }) + '\n';
              controller.enqueue(encoder.encode(data));
            }
          );

          // Send final results
          const finalData = JSON.stringify({ type: 'complete', results }) + '\n';
          controller.enqueue(encoder.encode(finalData));
        } catch (error) {
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Processing failed'
          }) + '\n';
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Process API error:', error);
    return NextResponse.json(
      { error: 'Failed to process reviews' },
      { status: 500 }
    );
  }
}