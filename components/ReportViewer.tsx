'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Quote, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryInsights } from '@/lib/promptManager';

interface ReportViewerProps {
  results: CategoryInsights;
}

export function ReportViewer({ results }: ReportViewerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
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
    let csv = 'Category,Pattern,Context,Quotes\n';
    
    Object.entries(results).forEach(([category, data]) => {
      data.insights.forEach(insight => {
        const quotesStr = insight.quotes.join(' | ');
        csv += `"${category}","${insight.pattern}","${insight.context}","${quotesStr}"\n`;
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

  // Filter categories based on search
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analysis Results</h2>
        <div className="flex gap-2">
          <Button onClick={exportAsJSON} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Export JSON
          </Button>
          <Button onClick={exportAsCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
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

      {/* Categories */}
      <div className="space-y-4">
        {filteredResults.map(([category, data]) => (
          <div key={category} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{category}</span>
                <span className="text-sm text-gray-600">
                  ({data.insights.length} insight{data.insights.length !== 1 ? 's' : ''})
                </span>
              </div>
              {expandedCategories.has(category) ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>

            {expandedCategories.has(category) && (
              <div className="p-4 space-y-4">
                {data.insights.map((insight, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 space-y-2">
                    {/* Pattern */}
                    <div className="flex items-start gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Pattern Identified:</p>
                        <p className="text-sm">{insight.pattern}</p>
                      </div>
                    </div>

                    {/* Context */}
                    <div>
                      <p className="font-medium text-gray-700">Context:</p>
                      <p className="text-sm text-gray-600">{insight.context}</p>
                    </div>

                    {/* Quotes */}
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Customer Quotes ({insight.quotes.length}):</p>
                      <div className="space-y-2">
                        {insight.quotes.map((quote, quoteIndex) => (
                          <div key={quoteIndex} className="flex items-start gap-2 bg-gray-50 p-2 rounded">
                            <Quote className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm italic text-gray-700">&ldquo;{quote}&rdquo;</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
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
    </div>
  );
}