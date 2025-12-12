'use client';

import { X, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { TEST_TYPES, type TestType } from '@/types';

/**
 * Props for the TestTypeModal component.
 * Why: Defines callbacks for selection and closing.
 */
interface TestTypeModalProps {
  onSelect: (testType: TestType) => void;
  onClose: () => void;
}

/**
 * Icon mapping for test types.
 * Why: Visual representation of test direction.
 */
const iconMap = {
  IVPLT: ArrowDown,
  RVPLT: ArrowDown,
  Lateral: Minus,
  Uplift: ArrowUp,
};

/**
 * Modal for selecting pile load test type.
 * Why: First step in creating a new test - determines test parameters.
 */
export function TestTypeModal({ onSelect, onClose }: TestTypeModalProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-800 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-lg">Select Test Type</h2>
              <p className="text-slate-400 text-sm mt-1">
                Choose the type of pile load test
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Test Type Options */}
          <div className="p-6 space-y-3">
            {TEST_TYPES.map((testType) => {
              const Icon = iconMap[testType.id];
              return (
                <button
                  key={testType.id}
                  onClick={() => onSelect(testType.id)}
                  className={`w-full text-left p-4 rounded-xl ${testType.color} ${testType.hoverColor} text-white transition-all active:scale-[0.98] shadow-md hover:shadow-lg`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold mb-1">{testType.name}</h3>
                      <p className="text-white/80 text-sm">{testType.fullName}</p>
                      <p className="text-white/60 text-xs mt-1">
                        {testType.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
