'use client';

import { cn } from '@/lib/utils';
import type { CalculatedReading } from '@/types';

/**
 * Props for the DataTable component.
 */
interface DataTableProps {
  readings: CalculatedReading[];
  /** Maximum load value for highlighting peak row */
  maxLoad: number;
}

/**
 * Full readings data table for the report.
 * Why: Displays complete test data with load increments, settlements,
 * and cycle phases. Peak hold row is highlighted per report.html design.
 */
export function DataTable({ readings, maxLoad }: DataTableProps) {
  /**
   * Get appropriate remark based on reading context.
   * Why: Provides meaningful descriptions for key data points.
   */
  const getRemarkText = (reading: CalculatedReading, index: number): string => {
    if (reading.remark) return reading.remark;

    // First reading
    if (index === 0) return 'Initial Reading';

    // Peak load (24hr hold)
    if (Math.abs(reading.load - maxLoad) < 0.01) return '24hr Hold Period';

    // Last reading (net settlement)
    if (index === readings.length - 1 && reading.cycle === 'unloading') {
      return 'Net Settlement';
    }

    // Unloading phase
    if (reading.cycle === 'unloading') return 'Rebound Phase';

    return '';
  };

  /**
   * Determine if row should be highlighted (peak hold).
   * Why: Visual emphasis on the critical test point per IS 2911.
   */
  const isPeakRow = (reading: CalculatedReading): boolean => {
    return Math.abs(reading.load - maxLoad) < 0.01;
  };

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <h3 className="mb-5 text-lg font-bold text-slate-700">
          Load Increment Summary
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-slate-500">
                Cycle
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">
                Load (MT)
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">
                Pressure (kg/cm²)
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-500">
                Avg Settlement (mm)
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-500">
                Remarks
              </th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading, index) => {
              const isPeak = isPeakRow(reading);
              const remark = getRemarkText(reading, index);

              return (
                <tr
                  key={reading.id}
                  className={cn(
                    'border-b border-slate-100 transition-colors hover:bg-slate-50',
                    isPeak && 'bg-emerald-50 hover:bg-emerald-50'
                  )}
                >
                  <td className="px-4 py-3 text-slate-800">
                    {isPeak ? (
                      <strong>Peak Hold</strong>
                    ) : (
                      <span className="capitalize">{reading.cycle}</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      isPeak ? 'font-bold text-slate-900' : 'text-slate-800'
                    )}
                  >
                    {reading.load.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      isPeak ? 'font-bold text-slate-900' : 'text-slate-800'
                    )}
                  >
                    {reading.pressure.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      isPeak ? 'font-bold text-slate-900' : 'text-slate-800'
                    )}
                  >
                    {reading.avgSettlement.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-slate-600',
                      isPeak && 'font-bold text-slate-900'
                    )}
                  >
                    {remark}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table footer with summary */}
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-sm text-slate-500">
          Total readings: <strong className="text-slate-700">{readings.length}</strong>
          {' • '}
          Loading: <strong className="text-slate-700">
            {readings.filter((r) => r.cycle === 'loading' || r.cycle === 'holding').length}
          </strong>
          {' • '}
          Unloading: <strong className="text-slate-700">
            {readings.filter((r) => r.cycle === 'unloading').length}
          </strong>
        </p>
      </div>
    </div>
  );
}


