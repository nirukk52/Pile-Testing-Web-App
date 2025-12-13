'use client';

import { useState } from 'react';
import { Check, ArrowLeft, PenTool, AlertTriangle } from 'lucide-react';
import type { LegacyProjectInfo, LegacyTestPhase } from '@/types';
import { calculateLoad } from '@/types';

/**
 * Data structure for a new reading.
 * Why: Defines all fields captured when adding a reading.
 */
export interface NewReadingData {
  date: string;
  time: string;
  pressure: string;
  dialGauge1: string;
  dialGauge2: string;
  dialGauge3: string;
  dialGauge4: string;
  dg1Enabled: boolean;
  dg2Enabled: boolean;
  dg3Enabled: boolean;
  dg4Enabled: boolean;
  remark: string;
  signature: string;
  phase: LegacyTestPhase;
}

/**
 * Props for the AddReadingPage component.
 * Why: Defines callbacks and context data.
 */
interface AddReadingPageProps {
  onSave: (data: NewReadingData) => void;
  onCancel: () => void;
  projectInfo: LegacyProjectInfo;
}

/**
 * Calculate average from enabled gauges only.
 * Why: Faulty gauges should be excluded from average calculation per IS 2911.
 */
function calculateAverageWithEnabled(
  g1: string, g2: string, g3: string, g4: string,
  e1: boolean, e2: boolean, e3: boolean, e4: boolean
): string {
  const values = [
    { value: g1, enabled: e1 },
    { value: g2, enabled: e2 },
    { value: g3, enabled: e3 },
    { value: g4, enabled: e4 },
  ]
    .filter((g) => g.enabled)
    .map((g) => parseFloat(g.value))
    .filter((v) => !isNaN(v));

  if (values.length > 0) {
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  }
  return '-';
}

/**
 * Full-page form for adding a single reading.
 * Why: Dedicated screen for accurate data entry with validation.
 */
export function AddReadingPage({ onSave, onCancel, projectInfo }: AddReadingPageProps) {
  const now = new Date();
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [time, setTime] = useState(now.toTimeString().slice(0, 5));
  const [pressure, setPressure] = useState('');
  const [dialGauge1, setDialGauge1] = useState('');
  const [dialGauge2, setDialGauge2] = useState('');
  const [dialGauge3, setDialGauge3] = useState('');
  const [dialGauge4, setDialGauge4] = useState('');
  const [dg1Enabled, setDg1Enabled] = useState(true);
  const [dg2Enabled, setDg2Enabled] = useState(true);
  const [dg3Enabled, setDg3Enabled] = useState(true);
  const [dg4Enabled, setDg4Enabled] = useState(true);
  const [remark, setRemark] = useState('');
  const [signature, setSignature] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<LegacyTestPhase>('loading');

  const load = calculateLoad(pressure, projectInfo.ramArea);
  const average = calculateAverageWithEnabled(
    dialGauge1, dialGauge2, dialGauge3, dialGauge4,
    dg1Enabled, dg2Enabled, dg3Enabled, dg4Enabled
  );

  // Count enabled gauges
  const enabledCount = [dg1Enabled, dg2Enabled, dg3Enabled, dg4Enabled].filter(Boolean).length;
  const hasDisabledGauge = enabledCount < 4;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setConfirmed(value === 100);
  };

  const isFormValid = () => {
    // At least one gauge must be enabled
    if (enabledCount === 0) return false;

    // Check required fields for enabled gauges only
    const hasRequiredGaugeValues = 
      (!dg1Enabled || dialGauge1) &&
      (!dg2Enabled || dialGauge2) &&
      (!dg3Enabled || dialGauge3) &&
      (!dg4Enabled || dialGauge4);

    return (
      date &&
      time &&
      pressure &&
      hasRequiredGaugeValues &&
      signature &&
      confirmed
    );
  };

  const handleSave = () => {
    if (isFormValid()) {
      onSave({
        date,
        time,
        pressure,
        dialGauge1: dialGauge1 || '0',
        dialGauge2: dialGauge2 || '0',
        dialGauge3: dialGauge3 || '0',
        dialGauge4: dialGauge4 || '0',
        dg1Enabled,
        dg2Enabled,
        dg3Enabled,
        dg4Enabled,
        remark,
        signature,
        phase,
      });
    }
  };

  const inputClass =
    'w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900';
  const disabledInputClass =
    'w-full h-12 px-4 rounded-lg border border-red-200 bg-red-50 text-red-400 line-through cursor-not-allowed';
  const labelClass = 'block text-sm text-slate-600 mb-2';

  /**
   * Render a dial gauge input with enable/disable toggle.
   * Why: Allows marking faulty gauges per IS 2911 requirements.
   */
  const renderGaugeInput = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    enabled: boolean,
    setEnabled: (v: boolean) => void
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-sm ${enabled ? 'text-slate-600' : 'text-red-500 font-medium'}`}>
          {label} {enabled && <span className="text-rose-600">*</span>}
          {!enabled && (
            <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
              FAULTY
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          {enabled ? '✓ Working' : '✗ Faulty'}
        </button>
      </div>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={enabled ? '0.00' : 'Disabled'}
        disabled={!enabled}
        className={enabled ? inputClass : disabledInputClass}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-slate-800 text-white sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-white font-semibold">Add New Reading</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4 pb-24">
        {/* Date & Time Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800 font-semibold">Date & Time</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Time (24h) <span className="text-rose-600">*</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Pressure & Load Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800 font-semibold">Pressure & Load</h2>

          <div>
            <label className={labelClass}>
              Pressure Gauge (kg/cm²) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
              placeholder="e.g., 50.00"
              className={inputClass}
            />
          </div>

          {/* Calculated Load Display */}
          {pressure && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-blue-700">Calculated Load:</span>
                <span className="text-blue-900 font-semibold text-lg">{load} MT</span>
              </div>
            </div>
          )}
        </div>

        {/* Dial Gauge Readings Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-800 font-semibold">Dial Gauge Readings</h2>
            {hasDisabledGauge && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {4 - enabledCount} faulty
              </span>
            )}
          </div>

          {/* Warning if gauges are disabled */}
          {enabledCount === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-700 text-sm">At least one gauge must be working</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {renderGaugeInput('R1 (mm)', dialGauge1, setDialGauge1, dg1Enabled, setDg1Enabled)}
            {renderGaugeInput('R2 (mm)', dialGauge2, setDialGauge2, dg2Enabled, setDg2Enabled)}
            {renderGaugeInput('R3 (mm)', dialGauge3, setDialGauge3, dg3Enabled, setDg3Enabled)}
            {renderGaugeInput('R4 (mm)', dialGauge4, setDialGauge4, dg4Enabled, setDg4Enabled)}
          </div>

          {/* Average Display */}
          {enabledCount > 0 && average !== '-' && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-green-700">Average Settlement:</span>
                  {hasDisabledGauge && (
                    <span className="text-green-600 text-xs ml-2">
                      (from {enabledCount} gauge{enabledCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                <span className="text-green-900 font-semibold text-lg">{average} mm</span>
              </div>
            </div>
          )}
        </div>

        {/* Phase Selector Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800 font-semibold">Test Phase</h2>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPhase('loading')}
              className={`py-3 rounded-lg transition-all font-medium ${
                phase === 'loading'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Loading
            </button>
            <button
              type="button"
              onClick={() => setPhase('holding')}
              className={`py-3 rounded-lg transition-all font-medium ${
                phase === 'holding'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Holding
            </button>
            <button
              type="button"
              onClick={() => setPhase('unloading')}
              className={`py-3 rounded-lg transition-all font-medium ${
                phase === 'unloading'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unloading
            </button>
          </div>
        </div>

        {/* Remark Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800 font-semibold">Remark</h2>

          <div>
            <label className={labelClass}>Remark (Optional)</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add any notes or observations..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none text-slate-900"
            />
          </div>
        </div>

        {/* Signature Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800 font-semibold">Signature</h2>

          <div>
            <label className={labelClass}>
              Initials <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <PenTool className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Enter your initials"
                className="w-full pl-12 pr-4 h-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Confirmation Slider Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800 font-semibold">Confirm Reading</h2>

          <div>
            <label className={labelClass}>
              Slide to confirm reading accuracy <span className="text-rose-600">*</span>
            </label>
            <div className="relative mt-3">
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="0"
                onChange={handleSliderChange}
                className="w-full h-12 appearance-none rounded-full cursor-pointer"
                style={{
                  background: confirmed
                    ? 'linear-gradient(to right, #10b981, #059669)'
                    : 'linear-gradient(to right, #e5e7eb, #10b981)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {confirmed ? (
                  <span className="text-white text-sm flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4" />
                    Confirmed
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">Slide to confirm →</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid()}
            className={`flex-1 py-4 rounded-xl transition-all flex items-center justify-center gap-2 font-medium ${
              isFormValid()
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-5 h-5" />
            <span>Confirm & Save</span>
          </button>
        </div>
      </main>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 48px;
          height: 48px;
          background: white;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        input[type="range"]::-moz-range-thumb {
          width: 48px;
          height: 48px;
          background: white;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
