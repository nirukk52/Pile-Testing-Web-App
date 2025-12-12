'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileStack } from 'lucide-react';
import { useReportStore } from '@/store/report-store';
import { calculateVerticalTestReport } from '@/lib/calculations';
import {
  ReportHeader,
  KPICards,
  LoadSettlementChart,
  SpecsPanel,
  DataTable,
} from '@/components/report';
import type { ReportData } from '@/types';

/**
 * Report dashboard page - Displays complete test results.
 * Why: Final step in the workflow where engineers review test data,
 * charts, and pass/fail status before exporting the PDF report.
 */
export default function ReportPage() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  // Get data from store
  const {
    projectInfo,
    readings,
    testType,
    currentStep,
  } = useReportStore();

  // Redirect to upload if no data
  useEffect(() => {
    if (!projectInfo || readings.length === 0 || !testType) {
      router.push('/');
    }
  }, [projectInfo, readings, testType, router]);

  // Calculate report data
  const reportData: ReportData | null = useMemo(() => {
    if (!projectInfo || !testType || readings.length === 0) {
      return null;
    }

    // Only handle vertical tests in this version
    if (testType !== 'IVPLT' && testType !== 'RVPLT') {
      console.warn(`Test type ${testType} not yet supported for report generation`);
      return null;
    }

    try {
      return calculateVerticalTestReport({
        testType,
        projectInfo,
        readings,
      });
    } catch (error) {
      console.error('Error calculating report:', error);
      return null;
    }
  }, [projectInfo, testType, readings]);

  /**
   * Handle PDF export.
   * Why: Sends report data to the PDF API endpoint and triggers download.
   */
  const handleExportPDF = async () => {
    if (!reportData) return;

    setIsExporting(true);

    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      // Get the PDF blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename
      const testNo = reportData.projectInfo.testNo || 'Report';
      const date = new Date().toISOString().split('T')[0];
      a.download = `${testNo}_${testType}_${date}_Report.pdf`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Show loading state while data is being prepared
  if (!reportData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-500">Preparing report...</p>
        </div>
      </div>
    );
  }

  // Extract first date from readings for display
  const testDate = reportData.readings.length > 0
    ? reportData.readings[0].date
    : null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                <FileStack className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
              </div>
              <h1 className="text-lg font-bold tracking-wide">
                <span className="text-blue-600">PILE</span>
                <span className="text-slate-800">TEST</span>
              </h1>
            </Link>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Link href="/" className="text-slate-400 hover:text-slate-600">
                Upload
              </Link>
              <span className="text-slate-300">/</span>
              <Link href="/verify" className="text-slate-400 hover:text-slate-600">
                Verify
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-800">Report</span>
            </div>
          </div>

          {/* Test type badge */}
          {testType && (
            <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
              {testType} Test
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Report Header */}
        <ReportHeader
          testNo={reportData.projectInfo.testNo}
          location={reportData.projectInfo.location}
          testDate={testDate}
          summary={reportData.summary}
          onExportPDF={handleExportPDF}
          isExporting={isExporting}
        />

        {/* KPI Cards */}
        <KPICards summary={reportData.summary} />

        {/* Main Dashboard Grid: Chart + Specs */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chart - takes 2 columns */}
          <div className="lg:col-span-2">
            <LoadSettlementChart
              loadingReadings={reportData.loadingReadings}
              unloadingReadings={reportData.unloadingReadings}
              summary={reportData.summary}
            />
          </div>

          {/* Specs Panel - takes 1 column */}
          <div className="lg:col-span-1">
            <SpecsPanel projectInfo={reportData.projectInfo} />
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          readings={reportData.readings}
          maxLoad={reportData.summary.maxLoad}
        />

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href="/verify"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            ← Edit Data
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              Report generated from {readings.length} readings
            </span>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}


