'use client';

import { cn } from '@/lib/utils';
import { useReportStore } from '@/store/report-store';
import { ConfidenceCell } from './confidence-cell';
import type { ProjectInfo } from '@/types';

/**
 * Configuration for displaying project info fields.
 * Why: Defines how each field should be displayed with labels and formatting.
 */
interface FieldConfig {
  key: keyof ProjectInfo;
  label: string;
  /** Grid column span (1-2) */
  span?: number;
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'testNo', label: 'Test No.' },
  { key: 'testType', label: 'Test Type' },
  { key: 'project', label: 'Project', span: 2 },
  { key: 'location', label: 'Location' },
  { key: 'contractor', label: 'Contractor' },
  { key: 'clientName', label: 'Client Name', span: 2 },
  { key: 'pileDiameter', label: 'Pile Diameter' },
  { key: 'pileDepth', label: 'Pile Depth' },
  { key: 'designLoad', label: 'Design Load' },
  { key: 'testLoad', label: 'Test Load' },
  { key: 'ramArea', label: 'Ram Area' },
  { key: 'lcDialGauge', label: 'LC of Dial Gauge' },
  { key: 'dateOfCasting', label: 'Date of Casting' },
  { key: 'mixedDesign', label: 'Mixed Design' },
];

/**
 * Editable project information cards.
 * Why: Displays OCR-extracted project header data with confidence indicators,
 * allowing engineers to verify and correct extracted values.
 */
export function ProjectInfoCards() {
  const projectInfo = useReportStore((s) => s.projectInfo);
  const updateProjectField = useReportStore((s) => s.updateProjectField);

  if (!projectInfo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        No project information extracted
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-slate-800">
        Project Information
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        Click any field to edit. Red backgrounds indicate low OCR confidence - please verify.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {FIELD_CONFIGS.map(({ key, label, span }) => (
          <div
            key={key}
            className={cn(
              'space-y-1.5',
              span === 2 && 'col-span-2'
            )}
          >
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </label>
            <ConfidenceCell
              value={projectInfo[key]}
              onChange={(newValue) => updateProjectField(key, newValue as string | null)}
              type="text"
              placeholder="—"
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact single-row project info display.
 * Why: Alternative layout for when space is limited.
 */
export function ProjectInfoCompact() {
  const projectInfo = useReportStore((s) => s.projectInfo);

  if (!projectInfo) return null;

  const primaryFields: (keyof ProjectInfo)[] = [
    'testNo',
    'project',
    'location',
    'pileDiameter',
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {primaryFields.map((key) => {
        const field = projectInfo[key];
        const label = FIELD_CONFIGS.find((f) => f.key === key)?.label || key;
        
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-slate-500">{label}:</span>
            <span
              className={cn(
                'font-medium',
                field.confidence < 0.75 && 'text-rose-600',
                field.confidence >= 0.75 && field.confidence < 0.85 && 'text-amber-600',
                field.confidence >= 0.85 && 'text-slate-800'
              )}
            >
              {field.value || '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

