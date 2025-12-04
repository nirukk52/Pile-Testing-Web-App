'use client';

import { cn } from '@/lib/utils';
import { TEST_TYPES, type TestType } from '@/types';
import { ArrowDownUp, ArrowUp, MoveHorizontal, ArrowUpFromLine } from 'lucide-react';

interface TestTypeSelectProps {
  value: TestType | null;
  onChange: (type: TestType) => void;
}

/**
 * Returns the appropriate icon for each test type.
 * Why: Visual icons help field engineers quickly identify the correct test type
 * based on the physical orientation of the test (vertical, pullout, lateral).
 */
function getTestIcon(code: TestType) {
  const iconProps = { className: 'h-5 w-5', strokeWidth: 1.5 };
  
  switch (code) {
    case 'IVPLT':
      return <ArrowDownUp {...iconProps} />;
    case 'RVPLT':
      return <ArrowUp {...iconProps} />;
    case 'PULLOUT':
      return <ArrowUpFromLine {...iconProps} />;
    case 'LATERAL':
      return <MoveHorizontal {...iconProps} />;
  }
}

/**
 * Card-based test type selector for pile load tests.
 * Why: Engineers need to select the correct test type (Initial Vertical, Routine, etc.)
 * before OCR processing, as this affects load calculations and pass/fail criteria.
 */
export function TestTypeSelect({ value, onChange }: TestTypeSelectProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Test Type
      </label>
      
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TEST_TYPES.map((type) => {
          const isSelected = value === type.code;
          
          return (
            <button
              key={type.code}
              onClick={() => onChange(type.code)}
              className={cn(
                'group relative flex flex-col items-start rounded-xl border-2 p-4 text-left',
                'transition-all duration-200',
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'mb-3 rounded-lg p-2 transition-colors',
                  isSelected
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                )}
              >
                {getTestIcon(type.code)}
              </div>

              {/* Name */}
              <span
                className={cn(
                  'font-semibold transition-colors',
                  isSelected ? 'text-blue-700' : 'text-slate-700'
                )}
              >
                {type.name}
              </span>

              {/* Code Badge */}
              <span
                className={cn(
                  'mt-1 rounded px-1.5 py-0.5 text-xs font-mono',
                  isSelected
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {type.code}
              </span>

              {/* Load Multiplier */}
              <span className="mt-2 text-xs text-slate-500">
                {type.loadMultiplier}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

