'use client';

import React from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';

interface CostEstimateProps {
  reviewCount: number;
  promptLength: number;
}

export function CostEstimate({ reviewCount, promptLength }: CostEstimateProps) {
  // Average review length (estimated)
  const avgReviewLength = 150; // characters
  const batchSize = 200; // Updated to match ReviewProcessor
  const batches = Math.ceil(reviewCount / batchSize);
  
  // Estimate tokens
  // Prompt tokens: prompt template + reviews
  const reviewsTextLength = reviewCount * avgReviewLength;
  const totalPromptChars = (promptLength + reviewsTextLength / batches) * batches;
  const estimatedPromptTokens = Math.ceil(totalPromptChars / 4);
  
  // Completion tokens (rough estimate - usually less than prompt)
  const estimatedCompletionTokens = Math.ceil(estimatedPromptTokens * 0.3);
  
  // Calculate costs (GPT-4o-mini pricing for batches)
  const batchInputCost = (estimatedPromptTokens / 1_000_000) * 0.15;
  const batchOutputCost = (estimatedCompletionTokens / 1_000_000) * 0.60;
  const batchTotalCost = batchInputCost + batchOutputCost;
  
  // Estimate GPT-4o consolidation cost
  // Rough estimate: consolidated output is about 20% of total completion tokens
  const consolidationInputTokens = Math.ceil(estimatedCompletionTokens * 0.2);
  const consolidationOutputTokens = Math.ceil(consolidationInputTokens * 0.3);
  const consolidationCost = 
    (consolidationInputTokens / 1_000_000) * 2.50 +  // GPT-4o input
    (consolidationOutputTokens / 1_000_000) * 10.00; // GPT-4o output
  
  const totalCost = batchTotalCost + consolidationCost;
  
  // Add 20% buffer for safety
  const estimatedCostWithBuffer = totalCost * 1.2;
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        Estimated Cost
      </h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-blue-700">Batches to process:</p>
          <p className="font-semibold text-blue-900">{batches}</p>
          <p className="text-xs text-blue-600">({batchSize} reviews/batch)</p>
        </div>
        
        <div>
          <p className="text-blue-700">Estimated tokens:</p>
          <p className="font-semibold text-blue-900">
            ~{((estimatedPromptTokens + estimatedCompletionTokens) / 1000).toFixed(1)}k
          </p>
        </div>
      </div>
      
      <div className="bg-white/50 rounded p-3">
        <div className="flex items-center justify-between">
          <span className="text-blue-700">Estimated cost:</span>
          <span className="text-lg font-bold text-blue-900">
            ${estimatedCostWithBuffer.toFixed(3)}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-blue-200 text-xs space-y-1">
          <div className="flex justify-between text-blue-600">
            <span>Batch processing (GPT-4o-mini):</span>
            <span>${batchTotalCost.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-blue-600">
            <span>AI consolidation (GPT-4o):</span>
            <span>${consolidationCost.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-blue-700 font-medium pt-1">
            <span>Total (with 20% buffer):</span>
            <span>${estimatedCostWithBuffer.toFixed(3)}</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-blue-600 space-y-1">
        <p className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Actual cost depends on review length and response size
        </p>
        {reviewCount > 6000 && (
          <p className="text-orange-600 font-medium">
            ⚠️ Processing time: ~{Math.ceil(batches * 10 / 60)} minutes (may exceed 5-minute limit)
          </p>
        )}
      </div>
    </div>
  );
}