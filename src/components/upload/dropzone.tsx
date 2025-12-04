'use client';

import { useCallback, useState } from 'react';
import { Upload, FileImage, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadedFile } from '@/types';

interface DropzoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

/**
 * Drag-and-drop file upload zone for pile test field sheets.
 * Why: Primary entry point for the app - engineers photograph handwritten
 * data sheets and need a clear, large target for uploading multiple pages.
 */
export function Dropzone({ files, onFilesChange, maxFiles = 10 }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;

      setError(null);
      const validFiles: UploadedFile[] = [];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

      Array.from(newFiles).forEach((file) => {
        if (!allowedTypes.includes(file.type)) {
          setError('Only images (JPG, PNG, WebP) and PDFs are allowed');
          return;
        }

        if (file.size > 20 * 1024 * 1024) {
          setError('Files must be under 20MB');
          return;
        }

        validFiles.push({
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
      });

      if (files.length + validFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      onFilesChange([...files, ...validFiles]);
    },
    [files, maxFiles, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      e.target.value = '';
    },
    [processFiles]
  );

  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = files.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange]
  );

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center',
          'min-h-[280px] rounded-2xl border-2 border-dashed',
          'cursor-pointer transition-all duration-200',
          'bg-gradient-to-b from-slate-50 to-white',
          isDragging
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80'
        )}
      >
        <input
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={handleFileInput}
        />

        {/* Upload Icon with animated ring */}
        <div
          className={cn(
            'mb-5 rounded-full p-5 transition-all duration-300',
            isDragging
              ? 'bg-blue-100 ring-4 ring-blue-200'
              : 'bg-slate-100 group-hover:bg-blue-50'
          )}
        >
          <Upload
            className={cn(
              'h-10 w-10 transition-colors',
              isDragging ? 'text-blue-600' : 'text-slate-400'
            )}
            strokeWidth={1.5}
          />
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">
            {isDragging ? 'Drop files here' : 'Drop field sheets here'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            or <span className="font-medium text-blue-600">browse files</span>
          </p>
        </div>

        {/* File type hints */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <FileImage className="h-3.5 w-3.5" /> JPG, PNG, WebP
          </span>
          <span className="h-3 w-px bg-slate-300" />
          <span>PDF</span>
          <span className="h-3 w-px bg-slate-300" />
          <span>Max 20MB each</span>
        </div>
      </label>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Uploaded Files ({files.length})
            </h3>
            {files.length > 1 && (
              <button
                onClick={() => {
                  files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
                  onFilesChange([]);
                }}
                className="text-xs font-medium text-rose-500 hover:text-rose-600"
              >
                Remove all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {files.map((file) => (
              <div
                key={file.id}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              >
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-3">
                    <div className="rounded-lg bg-rose-100 p-3">
                      <FileImage className="h-6 w-6 text-rose-500" />
                    </div>
                    <span className="mt-2 text-center text-xs font-medium text-slate-600">
                      PDF
                    </span>
                  </div>
                )}

                {/* File name overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-2 pt-6">
                  <p className="truncate text-xs font-medium text-white">
                    {file.file.name}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFile(file.id)}
                  className={cn(
                    'absolute right-1.5 top-1.5 rounded-full bg-slate-900/70 p-1.5',
                    'opacity-0 transition-opacity group-hover:opacity-100',
                    'hover:bg-rose-500'
                  )}
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

