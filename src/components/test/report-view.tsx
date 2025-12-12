'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Download, CheckCircle2, XCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import type { LoadEntry, LegacyProjectInfo } from '@/types';
import { calculateAverageSettlement, TEST_TYPES } from '@/types';
import { getTestEngine } from '@/engines';
import type { ReadingInput, CalculationResult, TestMeta, TestType } from '@/engines';

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
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<unknown>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  // Format date/time for table
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
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
            {testTypeConfig?.fullName || 'Initial Vertical Pile Load Test'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Pile ID: <strong>{projectInfo.pileId || projectInfo.reportNo || '-'}</strong> |
            Location: <strong>{projectInfo.location || '-'}</strong> |
            Date: <strong>{projectInfo.testDate || new Date().toLocaleDateString()}</strong>
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
            className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-semibold hover:bg-slate-200 transition-colors border border-slate-300"
          >
            <FileText className="w-5 h-5" />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || loadEntries.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {isExporting ? 'Generating...' : 'Export PDF'}
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
          <p>Test Date: {projectInfo.testDate || new Date().toLocaleDateString()} | Test Method: IS 2911 (Part 4) - 2013</p>
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
