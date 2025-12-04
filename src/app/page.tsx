'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dropzone } from '@/components/upload/dropzone';
import { TestTypeSelect } from '@/components/upload/test-type-select';
import { ArrowRight, FileStack, Zap, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportStore } from '@/store/report-store';
import { extractReadings, checkOCRServerHealth } from '@/lib/ocr-api';
import type { TestType, UploadedFile } from '@/types';

/**
 * Upload page - Entry point for pile load test report generation.
 * Why: This is the first step in the workflow. Field engineers upload photos
 * of handwritten data sheets, select the test type, then proceed to OCR extraction.
 */
export default function UploadPage() {
  const router = useRouter();
  
  // Store state
  const {
    uploadedFiles,
    testType,
    isLoading,
    error,
    setFiles,
    setTestType,
    setProjectInfo,
    setReadings,
    setStep,
    setLoading,
    setError,
  } = useReportStore();

  // Local state for server health
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Check OCR server health on mount
  useEffect(() => {
    checkOCRServerHealth().then(setServerOnline);
  }, []);

  const canProceed = uploadedFiles.length > 0 && testType !== null && !isLoading;

  /**
   * Handle extract readings button click.
   * Why: Sends files to OCR server, stores results, and navigates to verify page.
   */
  const handleExtract = async () => {
    if (!canProceed) return;

    setLoading(true);
    setError(null);

    try {
      // Extract File objects from UploadedFile wrappers
      const files = uploadedFiles.map((uf) => uf.file);
      
      const result = await extractReadings(files);
      
      // Store extracted data
      setProjectInfo(result.projectInfo);
      setReadings(result.readings);
      setStep('verify');
      
      // Navigate to verify page
      router.push('/verify');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract readings';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Wrapper for setFiles that updates store.
   * Why: Dropzone expects a simple callback, store needs UploadedFile[].
   */
  const handleFilesChange = (files: UploadedFile[]) => {
    setFiles(files);
    // Clear any previous error when files change
    if (error) setError(null);
  };

  /**
   * Wrapper for setTestType that updates store.
   * Why: TestTypeSelect expects (type: TestType | null) => void.
   */
  const handleTestTypeChange = (type: TestType | null) => {
    setTestType(type);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
              <FileStack className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">
                <span className="text-blue-600">PILE</span>
                <span className="text-slate-800">TEST</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Server Status Indicator */}
            {serverOnline !== null && (
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  serverOnline
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    serverOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  )}
                />
                {serverOnline ? 'OCR Ready' : 'OCR Offline'}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>IS 2911 Compliant</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">
            Upload Field Readings
          </h2>
          <p className="mt-2 text-slate-500">
            Upload photos of handwritten pile load test data sheets. We&apos;ll extract
            the readings using OCR for verification.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-medium text-rose-800">Extraction Failed</p>
              <p className="mt-1 text-sm text-rose-600">{error}</p>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="space-y-8">
          {/* Dropzone Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <span className="text-sm font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-lg font-bold text-slate-700">
                Upload Data Sheets
              </h3>
            </div>

            <Dropzone files={uploadedFiles} onFilesChange={handleFilesChange} />
          </section>

          {/* Test Type Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <span className="text-sm font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-lg font-bold text-slate-700">
                Select Test Type
              </h3>
            </div>

            <TestTypeSelect value={testType} onChange={handleTestTypeChange} />
          </section>

          {/* Action Bar */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">
              {uploadedFiles.length === 0 ? (
                <span>No files uploaded</span>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-slate-700">
                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} ready
                    {testType && (
                      <span className="ml-2 text-slate-500">
                        • {testType} test
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleExtract}
              disabled={!canProceed || serverOnline === false}
              className={cn(
                'flex items-center gap-2 rounded-lg px-6 py-3 font-semibold',
                'transition-all duration-200',
                canProceed && serverOnline !== false
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  Extract Readings
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-10 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-white/10 p-3">
              <FileStack className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold">How it works</h4>
              <p className="mt-1 text-sm text-slate-300">
                Upload your handwritten field sheets → Our OCR extracts pressure
                and dial gauge readings → Review and edit the data → Generate
                professional IS 2911-compliant PDF reports.
              </p>
            </div>
          </div>
        </div>

        {/* Server Offline Warning */}
        {serverOnline === false && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium text-amber-800">OCR Server Offline</p>
                <p className="mt-1 text-sm text-amber-700">
                  The OCR extraction server is not responding. Please ensure it&apos;s running:
                </p>
                <pre className="mt-2 rounded bg-amber-100 p-2 text-xs text-amber-800">
                  cd ocr-server && pip install -r requirements.txt && python main.py
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
