import { ReviewProcessorStreamV2 } from '@/lib/reviewProcessorStreamV2';

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

    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Please provide an API key.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create encoder for streaming
    const encoder = new TextEncoder();
    
    // Use TransformStream for true streaming
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    
    // Start processing in background
    (async () => {
      try {
        // Send initial response immediately
        await writer.write(encoder.encode(JSON.stringify({ 
          type: 'init', 
          totalReviews: reviews.length,
          estimatedBatches: Math.ceil(reviews.length / 100)
        }) + '\n'));
        
        const processor = new ReviewProcessorStreamV2(apiKey);
        
        // Process reviews with streaming updates using generator
        for await (const update of processor.processReviewsStream(reviews, promptTemplate)) {
          if ('type' in update && update.type === 'result') {
            // Final results
            const finalData = JSON.stringify({ type: 'complete', results: update.data }) + '\n';
            await writer.write(encoder.encode(finalData));
          } else {
            // Progress update
            const data = JSON.stringify({ type: 'progress', ...update }) + '\n';
            await writer.write(encoder.encode(data));
          }
        }
      } catch (error) {
        console.error('Processing error:', error);
        const errorData = JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Processing failed'
        }) + '\n';
        await writer.write(encoder.encode(errorData));
      } finally {
        await writer.close();
      }
    })();
    
    // Return readable stream immediately
    return new Response(readable, {
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