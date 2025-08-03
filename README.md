# Amazon Review Analyzer

An AI-powered application that analyzes Amazon product reviews to extract actionable insights across 12 key categories.

## Features

- **Excel File Upload**: Supports .xlsx, .xls, and .csv files
- **Editable Prompt Template**: Customize the AI analysis prompt in real-time
- **Batch Processing**: Efficiently processes reviews in batches of 10
- **Real-time Progress**: Live updates during processing with token usage and cost estimates
- **Comprehensive Insights**: Extracts insights across 12 predefined categories
- **Export Options**: Download results as JSON or CSV
- **Search & Filter**: Search through extracted insights
- **Cost-Effective**: Uses GPT-4o-mini for efficient processing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your OpenAI API key:
   - Copy `.env.local.example` to `.env.local`
   - Add your OpenAI API key:
```
OPENAI_API_KEY=your_actual_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload Excel Files**: 
   - Drag and drop or click to upload Excel files containing reviews
   - Expected columns: Content (review text), Rating (1-5), Title (optional)

2. **Customize Prompt** (Optional):
   - Edit the prompt template on the right side
   - Add/remove categories or modify instructions
   - Save custom templates for reuse

3. **Start Analysis**:
   - Click "Start Analysis" to begin processing
   - Monitor progress in real-time
   - View token usage and estimated costs

4. **Review Results**:
   - Explore insights organized by category
   - View exact customer quotes with context
   - Search and filter insights
   - Export as JSON or CSV

## Default Categories

1. Product Quality Issues
2. Packaging & Shipping Experiences
3. Health Benefits & Use Cases
4. Value for Money Judgments
5. Authenticity Concerns & Trust Signals
6. Taste, Texture & Sensory Descriptions
7. Competitor Comparisons
8. Unexpected Uses & Discoveries
9. Customer Service Experiences
10. Usage Patterns & Frequency
11. Gift-Giving & Special Occasions
12. Product Education Gaps

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: OpenAI GPT-4o-mini
- **File Processing**: xlsx library
- **UI Components**: Custom components with Tailwind

## API Endpoints

- `POST /api/upload`: Upload and parse Excel files
- `POST /api/process`: Process reviews with AI (streaming response)

## Cost Estimation

- GPT-4o-mini pricing (as of 2024):
  - Input: $0.15 per 1M tokens
  - Output: $0.60 per 1M tokens
- Approximate cost: ~$0.01-0.02 per 100 reviews

## Development

- Lint: `npm run lint`
- Build: `npm run build`
- Start production: `npm start`