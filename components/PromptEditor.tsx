'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, FileText, Key } from 'lucide-react';
import { DEFAULT_PROMPT_TEMPLATE } from '@/lib/promptManager';

interface PromptEditorProps {
  onPromptChange: (prompt: string) => void;
  onApiKeyChange?: (apiKey: string) => void;
  initialPrompt?: string;
}

export function PromptEditor({ onPromptChange, onApiKeyChange, initialPrompt = DEFAULT_PROMPT_TEMPLATE }: PromptEditorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [savedTemplates, setSavedTemplates] = useState<{ name: string; template: string }[]>([]);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // Load saved templates from localStorage
    const saved = localStorage.getItem('savedPromptTemplates');
    if (saved) {
      setSavedTemplates(JSON.parse(saved));
    }
    
    // Load saved API key from localStorage
    const savedApiKey = localStorage.getItem('openaiApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      if (onApiKeyChange) {
        onApiKeyChange(savedApiKey);
      }
    }
    
    // Check if there's a pre-configured API key (from environment)
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.hasApiKey && !savedApiKey) {
          setApiKey('sk-...' + '*'.repeat(40)); // Show masked version
        }
      })
      .catch(() => {
        // No pre-configured key
      });
  }, [onApiKeyChange]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    onPromptChange(value);
  };

  const saveTemplate = () => {
    const name = window.prompt('Enter a name for this template:');
    if (name) {
      const newTemplates = [...savedTemplates, { name, template: prompt }];
      setSavedTemplates(newTemplates);
      localStorage.setItem('savedPromptTemplates', JSON.stringify(newTemplates));
    }
  };

  const loadTemplate = (template: string) => {
    handlePromptChange(template);
  };

  const resetToDefault = () => {
    handlePromptChange(DEFAULT_PROMPT_TEMPLATE);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    
    // Save to localStorage if it's a valid key format
    if (value.startsWith('sk-') && value.length > 20) {
      localStorage.setItem('openaiApiKey', value);
    } else if (value === '') {
      localStorage.removeItem('openaiApiKey');
    }
    
    if (onApiKeyChange) {
      onApiKeyChange(value);
    }
  };


  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Prompt Template</h2>
        <div className="flex gap-2">
          <Button onClick={resetToDefault} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button onClick={saveTemplate} variant="outline" size="sm">
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {savedTemplates.length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">Saved Templates</label>
          <div className="flex flex-wrap gap-2">
            {savedTemplates.map((template, index) => (
              <Button
                key={index}
                onClick={() => loadTemplate(template.template)}
                variant="outline"
                size="sm"
              >
                <FileText className="w-3 h-3 mr-1" />
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="h-[300px] overflow-hidden">
        <textarea
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="w-full h-full overflow-y-auto p-4 font-mono text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your prompt template here..."
        />
      </div>

      <div className="mt-4 space-y-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Available variables:</strong> {'{{reviews}}'} - Will be replaced with the actual review content
          </p>
          <p className="text-xs text-gray-600 mt-1">
            <strong>Prompt template tokens:</strong> ~{Math.ceil(prompt.length / 4)} tokens
          </p>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
            <Key className="w-3 h-3" />
            OpenAI API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={apiKey.startsWith('sk-...') ? 'Using server API key' : 'Enter your OpenAI API key'}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={apiKey.startsWith('sk-...') && apiKey.includes('*')}
          />
          {apiKey.startsWith('sk-...') && apiKey.includes('*') && (
            <p className="text-xs text-gray-500 mt-1">
              API key is pre-configured on the server
            </p>
          )}
          {apiKey.startsWith('sk-') && !apiKey.includes('*') && apiKey.length > 20 && (
            <p className="text-xs text-green-600 mt-1">
              ✓ API key saved locally
            </p>
          )}
        </div>
      </div>
    </div>
  );
}