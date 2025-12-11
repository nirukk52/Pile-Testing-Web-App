'use client';

import { cn } from '@/lib/utils';
import type { ReportSummary } from '@/types';

/**
 * Props for the KPICards component.
 */
interface KPICardsProps {
  summary: ReportSummary;
}

/**
 * Single KPI card component.
 * Why: Displays a single metric with label, value, unit, and optional subtitle.
 */
function KPICard({
  label,
  value,
  unit,
  subtitle,
  subtitleColor = 'text-slate-500',
  valueColor = 'text-slate-900',
}: {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  subtitleColor?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={cn('mt-2 text-3xl font-extrabold', valueColor)}>
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && (
          <span className="ml-1 text-base font-normal text-slate-500">{unit}</span>
        )}
      </p>
      {subtitle && (
        <p className={cn('mt-1 text-sm', subtitleColor)}>{subtitle}</p>
      )}
    </div>
  );
}

/**
 * Grid of 4 KPI cards showing key test metrics.
 * Why: Provides at-a-glance summary of test results matching report.html design.
 * Shows Test Load, Max Settlement, Net Settlement, and Pass/Fail Status.
 */
export function KPICards({ summary }: KPICardsProps) {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      {/* Test Load */}
      <KPICard
        label="Test Load"
        value={summary.testLoad}
        unit="MT"
        subtitle={`${summary.loadMultiplier}x Design Load (${summary.designLoad} MT)`}
        subtitleColor="text-blue-600"
      />

      {/* Max Settlement */}
      <KPICard
        label="Max Settlement"
        value={summary.grossSettlement}
        unit="mm"
        subtitle={`At ${summary.maxLoad.toFixed(2)} MT Load`}
      />

      {/* Net Settlement */}
      <KPICard
        label="Net Settlement"
        value={summary.netSettlement}
        unit="mm"
        subtitle={
          summary.passed
            ? `Safe (Limit: ${summary.settlementLimit}mm)`
            : `Exceeded (Limit: ${summary.settlementLimit}mm)`
        }
        subtitleColor={summary.passed ? 'text-emerald-600' : 'text-rose-600'}
      />

      {/* Test Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Test Status
        </p>
        <p
          className={cn(
            'mt-2 text-3xl font-extrabold',
            summary.passed ? 'text-emerald-500' : 'text-rose-500'
          )}
        >
          {summary.passed ? 'PASSED' : 'FAILED'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Safe Load Capacity: {summary.safeLoadCapacity} MT
        </p>
      </div>
    </section>
  );
}


