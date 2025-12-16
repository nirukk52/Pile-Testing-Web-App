'use client';

/**
 * Report Preview Page
 * Why: Full-page preview of the final PDF report before download.
 * Shows exact HTML that will be converted to PDF.
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useTestStore } from '@/store/test-store';
import { getTestEngine } from '@/engines';
import type { ReadingInput, TestMeta, TestType, CalculationResult } from '@/engines';
import { TEST_TYPES, calculateAverageSettlement } from '@/types';
import type { LoadEntry, LegacyProjectInfo } from '@/types';

/**
 * Report Preview Page Component.
 */
export default function ReportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'preview' | 'modern'>('preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Get data from store
  const currentTestId = useTestStore((s) => s.currentTestId);
  const projectInfo = useTestStore((s) => s.projectInfo);
  const loadEntries = useTestStore((s) => s.loadEntries);

  // Get test type config
  const testTypeConfig = useMemo(() => {
    return TEST_TYPES.find((t) => t.id === projectInfo.testType);
  }, [projectInfo.testType]);

  // Calculate results using engine
  const { result, testMeta, readingInputs } = useMemo(() => {
    const testType = (projectInfo.testType || 'IVPLT') as TestType;
    const engine = getTestEngine(testType);
    const testTypeConfig = TEST_TYPES.find(t => t.id === testType);

    // Convert legacy entries to engine input format (same as report-view.tsx)
    const inputs: ReadingInput[] = [];
    let sequence = 1;

    loadEntries.forEach((entry) => {
      entry.readings.forEach((reading) => {
        const avgStr = calculateAverageSettlement(
          reading.dialGauge1,
          reading.dialGauge2,
          reading.dialGauge3,
          reading.dialGauge4
        );
        const avgNum = parseFloat(avgStr);
        const loadNum = parseFloat(entry.load);

        if (!isNaN(avgNum) && !isNaN(loadNum)) {
          const phaseMap: Record<string, 'LOADING' | 'HOLD' | 'UNLOADING'> = {
            loading: 'LOADING',
            holding: 'HOLD',
            unloading: 'UNLOADING',
          };

          inputs.push({
            sequence: sequence++,
            phase: phaseMap[reading.phase] || 'LOADING',
            loadT: loadNum,
            avgSettlementMm: avgNum,
          });
        }
      });
    });

    const meta: TestMeta = {
      pileDiameterMm: parseFloat(projectInfo.pileDiameter) || 600,
      pileDepthM: parseFloat(projectInfo.pileDepth) || 10,
      designLoadT: parseFloat(projectInfo.designLoadOnPile) || 100,
      testLoadT: parseFloat(projectInfo.testLoad) || parseFloat(projectInfo.designLoadOnPile) * (testTypeConfig?.loadMultiplier || 2.5),
      ramAreaCm2: parseFloat(projectInfo.ramArea) || 71.26,
    };

    const calculatedResult = inputs.length > 0 ? engine.calculate(inputs, meta) : null;

    return { result: calculatedResult, testMeta: meta, readingInputs: inputs };
  }, [loadEntries, projectInfo]);

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
    if (activeTab === 'preview' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  }, [activeTab]);

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
    <div className="min-h-screen bg-gray-100 flex flex-col">
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

        {/* Tab Switcher */}
        <div className="flex bg-slate-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-white text-slate-800'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('modern')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'modern'
                ? 'bg-white text-slate-800'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Modern Preview
          </button>
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
        {activeTab === 'preview' ? (
          <PreviewTab
            reportHtml={reportHtml}
            isLoading={isLoadingPreview}
            iframeRef={iframeRef}
          />
        ) : (
          <ModernPreviewTab
            projectInfo={projectInfo}
            result={result}
            testMeta={testMeta}
            testTypeConfig={testTypeConfig}
            loadEntries={loadEntries}
          />
        )}
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

/**
 * Modern Preview Tab - Web-friendly styled view.
 */
function ModernPreviewTab({
  projectInfo,
  result,
  testMeta,
  testTypeConfig,
  loadEntries,
}: {
  projectInfo: LegacyProjectInfo;
  result: CalculationResult | null;
  testMeta: TestMeta;
  testTypeConfig?: { id: string; name: string; fullName: string; loadMultiplier: number };
  loadEntries: LoadEntry[];
}) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">No readings recorded yet. Add readings to see the preview.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Pass/Fail Banner */}
      <div
        className={`rounded-xl p-6 text-center ${
          result.isPassed
            ? 'bg-green-50 border-2 border-green-200'
            : 'bg-red-50 border-2 border-red-200'
        }`}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className={`text-4xl font-bold ${result.isPassed ? 'text-green-700' : 'text-red-700'}`}>
            TEST {result.isPassed ? 'PASSED ✓' : 'FAILED ✗'}
          </span>
        </div>
        <p className={`text-lg ${result.isPassed ? 'text-green-600' : 'text-red-600'}`}>
          Net Settlement: {result.netSettlementMm.toFixed(2)}mm (Limit: {result.settlementLimitMm}mm)
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Test Load</p>
          <p className="text-2xl font-bold text-slate-800">{testMeta.testLoadT.toFixed(1)} MT</p>
          <p className="text-xs text-blue-600">{testTypeConfig?.loadMultiplier || 2.5}× Design</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Max Settlement</p>
          <p className="text-2xl font-bold text-slate-800">{result.maxSettlementMm.toFixed(2)} mm</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Elastic Rebound</p>
          <p className="text-2xl font-bold text-slate-800">{result.elasticReboundMm.toFixed(2)} mm</p>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border-2 ${
          result.isPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Net Settlement</p>
          <p className={`text-2xl font-bold ${result.isPassed ? 'text-green-700' : 'text-red-700'}`}>
            {result.netSettlementMm.toFixed(2)} mm
          </p>
          <p className={`text-xs ${result.isPassed ? 'text-green-600' : 'text-red-600'}`}>
            Limit: {result.settlementLimitMm}mm
          </p>
        </div>
      </div>

      {/* Project Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Project Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Project</p>
            <p className="font-medium">{projectInfo.project || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Location</p>
            <p className="font-medium">{projectInfo.location || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Pile ID</p>
            <p className="font-medium">{projectInfo.pileId || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Diameter</p>
            <p className="font-medium">{projectInfo.pileDiameter || '-'} mm</p>
          </div>
          <div>
            <p className="text-slate-500">Depth</p>
            <p className="font-medium">{projectInfo.pileDepth || '-'} m</p>
          </div>
          <div>
            <p className="text-slate-500">Design Load</p>
            <p className="font-medium">{testMeta.designLoadT.toFixed(1)} MT</p>
          </div>
        </div>
      </div>

      {/* Readings Table */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Load Test Readings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Phase</th>
                <th className="text-right py-2 px-2">Load (MT)</th>
                <th className="text-right py-2 px-2">Settlement (mm)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let seq = 0;
                return loadEntries.flatMap((entry) =>
                  entry.readings.map((reading) => {
                    seq++;
                    const phaseColors: Record<string, string> = {
                      loading: 'bg-blue-100 text-blue-700',
                      holding: 'bg-amber-100 text-amber-700',
                      unloading: 'bg-green-100 text-green-700',
                    };
                    return (
                      <tr key={reading.id} className="border-b">
                        <td className="py-2 px-2">{seq}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${phaseColors[reading.phase] || 'bg-slate-100 text-slate-700'}`}>
                            {reading.phase.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{parseFloat(entry.load).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono">
                          {calculateAverageSettlement(
                            reading.dialGauge1,
                            reading.dialGauge2,
                            reading.dialGauge3,
                            reading.dialGauge4
                          )}
                        </td>
                      </tr>
                    );
                  })
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
