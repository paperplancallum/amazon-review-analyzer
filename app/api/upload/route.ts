import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const allReviews: Array<{
      content: string;
      rating: number;
      title?: string;
    }> = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Process the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
      
      // Extract reviews from the data
      const reviews = jsonData
        .map((row: Record<string, unknown>) => {
          // Try to find review content from various possible column names
          const content = row['Content'] || row['content'] || row['Review'] || row['review'] || 
                         row['Text'] || row['text'] || row['Comment'] || row['comment'] || '';
          
          // Try to find rating
          const rating = parseFloat(row['Rating'] || row['rating'] || row['Score'] || row['score'] || '0');
          
          // Try to find title
          const title = row['Title'] || row['title'] || row['Subject'] || row['subject'] || undefined;
          
          return {
            content: content.toString().trim(),
            rating: isNaN(rating) ? 0 : rating,
            title: title ? title.toString().trim() : undefined
          };
        })
        .filter(review => review.content.length > 0); // Filter out empty reviews
      
      allReviews.push(...reviews);
    }

    // Return preview data
    return NextResponse.json({
      totalReviews: allReviews.length,
      reviews: allReviews.slice(0, 10), // Preview first 10 reviews
      allReviews: allReviews
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process files' },
      { status: 500 }
    );
  }
}