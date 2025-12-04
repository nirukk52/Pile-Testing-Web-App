'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileStack, ArrowLeft, ArrowRight, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReportStore } from '@/store/report-store';
import { ProjectInfoCards } from '@/components/verify/project-info-cards';
import { ReadingsTable } from '@/components/verify/readings-table';
import { getConfidenceLevel } from '@/types';

/**
 * Verify page - Review and edit OCR-extracted data.
 * Why: Engineers verify that OCR correctly extracted readings from field sheets.
 * Low-confidence values are highlighted for special attention.
 */
export default function VerifyPage() {
  const router = useRouter();

  // Store state
  const {
    projectInfo,
    readings,
    testType,
    currentStep,
    setStep,
  } = useReportStore();

  // Redirect to upload if no data
  useEffect(() => {
    if (!projectInfo && readings.length === 0) {
      router.push('/');
    }
  }, [projectInfo, readings, router]);

  /**
   * Count values needing attention (low confidence).
   * Why: Summary metric to show how many values need verification.
   */
  const getLowConfidenceCount = (): number => {
    let count = 0;

    // Check project info
    if (projectInfo) {
      Object.values(projectInfo).forEach((field) => {
        if (field.value !== null && getConfidenceLevel(field.confidence) === 'low') {
          count++;
        }
      });
    }

    // Check readings
    readings.forEach((reading) => {
      ['time', 'pressure', 'gauge1', 'gauge2', 'gauge3', 'gauge4'].forEach((key) => {
        const field = reading[key as keyof typeof reading];
        if (
          field &&
          typeof field === 'object' &&
          'confidence' in field &&
          field.value !== null &&
          getConfidenceLevel(field.confidence) === 'low'
        ) {
          count++;
        }
      });
    });

    return count;
  };

  const lowConfidenceCount = getLowConfidenceCount();

  /**
   * Handle proceeding to report generation.
   * Why: Moves to the next step in the workflow.
   */
  const handleProceed = () => {
    setStep('report');
    router.push('/report');
  };

  // Show loading state if no data yet
  if (!projectInfo && readings.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
              <span className="font-medium text-slate-800">Verify</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-400">Report</span>
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
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Verify Extracted Data
            </h2>
            <p className="mt-2 text-slate-500">
              Review the OCR-extracted values. Click any field to edit.
              Red backgrounds indicate low confidence values that need attention.
            </p>
          </div>

          {/* Low confidence warning */}
          {lowConfidenceCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {lowConfidenceCount} value{lowConfidenceCount !== 1 ? 's' : ''} need verification
              </span>
            </div>
          )}
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Project Information */}
          <section>
            <ProjectInfoCards />
          </section>

          {/* Readings Table */}
          <section>
            <ReadingsTable />
          </section>
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Upload
          </Link>

          <div className="flex items-center gap-4">
            {/* Summary stats */}
            <div className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{readings.length}</span> readings
              {lowConfidenceCount > 0 && (
                <span className="ml-2 text-amber-600">
                  • {lowConfidenceCount} to verify
                </span>
              )}
            </div>

            {/* Proceed button */}
            <button
              onClick={handleProceed}
              className={cn(
                'flex items-center gap-2 rounded-lg px-6 py-3 font-semibold',
                'bg-blue-600 text-white shadow-sm',
                'transition-all duration-200',
                'hover:bg-blue-700 active:scale-[0.98]'
              )}
            >
              <FileText className="h-4 w-4" />
              Generate Report
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tips section */}
        <div className="mt-8 rounded-xl bg-slate-800 p-6 text-white">
          <h4 className="font-semibold">Tips for Verification</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
              <span>
                <strong className="text-rose-300">Red cells</strong> have low OCR confidence (&lt;75%) - double-check these against your paper sheets
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span>
                <strong className="text-amber-300">Yellow cells</strong> have medium confidence (75-85%) - verify if in doubt
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span>
                <strong className="text-emerald-300">Green cells</strong> indicate values you&apos;ve manually edited (verified)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>
                Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">Enter</kbd> to save edits,{' '}
                <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">Esc</kbd> to cancel
              </span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

