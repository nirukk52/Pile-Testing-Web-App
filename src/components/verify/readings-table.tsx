'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useReportStore } from '@/store/report-store';
import { ConfidenceCell, ConfidenceBadge } from './confidence-cell';
import { ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react';
import type { ExtractedReading } from '@/types';

/**
 * Column configuration for the readings table.
 * Why: Defines column headers and their properties.
 */
interface ColumnConfig {
  key: keyof ExtractedReading;
  label: string;
  type: 'text' | 'number';
  width?: string;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'time', label: 'Time', type: 'text', width: 'w-20' },
  { key: 'pressure', label: 'Pressure (kg/cm²)', type: 'number', width: 'w-28' },
  { key: 'gauge1', label: 'G1 (mm)', type: 'number', width: 'w-20' },
  { key: 'gauge2', label: 'G2 (mm)', type: 'number', width: 'w-20' },
  { key: 'gauge3', label: 'G3 (mm)', type: 'number', width: 'w-20' },
  { key: 'gauge4', label: 'G4 (mm)', type: 'number', width: 'w-20' },
  { key: 'remark', label: 'Remark', type: 'text', width: 'w-32' },
];

/**
 * Editable readings table with timeline view.
 * Why: Main verification interface where engineers review and correct OCR-extracted readings.
 * Shows confidence-based highlighting and optional cycle phase indicators.
 */
export function ReadingsTable() {
  const readings = useReportStore((s) => s.readings);
  const autoDetectCycles = useReportStore((s) => s.autoDetectCycles);
  const setAutoDetectCycles = useReportStore((s) => s.setAutoDetectCycles);
  const updateReadingField = useReportStore((s) => s.updateReadingField);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  /**
   * Toggle row expansion for detailed view.
   * Why: Allows viewing additional details without cluttering main table.
   */
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  /**
   * Get cycle indicator icon.
   * Why: Visual representation of loading/unloading/holding phases.
   */
  const getCycleIcon = (cycle?: 'loading' | 'unloading' | 'holding') => {
    if (!autoDetectCycles || !cycle) return null;

    switch (cycle) {
      case 'loading':
        return (
          <span title="Loading">
            <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
          </span>
        );
      case 'unloading':
        return (
          <span title="Unloading">
            <ArrowDownCircle className="h-4 w-4 text-blue-500" />
          </span>
        );
      case 'holding':
        return (
          <span title="Holding">
            <Clock className="h-4 w-4 text-amber-500" />
          </span>
        );
    }
  };

  /**
   * Calculate average settlement from 4 gauges.
   * Why: Computed value shown for reference.
   */
  const calculateAvgSettlement = (reading: ExtractedReading): string => {
    const values = [
      reading.gauge1.value,
      reading.gauge2.value,
      reading.gauge3.value,
      reading.gauge4.value,
    ].filter((v): v is number => v !== null);

    if (values.length === 0) return '—';
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg.toFixed(2);
  };

  if (readings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-slate-500">No readings extracted</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Readings Timeline
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {readings.length} readings extracted • Click values to edit
          </p>
        </div>

        {/* Auto-detect cycles toggle */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={autoDetectCycles}
            onChange={(e) => setAutoDetectCycles(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">Auto-detect cycle changes</span>
        </label>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50 px-6 py-2">
        <span className="text-xs font-medium text-slate-500">Confidence:</span>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-300" />
          <span className="text-xs text-slate-600">Low (&lt;75%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-200" />
          <span className="text-xs text-slate-600">Medium (75-85%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-white ring-1 ring-slate-200" />
          <span className="text-xs text-slate-600">High (&gt;85%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />
          <span className="text-xs text-slate-600">Verified</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {autoDetectCycles && (
                <th className="w-10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phase
                </th>
              )}
              <th className="w-8 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                #
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.width
                  )}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-24 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Avg. (mm)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {readings.map((reading, index) => (
              <tr
                key={reading.id}
                className={cn(
                  'group transition-colors',
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                )}
              >
                {/* Cycle indicator */}
                {autoDetectCycles && (
                  <td className="px-3 py-2">
                    {getCycleIcon(reading.cycle)}
                  </td>
                )}

                {/* Row number */}
                <td className="px-3 py-2 text-sm font-medium text-slate-400">
                  {index + 1}
                </td>

                {/* Data columns */}
                {COLUMNS.map((col) => {
                  const field = reading[col.key];
                  if (!field || typeof field !== 'object' || !('confidence' in field)) {
                    return <td key={col.key} className="px-3 py-2">—</td>;
                  }

                  // Cast to the expected OCRValue type
                  const ocrField = field as { value: string | number | null; confidence: number };

                  return (
                    <td key={col.key} className={cn('px-3 py-2', col.width)}>
                      <ConfidenceCell
                        value={ocrField}
                        onChange={(newValue) =>
                          updateReadingField(reading.id, col.key, newValue as never)
                        }
                        type={col.type}
                        placeholder="—"
                      />
                    </td>
                  );
                })}

                {/* Calculated average settlement */}
                <td className="px-3 py-2">
                  <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium text-slate-700">
                    {calculateAvgSettlement(reading)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
        <div className="text-sm text-slate-600">
          <span className="font-medium">{readings.length}</span> total readings
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          {autoDetectCycles && (
            <>
              <span className="flex items-center gap-1">
                <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                {readings.filter((r) => r.cycle === 'loading').length} loading
              </span>
              <span className="flex items-center gap-1">
                <ArrowDownCircle className="h-3.5 w-3.5 text-blue-500" />
                {readings.filter((r) => r.cycle === 'unloading').length} unloading
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {readings.filter((r) => r.cycle === 'holding').length} holding
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact timeline view for readings.
 * Why: Alternative visual representation focusing on the timeline aspect.
 */
export function ReadingsTimeline() {
  const readings = useReportStore((s) => s.readings);
  const autoDetectCycles = useReportStore((s) => s.autoDetectCycles);

  if (readings.length === 0) return null;

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

      <div className="space-y-3">
        {readings.map((reading, index) => (
          <div key={reading.id} className="relative flex items-start gap-4 pl-10">
            {/* Timeline dot */}
            <div
              className={cn(
                'absolute left-2.5 h-3 w-3 rounded-full border-2 border-white',
                reading.cycle === 'loading' && 'bg-emerald-500',
                reading.cycle === 'unloading' && 'bg-blue-500',
                reading.cycle === 'holding' && 'bg-amber-500',
                !reading.cycle && 'bg-slate-400'
              )}
            />

            {/* Time */}
            <div className="w-16 shrink-0 text-sm font-medium text-slate-800">
              {reading.time.value || '—'}
            </div>

            {/* Reading summary */}
            <div className="flex-1 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">Pressure:</span>
                <span className="font-medium">{reading.pressure.value ?? '—'}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Gauges:</span>
                <span className="font-medium">
                  {[reading.gauge1.value, reading.gauge2.value, reading.gauge3.value, reading.gauge4.value]
                    .map((v) => v?.toFixed(2) ?? '—')
                    .join(', ')}
                </span>
                {reading.remark.value && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="italic text-slate-600">{reading.remark.value}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

