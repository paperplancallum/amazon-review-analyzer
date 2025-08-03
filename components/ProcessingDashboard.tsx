'use client';

import React from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ProcessingUpdate {
  currentBatch: number;
  totalBatches: number;
  status: string;
  tokensUsed?: number;
  estimatedCost?: number;
  reviewsProcessed?: number;
  totalReviews?: number;
}

interface ProcessingDashboardProps {
  update: ProcessingUpdate | null;
  isProcessing: boolean;
}

export function ProcessingDashboard({ update, isProcessing }: ProcessingDashboardProps) {
  if (!isProcessing && !update) {
    return null;
  }

  const progress = update ? (update.currentBatch / update.totalBatches) * 100 : 0;

  return (
    <div className="mt-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Processing Status</h2>
      
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">
              Batch {update?.currentBatch || 0} of {update?.totalBatches || 0}
              {update?.reviewsProcessed && update?.totalReviews && (
                <span className="ml-2 text-blue-600 font-medium">
                  ({update.reviewsProcessed}/{update.totalReviews} reviews)
                </span>
              )}
            </span>
            <span className="text-gray-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status Message */}
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : progress === 100 ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-600" />
          )}
          <span className="text-sm">{update?.status || 'Initializing...'}</span>
        </div>

        {/* Token and Cost Info */}
        {(update?.tokensUsed || update?.estimatedCost || update?.reviewsProcessed) && (
          <div className="grid grid-cols-3 gap-4 pt-3 border-t">
            {update.reviewsProcessed && (
              <div>
                <p className="text-sm text-gray-600">Reviews Processed</p>
                <p className="text-lg font-semibold">{update.reviewsProcessed.toLocaleString()}</p>
              </div>
            )}
            {update.tokensUsed && (
              <div>
                <p className="text-sm text-gray-600">Tokens Used</p>
                <p className="text-lg font-semibold">{update.tokensUsed.toLocaleString()}</p>
              </div>
            )}
            {update.estimatedCost !== undefined && (
              <div>
                <p className="text-sm text-gray-600">Estimated Cost</p>
                <p className="text-lg font-semibold">${update.estimatedCost.toFixed(4)}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}