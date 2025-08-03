import { NextResponse } from 'next/server';

export async function GET() {
  // Check if API key is configured on the server
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  return NextResponse.json({
    hasApiKey,
    // Never send the actual key to the frontend
  });
}