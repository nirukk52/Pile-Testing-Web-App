'use client';

/**
 * Report Preview Page
 * Why: Full-page preview of the final PDF report before download.
 * Shows exact HTML that will be converted to PDF.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useTestStore } from '@/store/test-store';
import { TEST_TYPES } from '@/types';

/**
 * Report Preview Page Component.
 */
export default function ReportPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Get data from store
  const currentTestId = useTestStore((s) => s.currentTestId);
  const projectInfo = useTestStore((s) => s.projectInfo);

  // Get test type config for header display
  const testTypeConfig = TEST_TYPES.find((t) => t.id === projectInfo.testType);

  // Fetch report HTML preview
  useEffect(() => {
    const fetchPreview = async () => {
      if (!currentTestId) {
        setIsLoadingPreview(false);
        return;
      }

      setIsLoadingPreview(true);
      try {
        const response = await fetch(`/api/tests/${currentTestId}/preview`);
        if (response.ok) {
          const html = await response.text();
          setReportHtml(html);
        } else {
          setError('Failed to load report preview');
        }
      } catch (err) {
        console.error('Failed to fetch preview:', err);
        setError('Failed to load report preview');
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [currentTestId]);

  /**
   * Handle print.
   */
  const handlePrint = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  }, []);

  /**
   * Generate and download PDF.
   */
  const handleDownload = useCallback(async () => {
    if (!currentTestId) {
      setError('Test must be saved first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/tests/${currentTestId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const { filename, pdfBase64 } = await response.json();

      // Convert base64 to blob and download
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  }, [currentTestId]);

  // Redirect if no test data
  if (!projectInfo.pileId && !currentTestId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">No Test Selected</h2>
          <p className="text-slate-500 mb-4">Please select or create a test first.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Report Preview</h1>
            <p className="text-slate-400 text-xs">
              {testTypeConfig?.fullName || 'IVPLT'} - {projectInfo.pileId || 'New Test'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownload}
            disabled={isGenerating || !currentTestId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <PreviewTab
          reportHtml={reportHtml}
          isLoading={isLoadingPreview}
          iframeRef={iframeRef}
        />
      </main>
    </div>
  );
}

/**
 * Preview Tab - Shows the actual PDF HTML in an iframe.
 */
function PreviewTab({
  reportHtml,
  isLoading,
  iframeRef,
}: {
  reportHtml: string;
  isLoading: boolean;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!reportHtml) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">Unable to load preview. Please save your test first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-200 p-4">
      <iframe
        ref={iframeRef}
        srcDoc={reportHtml}
        className="w-full h-full bg-white shadow-lg rounded-lg"
        title="Report Preview"
      />
    </div>
  );
}

