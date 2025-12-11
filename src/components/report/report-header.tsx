'use client';

import { Download, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ReportSummary } from '@/types';

/**
 * Props for the ReportHeader component.
 */
interface ReportHeaderProps {
  /** Test number/ID (e.g., "TP-04") */
  testNo: string | null;
  /** Project location */
  location: string | null;
  /** Test date */
  testDate: string | null;
  /** Report summary for title and status */
  summary: ReportSummary;
  /** Handler for PDF export */
  onExportPDF: () => void;
  /** Whether PDF export is in progress */
  isExporting?: boolean;
}

/**
 * Report page header with title, metadata, and export button.
 * Why: Provides at-a-glance identification of the report and
 * primary action (PDF export) following the report.html design.
 */
export function ReportHeader({
  testNo,
  location,
  testDate,
  summary,
  onExportPDF,
  isExporting = false,
}: ReportHeaderProps) {
  return (
    <header className="mb-8">
      {/* Back navigation */}
      <Link
        href="/verify"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Verify
      </Link>

      <div className="flex items-start justify-between">
        <div className="report-title">
          <h1 className="text-2xl font-bold text-slate-800">
            {summary.testTypeName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            {testNo && (
              <span>
                Report ID: <strong className="text-slate-700">{testNo}</strong>
              </span>
            )}
            {location && (
              <>
                <span className="text-slate-300">|</span>
                <span>
                  Location: <strong className="text-slate-700">{location}</strong>
                </span>
              </>
            )}
            {testDate && (
              <>
                <span className="text-slate-300">|</span>
                <span>
                  Date: <strong className="text-slate-700">{testDate}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onExportPDF}
          disabled={isExporting}
          className={cn(
            'flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-sm shadow-sm transition-all',
            isExporting
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
          )}
        >
          {isExporting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Full PDF
            </>
          )}
        </button>
      </div>
    </header>
  );
}


