import { ReviewProcessorEdge } from '@/lib/reviewProcessorEdge';

// Use Edge Runtime for unlimited streaming
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { reviews, promptTemplate, userApiKey } = await request.json();
    
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return new Response(JSON.stringify({ error: 'No reviews provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!promptTemplate) {
      return new Response(JSON.stringify({ error: 'No prompt template provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use user-provided key if available, otherwise fall back to server key
    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Please provide an API key.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create encoder for streaming responses
    const encoder = new TextEncoder();
    
    // Create a readable stream that will handle the processing
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial response immediately to satisfy Edge Function 30-second requirement
        const initialData = JSON.stringify({ 
          type: 'init', 
          totalReviews: reviews.length,
          estimatedBatches: Math.ceil(reviews.length / 200)
        }) + '\n';
        controller.enqueue(encoder.encode(initialData));

        const processor = new ReviewProcessorEdge(apiKey);

        try {
          // Process reviews with streaming updates
          const results = await processor.processReviews(
            reviews,
            promptTemplate,
            (update) => {
              // Stream progress updates to the client
              const data = JSON.stringify({ type: 'progress', ...update }) + '\n';
              controller.enqueue(encoder.encode(data));
            }
          );

          // Send final results
          const finalData = JSON.stringify({ type: 'complete', results }) + '\n';
          controller.enqueue(encoder.encode(finalData));
        } catch (error) {
          console.error('Processing error:', error);
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

    // Return streaming response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('Process API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process reviews' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}