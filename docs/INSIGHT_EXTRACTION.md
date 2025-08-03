# How the System Extracts Insights from Reviews

## Current Capability: Multiple Insights Per Review

Yes, the system **CAN and DOES** extract multiple insights from a single review. Here's how:

### 1. Multiple Categories Per Review
A single review can contribute insights to multiple categories. For example:

**Example Review:**
> "The packaging was badly damaged when it arrived, but the product itself is excellent quality and great value for money. I use it daily and it works better than the expensive brand I used before."

**This single review would generate insights in:**
- **Category 2**: Packaging & Shipping Experiences (damaged packaging)
- **Category 1**: Product Quality Issues (excellent quality)
- **Category 4**: Value for Money Judgments (great value)
- **Category 7**: Competitor Comparisons (better than expensive brand)
- **Category 10**: Usage Patterns & Frequency (daily use)

### 2. Data Structure Supports Multiple Insights

The data structure is designed for flexibility:
```typescript
export interface CategoryInsights {
  [category: string]: {
    insights: ProcessedInsight[];  // Array allows multiple insights per category
  };
}
```

### 3. How It Works in Practice

1. **Per Batch**: Each batch of 200 reviews is analyzed together
2. **AI Extraction**: GPT-4o-mini extracts ALL relevant insights across ALL categories
3. **Consolidation**: Similar insights are merged, keeping all unique quotes

### 4. Example JSON Output

A single review might contribute to the output like this:

```json
{
  "Packaging & Shipping Experiences": {
    "insights": [{
      "quotes": ["The packaging was badly damaged when it arrived"],
      "context": "Multiple customers report damaged packaging on arrival",
      "pattern": "Damaged packaging"
    }]
  },
  "Product Quality Issues": {
    "insights": [{
      "quotes": ["the product itself is excellent quality"],
      "context": "Despite shipping issues, product quality is praised",
      "pattern": "Excellent quality"
    }]
  },
  "Value for Money Judgments": {
    "insights": [{
      "quotes": ["great value for money"],
      "context": "Customers find the product offers good value",
      "pattern": "Great value"
    }]
  }
}
```

### 5. Limitations

- The system groups insights by category, not by individual review
- You won't see "Review #123 had 5 insights" - instead you'll see insights grouped by theme
- The consolidation phase merges similar insights, so duplicate patterns are combined

### 6. Maximizing Insight Extraction

To ensure maximum insight extraction:
1. The prompt specifically instructs: "Extract as many relevant quotes as possible"
2. All 12 categories are checked for every batch
3. The AI is instructed to capture ALL relevant quotes verbatim
4. No limit on insights per category or per review