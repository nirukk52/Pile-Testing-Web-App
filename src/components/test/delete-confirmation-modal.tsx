'use client';

import { Trash2, X, AlertTriangle } from 'lucide-react';

/**
 * Props for the DeleteConfirmationModal component.
 * Why: Defines the reading info and callbacks for the delete confirmation.
 */
interface DeleteConfirmationModalProps {
  /** Time of the reading (e.g., "10:30 AM") */
  time: string;
  /** Load value (e.g., "50 MT") */
  load: string;
  /** Callback when user confirms deletion */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Whether delete is in progress */
  isDeleting?: boolean;
}

/**
 * Modal dialog for confirming reading deletion.
 * Why: Prevents accidental deletion by showing what will be removed.
 */
export function DeleteConfirmationModal({
  time,
  load,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-red-50 px-6 py-4 border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">Delete Reading?</h3>
              <p className="text-sm text-red-600">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-slate-700 text-center">
            Delete reading from <span className="font-semibold text-slate-900">{time}</span> with load{' '}
            <span className="font-semibold text-blue-700">{load}</span>?
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
