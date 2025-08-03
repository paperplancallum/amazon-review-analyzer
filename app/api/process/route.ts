import { NextRequest, NextResponse } from 'next/server';
import { ReviewProcessor } from '@/lib/reviewProcessor';

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