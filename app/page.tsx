'use client';

import React, { useState, useRef } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PromptEditor } from '@/components/PromptEditor';
import { ProcessingDashboard } from '@/components/ProcessingDashboard';
import { ReportViewer } from '@/components/ReportViewerNew';
import { CostEstimate } from '@/components/CostEstimate';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Square } from 'lucide-react';
import { DEFAULT_PROMPT_TEMPLATE, CategoryInsights, ProcessedInsight } from '@/lib/promptManager';

interface ProcessingUpdate {
  currentBatch: number;
  totalBatches: number;
  status: string;
  tokensUsed?: number;
  estimatedCost?: number;
  reviewsProcessed?: number;
  totalReviews?: number;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingUpdate, setProcessingUpdate] = useState<ProcessingUpdate | null>(null);
  const [results, setResults] = useState<CategoryInsights | null>(null);
  const [reviewPreview, setReviewPreview] = useState<{ totalReviews: number; reviews: Array<{ content: string; rating?: number; title?: string; asin?: string }> } | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [processedReviews, setProcessedReviews] = useState<Array<{ content: string; rating?: number; title?: string; asin?: string }>>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFilesSelected = async (newFiles: File[]) => {
    setFiles(newFiles);
    setReviewPreview(null);
    
    if (newFiles.length > 0) {
      // Upload files to get preview
      const formData = new FormData();
      newFiles.forEach(file => formData.append('files', file));

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setReviewPreview({
            totalReviews: data.totalReviews,
            reviews: data.reviews
          });
        }
      } catch (error) {
        console.error('Failed to get preview:', error);
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (newFiles.length === 0) {
      setReviewPreview(null);
    }
  };

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
  };

  const handleApiKeyChange = (apiKey: string) => {
    setUserApiKey(apiKey);
  };

  const startProcessing = async () => {
    if (files.length === 0) {
      alert('Please upload at least one file');
      return;
    }

    // Updated warning for Edge Runtime - much higher limits
    if (reviewPreview && reviewPreview.totalReviews > 20000) {
      const proceed = confirm(
        `Notice: You're processing ${reviewPreview.totalReviews} reviews.\n\n` +
        `With Edge Runtime streaming, we can handle larger datasets, but processing over 20,000 reviews may take a very long time.\n\n` +
        `For optimal performance, consider splitting into files of 10,000 reviews or less.\n\n` +
        `Do you want to proceed?`
      );
      
      if (!proceed) {
        return;
      }
    }

    setIsProcessing(true);
    setProcessingUpdate(null);
    setResults(null);
    
    // Create new abort controller for this processing session
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Upload files and extract reviews
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload files');
      }

      const uploadData = await uploadResponse.json();
      setProcessedReviews(uploadData.allReviews);

      // Step 2: Process reviews in chunks to avoid timeout
      const allBatchResults: CategoryInsights[] = [];
      let currentBatch = 0;
      const batchSize = 100;
      const totalBatches = Math.ceil(uploadData.allReviews.length / batchSize);
      let totalTokensUsed = 0;
      let totalCost = 0;
      
      // Process in chunks of 5 batches at a time
      const consolidationThreshold = 10; // Consolidate every 10 batch results
      
      while (currentBatch < totalBatches) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Processing aborted');
        }
        
        setProcessingUpdate({
          currentBatch: currentBatch + 1,
          totalBatches,
          status: `Processing batches ${currentBatch + 1} to ${Math.min(currentBatch + 5, totalBatches)} of ${totalBatches}...`,
          tokensUsed: totalTokensUsed,
          estimatedCost: totalCost,
          reviewsProcessed: currentBatch * batchSize,
          totalReviews: uploadData.allReviews.length,
        });
        
        const response = await fetch('/api/process-chunks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviews: uploadData.allReviews,
            promptTemplate: prompt,
            userApiKey: userApiKey,
            startBatch: currentBatch,
            batchCount: 5 // Process 5 batches at a time
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Chunk processing error:', error);
          throw new Error(error.error || 'Failed to process batch');
        }

        const chunkResult = await response.json();
        console.log(`Chunk ${currentBatch}-${currentBatch + 5} completed:`, {
          resultsCount: chunkResult.results?.length,
          nextBatch: chunkResult.nextBatch,
          isComplete: chunkResult.isComplete
        });
        
        if (!chunkResult.results || !Array.isArray(chunkResult.results)) {
          console.error('Invalid chunk result:', chunkResult);
          throw new Error('Invalid response from chunk processing');
        }
        
        allBatchResults.push(...chunkResult.results);
        totalTokensUsed += chunkResult.tokensUsed || 0;
        totalCost += chunkResult.cost || 0;
        currentBatch = chunkResult.nextBatch || totalBatches;
        
        setProcessingUpdate({
          currentBatch: Math.min(currentBatch, totalBatches),
          totalBatches,
          status: `Completed ${Math.min(currentBatch, totalBatches)} of ${totalBatches} batches`,
          tokensUsed: totalTokensUsed,
          estimatedCost: totalCost,
          reviewsProcessed: Math.min(currentBatch * batchSize, uploadData.allReviews.length),
          totalReviews: uploadData.allReviews.length,
        });
        
        // Intermediate consolidation by category to prevent timeout
        if (allBatchResults.length >= consolidationThreshold && currentBatch < totalBatches) {
          setProcessingUpdate({
            currentBatch: Math.min(currentBatch, totalBatches),
            totalBatches,
            status: 'Performing intermediate consolidation...',
            tokensUsed: totalTokensUsed,
            estimatedCost: totalCost,
            reviewsProcessed: Math.min(currentBatch * batchSize, uploadData.allReviews.length),
            totalReviews: uploadData.allReviews.length,
          });
          
          // Merge current batch results
          const tempMerged: CategoryInsights = {};
          for (const batchResult of allBatchResults) {
            if (!batchResult || typeof batchResult !== 'object') {
              console.error('Invalid batch result:', batchResult);
              continue;
            }
            for (const [category, data] of Object.entries(batchResult as CategoryInsights)) {
              // Handle empty categories or nested structures
              if (!data) {
                continue;
              }
              
              // Extract insights array, handling various formats
              let insights: ProcessedInsight[] = [];
              if (Array.isArray(data.insights)) {
                insights = data.insights;
              } else if (data.insights && typeof data.insights === 'object' && 'insights' in data.insights && Array.isArray((data.insights as { insights: ProcessedInsight[] }).insights)) {
                // Handle nested {insights: {insights: [...]}} structure
                insights = (data.insights as { insights: ProcessedInsight[] }).insights;
                console.warn(`Found nested insights structure for ${category}, extracting inner array`);
              } else if (!data.insights) {
                // Empty category - this is valid
                insights = [];
              } else {
                console.error(`Invalid insights format for category ${category}:`, data);
                continue;
              }
              
              if (!tempMerged[category]) {
                tempMerged[category] = { insights: [] };
              }
              if (insights.length > 0) {
                tempMerged[category].insights.push(...insights);
              }
            }
          }
          
          // Consolidate each category
          const tempConsolidated: CategoryInsights = {};
          for (const [category, data] of Object.entries(tempMerged)) {
            try {
              const consolidationResponse = await fetch('/api/consolidate-category', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  category,
                  insights: data.insights,
                  userApiKey: userApiKey,
                }),
                signal: abortControllerRef.current.signal,
              });
              
              if (consolidationResponse.ok) {
                const result = await consolidationResponse.json();
                tempConsolidated[category] = { insights: result.insights };
                totalTokensUsed += result.tokensUsed || 0;
                totalCost += result.cost || 0;
              } else {
                tempConsolidated[category] = data;
              }
            } catch (error) {
              console.error(`Intermediate consolidation error for ${category}:`, error);
              tempConsolidated[category] = data;
            }
          }
          
          // Replace batch results with consolidated version
          allBatchResults.length = 0;
          allBatchResults.push(tempConsolidated);
        }
      }
      
      // Step 3: Consolidate all results by category
      // First, merge all batch results
      const mergedInsights: CategoryInsights = {};
      for (const batchResult of allBatchResults) {
        if (!batchResult || typeof batchResult !== 'object') {
          console.error('Invalid batch result:', batchResult);
          continue;
        }
        for (const [category, data] of Object.entries(batchResult as CategoryInsights)) {
          // Handle empty categories or nested structures
          if (!data) {
            continue;
          }
          
          // Extract insights array, handling various formats
          let insights: ProcessedInsight[] = [];
          if (Array.isArray(data.insights)) {
            insights = data.insights;
          } else if (data.insights && typeof data.insights === 'object' && 'insights' in data.insights && Array.isArray((data.insights as { insights: ProcessedInsight[] }).insights)) {
            // Handle nested {insights: {insights: [...]}} structure
            insights = (data.insights as { insights: ProcessedInsight[] }).insights;
            console.warn(`Found nested insights structure for ${category}, extracting inner array`);
          } else if (!data.insights) {
            // Empty category - this is valid
            insights = [];
          } else {
            console.error(`Invalid insights format for category ${category}:`, data);
            continue;
          }
          
          if (!mergedInsights[category]) {
            mergedInsights[category] = { insights: [] };
          }
          if (insights.length > 0) {
            mergedInsights[category].insights.push(...insights);
          }
        }
      }
      
      // Get all categories that have insights
      const categoriesWithInsights = Object.keys(mergedInsights);
      const consolidatedResults: CategoryInsights = {};
      let categoryIndex = 0;
      
      // Process each category separately
      for (const category of categoriesWithInsights) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Processing aborted');
        }
        
        categoryIndex++;
        setProcessingUpdate({
          currentBatch: totalBatches,
          totalBatches,
          status: `Consolidating ${category} (${categoryIndex}/${categoriesWithInsights.length})...`,
          tokensUsed: totalTokensUsed,
          estimatedCost: totalCost,
          reviewsProcessed: uploadData.allReviews.length,
          totalReviews: uploadData.allReviews.length,
        });
        
        // Skip consolidation for categories with very few insights
        if (mergedInsights[category].insights.length <= 3) {
          console.log(`Skipping consolidation for ${category} (only ${mergedInsights[category].insights.length} insights)`);
          consolidatedResults[category] = mergedInsights[category];
          continue;
        }
        
        try {
          const consolidationResponse = await fetch('/api/consolidate-category', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              category,
              insights: mergedInsights[category].insights,
              userApiKey: userApiKey,
            }),
            signal: abortControllerRef.current.signal,
          });
          
          if (consolidationResponse.ok) {
            const consolidationResult = await consolidationResponse.json();
            consolidatedResults[category] = { insights: consolidationResult.insights };
            totalTokensUsed += consolidationResult.tokensUsed || 0;
            totalCost += consolidationResult.cost || 0;
          } else {
            // If a category fails, use unconsolidated insights
            console.error(`Failed to consolidate ${category}, using raw insights`);
            consolidatedResults[category] = mergedInsights[category];
          }
        } catch (error) {
          console.error(`Error consolidating ${category}:`, error);
          // Use unconsolidated insights for this category
          consolidatedResults[category] = mergedInsights[category];
        }
      }
      
      setResults(consolidatedResults);
      
      setProcessingUpdate({
        currentBatch: totalBatches,
        totalBatches,
        status: 'Analysis complete!',
        tokensUsed: totalTokensUsed,
        estimatedCost: totalCost,
        reviewsProcessed: uploadData.allReviews.length,
        totalReviews: uploadData.allReviews.length,
      });
    } catch (error) {
      console.error('Processing error:', error);
      if ((error as Error).name === 'AbortError') {
        setProcessingUpdate({
          currentBatch: processingUpdate?.currentBatch || 0,
          totalBatches: processingUpdate?.totalBatches || 0,
          status: 'Analysis stopped by user',
        });
      } else {
        console.error('Full processing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An error occurred during processing';
        setProcessingUpdate({
          currentBatch: processingUpdate?.currentBatch || 0,
          totalBatches: processingUpdate?.totalBatches || 0,
          status: `Error: ${errorMessage}`,
          tokensUsed: processingUpdate?.tokensUsed || 0,
          estimatedCost: processingUpdate?.estimatedCost || 0,
          reviewsProcessed: processingUpdate?.reviewsProcessed || 0,
          totalReviews: processingUpdate?.totalReviews || 0,
        });
        alert(errorMessage);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const stopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Amazon Review Analyzer</h1>
          <p className="text-sm text-gray-600 mt-1">Upload reviews and extract actionable insights using AI</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: File Upload */}
          <div className="bg-white rounded-lg shadow p-6 h-fit">
            <FileUpload 
              onFilesSelected={handleFilesSelected}
              files={files}
              onRemoveFile={handleRemoveFile}
            />
          </div>

          {/* Right: Prompt Editor */}
          <div className="bg-white rounded-lg shadow p-6 h-fit">
            <PromptEditor 
              onPromptChange={handlePromptChange}
              onApiKeyChange={handleApiKeyChange}
              initialPrompt={prompt}
            />
          </div>
        </div>

        {/* Review Preview */}
        {reviewPreview && !isProcessing && !results && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-900">
                Ready to analyze {reviewPreview.totalReviews} reviews
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {files.length} file{files.length > 1 ? 's' : ''} uploaded
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-blue-200">
              <CostEstimate 
                reviewCount={reviewPreview.totalReviews} 
                promptLength={prompt.length}
              />
            </div>
            
            {/* Updated warning for Edge Runtime */}
            {reviewPreview.totalReviews > 10000 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Processing Time:</strong> Analyzing {reviewPreview.totalReviews} reviews will take approximately {Math.ceil(reviewPreview.totalReviews / 200 * 10 / 60)} minutes. 
                  Edge Runtime allows extended processing times through streaming. The analysis will continue running even for large datasets.
                </p>
              </div>
            )}
            
            {/* Process Buttons */}
            <div className="mt-6 flex justify-center gap-4">
              <Button
                onClick={startProcessing}
                disabled={isProcessing || files.length === 0}
                size="lg"
                className="min-w-[200px]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Analysis
                  </>
                )}
              </Button>
              
              {isProcessing && (
                <Button
                  onClick={stopProcessing}
                  variant="destructive"
                  size="lg"
                  className="min-w-[150px]"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Analysis
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Processing Dashboard */}
        <ProcessingDashboard 
          update={processingUpdate}
          isProcessing={isProcessing}
        />

        {/* Results */}
        {results && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <ReportViewer results={results} originalReviews={processedReviews} />
          </div>
        )}
      </main>
    </div>
  );
}