'use client';

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

/**
 * Props for ScoreBadge component.
 * Why: Defines the score and optional size variant.
 */
interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Score Badge Component
 * Why: Visual indicator for verification scores with pass/warn/fail status.
 * Used in report-view.tsx to show verification results.
 */
export function ScoreBadge({ score, size = 'md', showLabel = true }: ScoreBadgeProps) {
  // Determine status from score
  const status = score >= 90 ? 'pass' : score >= 80 ? 'warn' : 'fail';

  // Status-specific styling
  const styles = {
    pass: {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-700',
      label: 'PASS',
      Icon: CheckCircle,
    },
    warn: {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
      label: 'REVIEW',
      Icon: AlertTriangle,
    },
    fail: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-700',
      label: 'FAIL',
      Icon: XCircle,
    },
  };

  const { bg, border, text, label, Icon } = styles[status];

  // Size variants
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border ${bg} ${border} ${text} ${sizeClasses[size]} font-medium`}
    >
      <Icon className={iconSizes[size]} />
      <span className="font-bold">{score}</span>
      {showLabel && <span className="uppercase">{label}</span>}
    </div>
  );
}

/**
 * Confidence indicator for individual field values.
 * Why: Shows extraction confidence for user review.
 */
interface ConfidenceIndicatorProps {
  confidence: number;
  className?: string;
}

export function ConfidenceIndicator({ confidence, className = '' }: ConfidenceIndicatorProps) {
  const getColor = () => {
    if (confidence >= 90) return 'bg-green-500';
    if (confidence >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getColor()}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">{confidence}%</span>
    </div>
  );
}
