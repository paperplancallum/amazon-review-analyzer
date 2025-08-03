'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Quote, Copy, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryInsights } from '@/lib/promptManager';

interface ReportViewerProps {
  results: CategoryInsights;
  originalReviews?: Array<{
    content: string;
    rating?: number;
    title?: string;
    asin?: string;
  }>;
}

export function ReportViewer({ results, originalReviews = [] }: ReportViewerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleInsight = (insightId: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightId)) {
      newExpanded.delete(insightId);
    } else {
      newExpanded.add(insightId);
    }
    setExpandedInsights(newExpanded);
  };

  const exportAsJSON = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'review-insights.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsCSV = () => {
    let csv = 'Category,Pattern,Context,Number of Quotes,Sample Quote\n';
    
    Object.entries(results).forEach(([category, data]) => {
      data.insights.forEach(insight => {
        const sampleQuote = insight.quotes[0] || '';
        csv += `"${category}","${insight.pattern}","${insight.context}","${insight.quotes.length}","${sampleQuote}"\n`;
      });
    });

    const dataUri = 'data:text/csv;charset=utf-8,'+ encodeURIComponent(csv);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'review-insights.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter results based on search
  const filteredResults = Object.entries(results).filter(([category, data]) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return category.toLowerCase().includes(term) ||
           data.insights.some(insight => 
             insight.context.toLowerCase().includes(term) ||
             insight.pattern.toLowerCase().includes(term) ||
             insight.quotes.some(quote => quote.toLowerCase().includes(term))
           );
  });

  // Calculate total insights for summary
  const totalInsights = Object.values(results).reduce((sum, cat) => sum + cat.insights.length, 0);
  const totalQuotes = Object.values(results).reduce((sum, cat) => 
    cat.insights.reduce((catSum, insight) => catSum + insight.quotes.length, 0) + sum, 0
  );

  // Generate Markdown report
  const generateMarkdown = () => {
    const date = new Date().toLocaleDateString();
    let markdown = `# Amazon Review Analysis Report\n\n`;
    markdown += `*Generated on ${date}*\n\n`;
    
    // Summary section
    markdown += `## Executive Summary\n\n`;
    markdown += `- **Total Insights Found:** ${totalInsights}\n`;
    markdown += `- **Customer Quotes Analyzed:** ${totalQuotes}\n`;
    markdown += `- **Categories Covered:** ${Object.keys(results).length}\n\n`;
    
    // Insights by category
    Object.entries(results).forEach(([category, data]) => {
      if (data.insights.length === 0) return;
      
      markdown += `## ${category}\n\n`;
      
      data.insights.forEach((insight, index) => {
        markdown += `### ${index + 1}. ${insight.pattern}\n\n`;
        markdown += `**Context:** ${insight.context}\n\n`;
        
        if (insight.quotes.length > 0) {
          markdown += `**Customer Quotes (${insight.quotes.length}):**\n\n`;
          insight.quotes.forEach(quote => {
            markdown += `> "${quote}"\n\n`;
          });
        }
        
        markdown += `---\n\n`;
      });
    });
    
    return markdown;
  };

  const copyToClipboard = () => {
    const markdown = generateMarkdown();
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadMarkdown = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `review-analysis-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate raw reviews markdown
  const generateRawReviewsMarkdown = () => {
    const date = new Date().toLocaleDateString();
    let markdown = `# Raw Customer Reviews\n\n`;
    markdown += `*Exported on ${date}*\n\n`;
    markdown += `**Total Reviews:** ${originalReviews.length}\n\n`;
    
    // Group reviews by ASIN
    const reviewsByAsin: { [key: string]: typeof originalReviews } = {};
    originalReviews.forEach(review => {
      const asin = review.asin || 'No ASIN';
      if (!reviewsByAsin[asin]) {
        reviewsByAsin[asin] = [];
      }
      reviewsByAsin[asin].push(review);
    });
    
    // Generate markdown for each ASIN group
    Object.entries(reviewsByAsin).forEach(([asin, reviews]) => {
      markdown += `## ASIN: ${asin}\n\n`;
      
      reviews.forEach((review, index) => {
        markdown += `### Review ${index + 1}\n\n`;
        
        if (review.rating) {
          const stars = '⭐'.repeat(Math.round(review.rating));
          markdown += `**Rating:** ${stars} (${review.rating}/5)\n\n`;
        }
        
        if (review.title) {
          markdown += `**Title:** ${review.title}\n\n`;
        }
        
        markdown += `**Content:** ${review.content}\n\n`;
        markdown += `---\n\n`;
      });
    });
    
    return markdown;
  };

  const downloadRawReviews = () => {
    const markdown = generateRawReviewsMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raw-reviews-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
            <p className="text-gray-600 mt-1">
              Found {totalInsights} key insights from {totalQuotes} customer quotes
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportAsJSON} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export JSON
            </Button>
            <Button onClick={exportAsCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
            {originalReviews.length > 0 && (
              <Button onClick={downloadRawReviews} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Raw Reviews
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white/70 rounded p-3">
            <p className="text-sm text-gray-600">Categories Analyzed</p>
            <p className="text-xl font-semibold">{Object.keys(results).length}</p>
          </div>
          <div className="bg-white/70 rounded p-3">
            <p className="text-sm text-gray-600">Total Insights</p>
            <p className="text-xl font-semibold">{totalInsights}</p>
          </div>
          <div className="bg-white/70 rounded p-3">
            <p className="text-sm text-gray-600">Customer Quotes</p>
            <p className="text-xl font-semibold">{totalQuotes}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search insights..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categories with Card-Based Insights */}
      <div className="space-y-4">
        {filteredResults.map(([category, data]) => (
          <div key={category} className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{category}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                  {data.insights.length} insight{data.insights.length !== 1 ? 's' : ''}
                </span>
              </div>
              {expandedCategories.has(category) ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>

            {expandedCategories.has(category) && (
              <div className="p-6 space-y-4">
                {data.insights.map((insight, index) => {
                  const insightId = `${category}-${index}`;
                  const isExpanded = expandedInsights.has(insightId);
                  
                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* Insight Header */}
                      <div 
                        className="cursor-pointer"
                        onClick={() => toggleInsight(insightId)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-lg mb-1">
                              {insight.pattern}
                            </h4>
                            <p className="text-gray-600 text-sm">
                              {insight.context}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="bg-white px-3 py-1 rounded-full text-sm font-medium">
                              {insight.quotes.length} quote{insight.quotes.length !== 1 ? 's' : ''}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Quotes Section */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Quote className="w-4 h-4" />
                            Customer Quotes
                          </h5>
                          <div className="space-y-2">
                            {insight.quotes.map((quote, quoteIndex) => (
                              <div key={quoteIndex} className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-700 italic">
                                  &ldquo;{quote}&rdquo;
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredResults.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No insights found matching your search.
        </div>
      )}

      {/* Markdown Export Section */}
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => setShowMarkdown(!showMarkdown)}
          className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <span className="text-lg font-semibold">Markdown Export</span>
          </div>
          {showMarkdown ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {showMarkdown && (
          <div className="p-6 space-y-4">
            <div className="flex gap-2 justify-end">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button
                onClick={downloadMarkdown}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download as Markdown
              </Button>
            </div>
            
            <div className="relative">
              <textarea
                readOnly
                value={generateMarkdown()}
                className="w-full h-96 p-4 font-mono text-sm border rounded-lg bg-gray-50 resize-none"
                placeholder="Markdown content will appear here..."
              />
            </div>
            
            <p className="text-xs text-gray-500">
              This Markdown format is perfect for sharing via email, Slack, or importing into documentation tools.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}