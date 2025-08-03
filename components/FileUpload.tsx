'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  files: File[];
  onRemoveFile: (index: number) => void;
}

export function FileUpload({ onFilesSelected, files, onRemoveFile }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const excelFiles = acceptedFiles.filter(file => 
      file.name.endsWith('.xlsx') || 
      file.name.endsWith('.xls') || 
      file.name.endsWith('.csv')
    );
    
    if (excelFiles.length !== acceptedFiles.length) {
      alert('Please upload only Excel files (.xlsx, .xls) or CSV files');
    }
    
    onFilesSelected([...files, ...excelFiles]);
  }, [files, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    }
  });

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Upload Reviews</h2>
        <p className="text-sm text-gray-600 mt-1">
          Excel files should contain these columns:
        </p>
        <ul className="text-xs text-gray-500 mt-2 space-y-1">
          <li>• <strong>Content</strong> (or Review/Text/Comment) - Required</li>
          <li>• <strong>Rating</strong> (or Score) - Optional</li>
          <li>• <strong>Title</strong> (or Subject) - Optional</li>
        </ul>
      </div>
      
      <div
        {...getRootProps()}
        className={`flex-1 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-lg">Drop the files here...</p>
        ) : (
          <>
            <p className="text-lg mb-2">Drag & drop Excel files here</p>
            <p className="text-sm text-gray-500">or click to select files</p>
            <p className="text-xs text-gray-400 mt-2">Accepts .xlsx, .xls, .csv files</p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Selected Files ({files.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  onClick={() => onRemoveFile(index)}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}