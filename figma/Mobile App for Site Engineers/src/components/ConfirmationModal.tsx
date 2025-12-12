import { useState } from 'react';
import { Check, X, PenTool } from 'lucide-react';

interface ConfirmationModalProps {
  load: string;
  pressure: string;
  dialGauges: string[];
  average: string;
  onConfirm: (signature: string, remark: string) => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  load,
  pressure,
  dialGauges,
  average,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState('');
  const [remark, setRemark] = useState('');

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setConfirmed(value === 100);
  };

  const handleConfirm = () => {
    if (confirmed && signature) {
      onConfirm(signature, remark);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fadeIn"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto animate-slideUp">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white">Confirm Reading</h2>
              <button
                onClick={onCancel}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Load:</span>
                <span className="text-gray-900">{load} MT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Calculated Pressure:</span>
                <span className="text-gray-900">{pressure} kg/cm²</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Average:</span>
                <span className="text-gray-900">{average}</span>
              </div>
              
              {/* Dial Gauges */}
              <div className="pt-3 border-t border-gray-200">
                <div className="text-gray-600 text-sm mb-2">Dial Gauges:</div>
                <div className="grid grid-cols-4 gap-2">
                  {dialGauges.map((gauge, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg p-2 text-center border border-gray-200"
                    >
                      <div className="text-xs text-gray-500">R{index + 1}</div>
                      <div className="text-gray-900">{gauge || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Remark */}
            <div>
              <label className="block text-gray-600 text-sm mb-2">
                Remark (Optional)
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add any notes or observations..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none text-sm"
              />
            </div>

            {/* Signature */}
            <div>
              <label className="block text-gray-600 text-sm mb-2">
                Signature / Initials <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <PenTool className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Enter your initials"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
            </div>

            {/* Confirmation Slider */}
            <div>
              <label className="block text-gray-600 text-sm mb-3">
                Slide to confirm reading accuracy
              </label>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="0"
                  onChange={handleSliderChange}
                  className="w-full h-12 appearance-none bg-gradient-to-r from-gray-200 to-green-500 rounded-full cursor-pointer slider"
                  style={{
                    background: confirmed
                      ? 'linear-gradient(to right, #10b981, #059669)'
                      : 'linear-gradient(to right, #e5e7eb, #10b981)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {confirmed ? (
                    <span className="text-white text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Confirmed
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">
                      Slide to confirm →
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!confirmed || !signature}
                className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  confirmed && signature
                    ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-5 h-5" />
                <span>Save Reading</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 48px;
          height: 48px;
          background: white;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          width: 48px;
          height: 48px;
          background: white;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(-50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}