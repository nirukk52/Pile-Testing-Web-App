'use client';

import { CheckCircle } from 'lucide-react';
import type { ReportData } from '@/types';

/**
 * Props for the SpecsPanel component.
 */
interface SpecsPanelProps {
  projectInfo: ReportData['projectInfo'];
}

/**
 * Single spec row component.
 * Why: Consistent display of label-value pairs in the specifications list.
 */
function SpecRow({ label, value }: { label: string; value: string | null }) {
  return (
    <li className="flex justify-between border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">
        {value || '—'}
      </span>
    </li>
  );
}

/**
 * Pile specifications panel with image placeholder and specs list.
 * Why: Displays technical pile data matching report.html sidebar design.
 * Includes calibration status indicator per IS 2911 requirements.
 */
export function SpecsPanel({ projectInfo }: SpecsPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Site Image Placeholder */}
      <div className="flex h-44 items-center justify-center rounded-t-xl bg-slate-100 text-sm font-medium text-slate-400">
        [Site Image: Hydraulic Jack Setup]
      </div>

      <div className="p-5">
        <h3 className="mb-4 text-lg font-bold text-slate-700">
          Pile Specifications
        </h3>

        <ul className="space-y-0">
          <SpecRow label="Pile Diameter" value={projectInfo.pileDiameter} />
          <SpecRow label="Pile Depth" value={projectInfo.pileDepth} />
          <SpecRow label="Concrete Grade" value={projectInfo.concreteGrade} />
          <SpecRow label="Method" value="IS 2911 (Part 4)" />
          <SpecRow label="Ram Area" value={projectInfo.ramArea} />
          <SpecRow label="LC (Dial Gauge)" value={projectInfo.lcDialGauge} />
        </ul>

        {/* Calibration Status */}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">
            Calibration Status
          </h4>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-slate-500">
              Jack & Gauges Verified (QCC Lab)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


