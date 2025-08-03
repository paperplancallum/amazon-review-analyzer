'use client';

import React, { useState, useRef } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PromptEditor } from '@/components/PromptEditor';
import { ProcessingDashboard } from '@/components/ProcessingDashboard';
import { ReportViewer } from '@/components/ReportViewerNew';
import { CostEstimate } from '@/components/CostEstimate';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Square } from 'lucide-react';
import { DEFAULT_PROMPT_TEMPLATE } from '@/lib/promptManager';
import { CategoryInsights } from '@/lib/promptManager';

interface ProcessingUpdate {
  currentBatch: number;
  totalBatches: number;
  status: string;
  tokensUsed?: number;
  estimatedCost?: number;
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

    // Check for hard limit to prevent timeouts
    if (reviewPreview && reviewPreview.totalReviews > 6000) {
      const proceed = confirm(
        `Warning: You're attempting to process ${reviewPreview.totalReviews} reviews, which exceeds the recommended limit of 6,000 reviews for Vercel's 5-minute timeout.\n\n` +
        `This will likely result in a timeout error.\n\n` +
        `We strongly recommend splitting your data into multiple files with no more than 6,000 reviews each.\n\n` +
        `Do you still want to proceed?`
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

      // Step 2: Process reviews with the prompt
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviews: uploadData.allReviews,
          promptTemplate: prompt,
          userApiKey: userApiKey,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to process reviews');
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'progress') {
                setProcessingUpdate({
                  currentBatch: data.currentBatch,
                  totalBatches: data.totalBatches,
                  status: data.status,
                  tokensUsed: data.tokensUsed,
                  estimatedCost: data.estimatedCost,
                });
              } else if (data.type === 'complete') {
                setResults(data.results);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Failed to parse line:', line, e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      if ((error as Error).name === 'AbortError') {
        setProcessingUpdate({
          currentBatch: processingUpdate?.currentBatch || 0,
          totalBatches: processingUpdate?.totalBatches || 0,
          status: 'Analysis stopped by user',
        });
      } else {
        alert(error instanceof Error ? error.message : 'An error occurred during processing');
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
          {/* Left: File Upload */}
          <div className="bg-white rounded-lg shadow p-6">
            <FileUpload 
              onFilesSelected={handleFilesSelected}
              files={files}
              onRemoveFile={handleRemoveFile}
            />
          </div>

          {/* Right: Prompt Editor */}
          <div className="bg-white rounded-lg shadow p-6">
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
            
            {/* Timeout warning for large datasets */}
            {reviewPreview.totalReviews > 6000 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Large Dataset Warning:</strong> Processing {reviewPreview.totalReviews} reviews may take up to {Math.ceil(reviewPreview.totalReviews / 200 * 10 / 60)} minutes. 
                  For datasets over 6,000 reviews, consider splitting into smaller files to avoid Vercel&apos;s 5-minute timeout limit.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Process Button */}
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