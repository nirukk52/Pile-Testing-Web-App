'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getConfidenceLevel, type OCRValue } from '@/types';

interface ConfidenceCellProps {
  /** The OCR value with confidence score */
  value: OCRValue<string | number | null>;
  /** Called when user edits the value */
  onChange: (newValue: string | number | null) => void;
  /** Type of input: text or number */
  type?: 'text' | 'number';
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether cell is editable */
  editable?: boolean;
}

/**
 * Editable table cell with confidence-based background color.
 * Why: Displays OCR-extracted values with visual indicators for confidence level.
 * Red = low confidence (< 0.75), Yellow = medium (0.75-0.85), normal = high (> 0.85).
 */
export function ConfidenceCell({
  value,
  onChange,
  type = 'text',
  placeholder = '-',
  className,
  editable = true,
}: ConfidenceCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(
    value.value?.toString() ?? ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value.value?.toString() ?? '');
    }
  }, [value.value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const confidenceLevel = getConfidenceLevel(value.confidence);

  /**
   * Handle starting edit mode.
   * Why: Click on cell to edit the value.
   */
  const handleClick = () => {
    if (editable) {
      setIsEditing(true);
    }
  };

  /**
   * Handle input blur - save the value.
   * Why: When user clicks away, save the edited value.
   */
  const handleBlur = () => {
    setIsEditing(false);
    
    // Convert and validate the value
    let newValue: string | number | null;
    if (type === 'number') {
      const num = parseFloat(editValue);
      newValue = isNaN(num) ? null : num;
    } else {
      newValue = editValue.trim() || null;
    }

    // Only call onChange if value actually changed
    if (newValue !== value.value) {
      onChange(newValue);
    }
  };

  /**
   * Handle key press in input.
   * Why: Enter saves, Escape cancels edit.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(value.value?.toString() ?? '');
      setIsEditing(false);
    }
  };

  /**
   * Get background color based on confidence level.
   * Why: Visual feedback for OCR confidence - engineers quickly spot values needing attention.
   */
  const getBackgroundColor = () => {
    // User-edited values (confidence = 1.0) get a subtle green
    if (value.confidence === 1.0 && value.value !== null) {
      return 'bg-emerald-50';
    }
    
    switch (confidenceLevel) {
      case 'low':
        return 'bg-rose-100 hover:bg-rose-50';
      case 'medium':
        return 'bg-amber-50 hover:bg-amber-100';
      case 'high':
        return 'bg-white hover:bg-slate-50';
    }
  };

  /**
   * Get border color based on confidence level.
   * Why: Additional visual cue for confidence levels.
   */
  const getBorderColor = () => {
    if (value.confidence === 1.0) {
      return 'border-emerald-200';
    }
    
    switch (confidenceLevel) {
      case 'low':
        return 'border-rose-300';
      case 'medium':
        return 'border-amber-200';
      case 'high':
        return 'border-slate-200';
    }
  };

  // Display value or placeholder
  const displayValue = value.value?.toString() || placeholder;

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full rounded border-2 border-blue-400 bg-white px-2 py-1',
          'text-sm font-medium text-slate-800 outline-none',
          'shadow-sm',
          className
        )}
        step={type === 'number' ? '0.01' : undefined}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      title={`Confidence: ${Math.round(value.confidence * 100)}%`}
      className={cn(
        'cursor-pointer rounded border px-2 py-1 text-sm',
        'transition-colors duration-150',
        editable && 'hover:ring-2 hover:ring-blue-200',
        getBackgroundColor(),
        getBorderColor(),
        !value.value && 'text-slate-400 italic',
        className
      )}
    >
      {displayValue}
    </div>
  );
}

/**
 * Confidence indicator badge.
 * Why: Shows confidence percentage as a small badge.
 */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence);
  const percent = Math.round(confidence * 100);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        level === 'low' && 'bg-rose-100 text-rose-700',
        level === 'medium' && 'bg-amber-100 text-amber-700',
        level === 'high' && 'bg-emerald-100 text-emerald-700'
      )}
    >
      {percent}%
    </span>
  );
}

