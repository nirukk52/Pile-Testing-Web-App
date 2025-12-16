'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Download, CheckCircle2, XCircle, AlertCircle, Loader2, FileText, Sparkles, Edit3, Save, X, RotateCcw, FileOutput } from 'lucide-react';
import type { LoadEntry, LegacyProjectInfo } from '@/types';
import { calculateAverageSettlement, TEST_TYPES } from '@/types';
import { getTestEngine } from '@/engines';
import type { ReadingInput, CalculationResult, TestMeta, TestType } from '@/engines';
import { formatDateDDMMYYYY, formatDateLong } from '@/lib/utils';

/**
 * Props for the ReportView component.
 * Why: Defines data needed to render the report.
 */
interface ReportViewProps {
  projectInfo: LegacyProjectInfo;
  loadEntries: LoadEntry[];
  /** Optional: testId for API-backed PDF generation */
  testId?: string;
}

/**
 * Report dashboard showing KPIs, chart, and data table.
 * Why: Final output view matching the report.html design (SSOT).
 * Uses Test Type Engine for IS 2911 compliant calculations.
 */
export function ReportView({ projectInfo, loadEntries, testId }: ReportViewProps) {
  const router = useRouter();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<unknown>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Conclusion state
  const [conclusion, setConclusion] = useState<string>('');
  const [conclusionDraft, setConclusionDraft] = useState<string>('');
  const [isGeneratingConclusion, setIsGeneratingConclusion] = useState(false);
  const [isEditingConclusion, setIsEditingConclusion] = useState(false);
  const [isSavingConclusion, setIsSavingConclusion] = useState(false);
  const [conclusionSource, setConclusionSource] = useState<'ai' | 'template' | 'saved' | null>(null);
  const [conclusionError, setConclusionError] = useState<string | null>(null);

  // Get test type engine
  const testType = (projectInfo.testType as TestType) || 'IVPLT';
  const engine = useMemo(() => getTestEngine(testType), [testType]);
  const testTypeConfig = TEST_TYPES.find(t => t.id === testType);

  // Convert legacy entries to engine input format
  const readingInputs: ReadingInput[] = useMemo(() => {
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
          // Map legacy phase to engine phase
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

    return inputs;
  }, [loadEntries]);

  // Build test metadata
  const testMeta: TestMeta = useMemo(() => ({
    pileDiameterMm: parseFloat(projectInfo.pileDiameter) || 600,
    pileDepthM: parseFloat(projectInfo.pileDepth) || 10,
    designLoadT: parseFloat(projectInfo.designLoadOnPile) || 0,
    testLoadT: parseFloat(projectInfo.testLoad) || parseFloat(projectInfo.designLoadOnPile) * (testTypeConfig?.loadMultiplier || 2.5),
    ramAreaCm2: parseFloat(projectInfo.ramArea) || 71.26,
  }), [projectInfo, testTypeConfig]);

  // Calculate results using engine
  const result: CalculationResult = useMemo(() => {
    return engine.calculate(readingInputs, testMeta);
  }, [engine, readingInputs, testMeta]);

  // Get graph config from engine
  const graphConfig = useMemo(() => engine.getGraphConfig(testMeta), [engine, testMeta]);

  /**
   * Export PDF via API (for database-backed tests) or print (for localStorage tests).
   * Why: Provides professional PDF generation when API is available.
   */
  const handleExportPDF = useCallback(async () => {
    setExportError(null);

    // If we have a testId, use the API for PDF generation
    if (testId) {
      setIsExporting(true);
      try {
        // Get chart as base64 if available
        let chartImageBase64: string | undefined;
        if (chartRef.current) {
          chartImageBase64 = chartRef.current.toDataURL('image/png');
        }

        const response = await fetch(`/api/tests/${testId}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chartImageBase64 }),
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
      } catch (error) {
        console.error('PDF export failed:', error);
        setExportError(error instanceof Error ? error.message : 'Failed to export PDF');
        // Fallback to print
        window.print();
      } finally {
        setIsExporting(false);
      }
    } else {
      // Fallback to browser print for localStorage-based data
      window.print();
    }
  }, [testId]);

  const handlePrint = () => {
    window.print();
  };

  /**
   * Fetch existing conclusion on mount or when testId changes.
   * Why: Load saved conclusion and clear stale state when switching tests.
   */
  useEffect(() => {
    // Clear stale conclusion state immediately when testId changes
    setConclusion('');
    setConclusionDraft('');
    setConclusionSource(null);
    setConclusionError(null);
    setIsEditingConclusion(false);

    if (!testId) return;

    const fetchConclusion = async () => {
      try {
        const response = await fetch(`/api/tests/${testId}/conclusion`);
        if (response.ok) {
          const data = await response.json();
          if (data.conclusion) {
            setConclusion(data.conclusion);
            setConclusionSource('saved');
          }
          // If no conclusion in response, state is already cleared above
        }
      } catch (error) {
        console.error('Failed to fetch conclusion:', error);
        // State already cleared, so no stale data will show
      }
    };

    fetchConclusion();
  }, [testId]);

  /**
   * Generate conclusion using AI or fallback template.
   * Why: Creates IS 2911-compliant conclusion text.
   */
  const handleGenerateConclusion = useCallback(async () => {
    if (!testId) {
      setConclusionError('Test must be saved to database to generate conclusion');
      return;
    }

    setIsGeneratingConclusion(true);
    setConclusionError(null);

    try {
      const response = await fetch(`/api/tests/${testId}/conclusion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate conclusion');
      }

      const data = await response.json();
      setConclusion(data.conclusion);
      setConclusionDraft(data.conclusion);
      setConclusionSource(data.isAIGenerated ? 'ai' : 'template');

      if (data.error) {
        setConclusionError(`Using template: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to generate conclusion:', error);
      setConclusionError(error instanceof Error ? error.message : 'Failed to generate conclusion');
    } finally {
      setIsGeneratingConclusion(false);
    }
  }, [testId]);

  /**
   * Save edited conclusion.
   * Why: Persists user edits to database.
   */
  const handleSaveConclusion = useCallback(async () => {
    if (!testId || !conclusionDraft.trim()) return;

    setIsSavingConclusion(true);
    setConclusionError(null);

    try {
      const response = await fetch(`/api/tests/${testId}/conclusion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conclusion: conclusionDraft }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save conclusion');
      }

      setConclusion(conclusionDraft);
      setConclusionSource('saved');
      setIsEditingConclusion(false);
    } catch (error) {
      console.error('Failed to save conclusion:', error);
      setConclusionError(error instanceof Error ? error.message : 'Failed to save conclusion');
    } finally {
      setIsSavingConclusion(false);
    }
  }, [testId, conclusionDraft]);

  /**
   * Cancel editing and revert to saved version.
   */
  const handleCancelEdit = useCallback(() => {
    setConclusionDraft(conclusion);
    setIsEditingConclusion(false);
  }, [conclusion]);

  /**
   * Start editing the conclusion.
   */
  const handleStartEdit = useCallback(() => {
    setConclusionDraft(conclusion);
    setIsEditingConclusion(true);
  }, [conclusion]);

  // Prepare chart with loading and unloading curves
  useEffect(() => {
    if (!chartRef.current || readingInputs.length === 0) return;

    // Separate data by phase
    const loadingData: { x: number; y: number }[] = [];
    const holdData: { x: number; y: number }[] = [];
    const unloadingData: { x: number; y: number }[] = [];

    readingInputs.forEach((reading) => {
      const point = { x: reading.loadT, y: reading.avgSettlementMm };
      if (reading.phase === 'LOADING') loadingData.push(point);
      else if (reading.phase === 'HOLD') holdData.push(point);
      else if (reading.phase === 'UNLOADING') unloadingData.push(point);
    });

    import('chart.js').then((ChartJS) => {
      const {
        Chart,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        LineController,
        Filler,
      } = ChartJS;

      Chart.register(
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        LineController,
        Filler
      );

      if (chartInstanceRef.current) {
        (chartInstanceRef.current as { destroy: () => void }).destroy();
      }

      const ctx = chartRef.current!.getContext('2d');
      if (!ctx) return;

      const datasets = [];

      // Loading curve
      if (loadingData.length > 0) {
        datasets.push({
          label: 'Loading Phase',
          data: loadingData,
          borderColor: graphConfig.loadingCurveColor,
          backgroundColor: `${graphConfig.loadingCurveColor}20`,
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
          tension: 0.3,
          fill: false,
        });
      }

      // Hold curve
      if (holdData.length > 0) {
        datasets.push({
          label: 'Hold Phase',
          data: holdData,
          borderColor: graphConfig.holdCurveColor,
          backgroundColor: `${graphConfig.holdCurveColor}20`,
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
          tension: 0.3,
          fill: false,
        });
      }

      // Unloading curve
      if (unloadingData.length > 0) {
        datasets.push({
          label: 'Unloading Phase',
          data: unloadingData,
          borderColor: graphConfig.unloadingCurveColor,
          backgroundColor: `${graphConfig.unloadingCurveColor}20`,
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
          tension: 0.3,
          fill: false,
        });
      }

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: graphConfig.xAxisLabel,
                font: { weight: 'bold' },
              },
              grid: { color: '#f1f5f9' },
            },
            y: {
              reverse: graphConfig.yAxisInverted,
              title: {
                display: true,
                text: graphConfig.yAxisLabel,
                font: { weight: 'bold' },
              },
              grid: { color: '#f1f5f9' },
              suggestedMin: 0,
            },
          },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: (context) => {
                  const y = context.parsed?.y ?? 0;
                  const x = context.parsed?.x ?? 0;
                  return `${context.dataset.label}: ${y.toFixed(2)} mm at ${x.toFixed(2)} MT`;
                },
              },
            },
          },
        },
      });
    });

    return () => {
      if (chartInstanceRef.current) {
        (chartInstanceRef.current as { destroy: () => void }).destroy();
      }
    };
  }, [readingInputs, graphConfig]);

  // Format date/time for table (dd/mm/yyyy format)
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: formatDateDDMMYYYY(date),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  // Build table rows
  const tableRows = loadEntries.flatMap((entry) =>
    entry.readings.map((reading) => {
      const { date, time } = formatDateTime(reading.timestamp);
      return {
        load: entry.load,
        pressure: entry.pressureGauge,
        date,
        time,
        avgTestPile: calculateAverageSettlement(
          reading.dialGauge1,
          reading.dialGauge2,
          reading.dialGauge3,
          reading.dialGauge4
        ),
        remark: reading.remark || '',
        phase: reading.phase,
      };
    })
  );

  // Status badge component
  const StatusBadge = ({ passed }: { passed: boolean }) => (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-lg ${
        passed
          ? 'bg-green-100 text-green-700 border-2 border-green-300'
          : 'bg-red-100 text-red-700 border-2 border-red-300'
      }`}
    >
      {passed ? (
        <CheckCircle2 className="w-6 h-6" />
      ) : (
        <XCircle className="w-6 h-6" />
      )}
      {passed ? 'PASSED' : 'FAILED'}
    </div>
  );

  return (
    <div className="bg-gray-100 min-h-screen p-4 space-y-4">
      {/* Header */}
      <header className="flex justify-between items-center flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Report Summary
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {testTypeConfig?.name || 'IVPLT'} |
            Pile ID: <strong>{projectInfo.pileId || projectInfo.reportNo || '-'}</strong> |
            Location: <strong>{projectInfo.location || '-'}</strong>
          </p>
          {exportError && (
            <p className="text-red-600 text-sm mt-1">
              {exportError} (using print fallback)
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-slate-200 transition-colors border border-slate-300 text-sm"
          >
            <FileText className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || loadEntries.length === 0}
            className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-slate-200 transition-colors border border-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? 'Exporting...' : 'Quick PDF'}
          </button>
          <button
            onClick={() => router.push('/report')}
            disabled={loadEntries.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileOutput className="w-5 h-5" />
            Generate Report
          </button>
        </div>
      </header>

      {/* Print Header - visible only when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">
          {testTypeConfig?.fullName || 'Initial Vertical Pile Load Test'} Report
        </h1>
        <div className="text-center text-sm text-slate-600">
          <p>Pile ID: {projectInfo.pileId || projectInfo.reportNo || '-'} | Location: {projectInfo.location || '-'}</p>
          <p>Test Date: {projectInfo.testDate ? formatDateLong(projectInfo.testDate) : formatDateLong(new Date())} | Test Method: IS 2911 (Part 4) - 2013</p>
        </div>
      </div>

      {/* Pass/Fail Status Banner */}
      <div
        className={`rounded-xl p-4 flex items-center justify-between ${
          result.isPassed
            ? 'bg-green-50 border-2 border-green-200'
            : 'bg-red-50 border-2 border-red-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {result.isPassed ? (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-600" />
          )}
          <div>
            <p className={`font-bold ${result.isPassed ? 'text-green-700' : 'text-red-700'}`}>
              Test Result: {result.isPassed ? 'PASSED' : 'FAILED'}
            </p>
            <p className={`text-sm ${result.isPassed ? 'text-green-600' : 'text-red-600'}`}>
              Net Settlement: {result.netSettlementMm.toFixed(2)}mm (Limit: {result.settlementLimitMm}mm)
            </p>
          </div>
        </div>
        <StatusBadge passed={result.isPassed} />
      </div>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Test Load */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Test Load</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {testMeta.testLoadT.toFixed(1)} <span className="text-sm">MT</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {testTypeConfig?.loadMultiplier || 2.5}× Design Load
          </p>
        </div>

        {/* Max Settlement */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Max Settlement</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {result.maxSettlementMm.toFixed(2)} <span className="text-sm">mm</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">At test load</p>
        </div>

        {/* Elastic Rebound */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Elastic Rebound</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {result.elasticReboundMm.toFixed(2)} <span className="text-sm">mm</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Recovery after unloading</p>
        </div>

        {/* Net Settlement */}
        <div className={`rounded-xl p-4 shadow-sm border-2 ${
          result.netSettlementMm <= result.settlementLimitMm
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Net Settlement</p>
          <p className={`text-2xl font-bold mt-2 ${
            result.netSettlementMm <= result.settlementLimitMm ? 'text-green-700' : 'text-red-700'
          }`}>
            {result.netSettlementMm.toFixed(2)} <span className="text-sm">mm</span>
          </p>
          <p className={`text-xs mt-1 ${
            result.netSettlementMm <= result.settlementLimitMm ? 'text-green-600' : 'text-red-600'
          }`}>
            Limit: {result.settlementLimitMm}mm (IS 2911)
          </p>
        </div>

        {/* Safe Load */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Safe Load Adopted</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {result.safeLoadAdoptedT.toFixed(1)} <span className="text-sm">MT</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Per {result.governingCriterion.toLowerCase()} criterion
          </p>
        </div>

        {/* Design Load */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Design Load</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {testMeta.designLoadT.toFixed(1)} <span className="text-sm">MT</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Working load capacity</p>
        </div>
      </section>

      {/* Pile Specifications */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3">Pile Specifications</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Pile ID</p>
            <p className="font-semibold">{projectInfo.pileId || '-'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Diameter</p>
            <p className="font-semibold">{projectInfo.pileDiameter || '-'} mm</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Depth</p>
            <p className="font-semibold">{projectInfo.pileDepth || '-'} m</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Concrete Grade</p>
            <p className="font-semibold">{projectInfo.mixedDesign || '-'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Ram Area</p>
            <p className="font-semibold">{projectInfo.ramArea || '-'} cm²</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Jack Name</p>
            <p className="font-semibold">{projectInfo.jackName || '-'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Dial Gauge LC</p>
            <p className="font-semibold">{projectInfo.lcOfDialGauge || '0.01'} mm</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Method</p>
            <p className="font-semibold">IS 2911 (Part 4)</p>
          </div>
        </div>
      </div>

      {/* Load vs Settlement Chart */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">{graphConfig.title}</h3>
          <div className="flex gap-2">
            <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
              Loading
            </span>
            <span className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700">
              Hold
            </span>
            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
              Unloading
            </span>
          </div>
        </div>
        <div className="h-72 relative">
          {loadEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-slate-50 rounded-lg text-slate-500">
              No data available for chart. Add readings in the Data Entry tab.
            </div>
          ) : (
            <canvas ref={chartRef}></canvas>
          )}
        </div>
      </div>

      {/* Conclusion Section */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        {testId ? (
          <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">4.0 Results & Conclusion</h3>
              {conclusionSource && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  conclusionSource === 'ai' 
                    ? 'bg-purple-100 text-purple-700' 
                    : conclusionSource === 'saved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {conclusionSource === 'ai' ? '✨ AI Generated' : 
                   conclusionSource === 'saved' ? '✓ Saved' : 
                   'Template'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!isEditingConclusion && !isGeneratingConclusion && conclusion && (
                <button
                  onClick={handleStartEdit}
                  className="text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium hover:bg-slate-100 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {!isEditingConclusion && (
                <button
                  onClick={handleGenerateConclusion}
                  disabled={isGeneratingConclusion || loadEntries.length === 0}
                  className="bg-purple-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingConclusion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGeneratingConclusion ? 'Generating...' : conclusion ? 'Regenerate' : 'Generate Conclusion'}
                </button>
              )}
            </div>
          </div>

          {conclusionError && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {conclusionError}
            </div>
          )}

          {isEditingConclusion ? (
            <div className="space-y-3">
              <textarea
                value={conclusionDraft}
                onChange={(e) => setConclusionDraft(e.target.value)}
                className="w-full h-48 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y text-sm leading-relaxed"
                placeholder="Enter or edit the conclusion text..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors border border-slate-300"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveConclusion}
                  disabled={isSavingConclusion || !conclusionDraft.trim()}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingConclusion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSavingConclusion ? 'Saving...' : 'Save Conclusion'}
                </button>
              </div>
            </div>
          ) : conclusion ? (
            <div className="prose prose-slate prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-200">
                {conclusion}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-8 text-center">
              <Sparkles className="w-10 h-10 text-purple-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-2">No conclusion generated yet</p>
              <p className="text-slate-400 text-sm">
                Click &quot;Generate Conclusion&quot; to create an IS 2911-compliant conclusion using AI
              </p>
            </div>
          )}
          </>
        ) : (
          /* No testId - show message about needing to save test */
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">4.0 Results & Conclusion</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-amber-700 font-medium mb-2">Test not saved to database</p>
              <p className="text-amber-600 text-sm">
                AI conclusion generation requires the test to be saved to the database.
                This feature is available for database-backed tests.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">Load Increment Summary</h3>

        {tableRows.length === 0 ? (
          <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500">
            No test data recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Phase</th>
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Date</th>
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Time</th>
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Load (MT)</th>
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Pressure</th>
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Avg Settlement</th>
                  <th className="text-left px-3 py-3 text-slate-600 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, index) => {
                  const phaseColors: Record<string, string> = {
                    loading: 'bg-blue-100 text-blue-700',
                    holding: 'bg-amber-100 text-amber-700',
                    unloading: 'bg-green-100 text-green-700',
                  };
                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${phaseColors[row.phase] || 'bg-slate-100'}`}>
                          {row.phase.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{row.date}</td>
                      <td className="px-3 py-3 text-slate-700">{row.time}</td>
                      <td className="px-3 py-3 font-semibold text-blue-700">{row.load}</td>
                      <td className="px-3 py-3 text-slate-700">{row.pressure} kg/cm²</td>
                      <td className="px-3 py-3 font-semibold text-green-700">{row.avgTestPile} mm</td>
                      <td className="px-3 py-3 text-slate-500 italic">{row.remark || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
