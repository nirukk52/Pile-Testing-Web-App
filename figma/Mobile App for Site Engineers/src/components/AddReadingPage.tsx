import { useState } from 'react';
import { Check, X, PenTool, ArrowLeft } from 'lucide-react';
import { ProjectInfo } from '../App';

interface AddReadingPageProps {
  onSave: (data: {
    date: string;
    time: string;
    pressure: string;
    dialGauge1: string;
    dialGauge2: string;
    dialGauge3: string;
    dialGauge4: string;
    remark: string;
    signature: string;
    phase: 'loading' | 'holding' | 'unloading';
  }) => void;
  onCancel: () => void;
  projectInfo: ProjectInfo;
}

export function AddReadingPage({ onSave, onCancel, projectInfo }: AddReadingPageProps) {
  const now = new Date();
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [time, setTime] = useState(now.toTimeString().slice(0, 5));
  const [pressure, setPressure] = useState('');
  const [dialGauge1, setDialGauge1] = useState('');
  const [dialGauge2, setDialGauge2] = useState('');
  const [dialGauge3, setDialGauge3] = useState('');
  const [dialGauge4, setDialGauge4] = useState('');
  const [remark, setRemark] = useState('');
  const [signature, setSignature] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'holding' | 'unloading'>('loading');

  // Calculate load from pressure
  const calculateLoad = () => {
    const ramArea = parseFloat(projectInfo.ramArea);
    const pressureValue = parseFloat(pressure);
    if (ramArea && pressureValue) {
      return ((pressureValue * ramArea) / 1000).toFixed(2);
    }
    return '-';
  };

  // Calculate average of dial gauges
  const calculateAverage = () => {
    const values = [dialGauge1, dialGauge2, dialGauge3, dialGauge4]
      .map((g) => parseFloat(g))
      .filter((v) => !isNaN(v) && v !== 0);

    if (values.length > 0) {
      return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    }
    return '-';
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setConfirmed(value === 100);
  };

  const isFormValid = () => {
    return (
      date &&
      time &&
      pressure &&
      dialGauge1 &&
      dialGauge2 &&
      dialGauge3 &&
      dialGauge4 &&
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
        dialGauge1,
        dialGauge2,
        dialGauge3,
        dialGauge4,
        remark,
        signature,
        phase,
      });
    }
  };

  const load = calculateLoad();
  const average = calculateAverage();

  const inputClass = "w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900";
  const labelClass = "block text-sm text-slate-600 mb-2";

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
          <h1 className="flex-1 text-center text-white">Add New Reading</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4 pb-24">
        {/* Date & Time Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800">Date & Time</h2>
          
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
                Time <span className="text-rose-600">*</span>
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
          <h2 className="text-slate-800">Pressure & Load</h2>
          
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
          <h2 className="text-slate-800">Dial Gauge Readings</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                R1 (mm) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={dialGauge1}
                onChange={(e) => setDialGauge1(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            
            <div>
              <label className={labelClass}>
                R2 (mm) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={dialGauge2}
                onChange={(e) => setDialGauge2(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            
            <div>
              <label className={labelClass}>
                R3 (mm) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={dialGauge3}
                onChange={(e) => setDialGauge3(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            
            <div>
              <label className={labelClass}>
                R4 (mm) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={dialGauge4}
                onChange={(e) => setDialGauge4(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          </div>

          {/* Average Display */}
          {dialGauge1 && dialGauge2 && dialGauge3 && dialGauge4 && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-green-700">Average Settlement:</span>
                <span className="text-green-900 font-semibold text-lg">{average} mm</span>
              </div>
            </div>
          )}
        </div>

        {/* Phase Selector Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800">Test Phase</h2>
          
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPhase('loading')}
              className={`py-3 rounded-lg transition-all ${
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
              className={`py-3 rounded-lg transition-all ${
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
              className={`py-3 rounded-lg transition-all ${
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
          <h2 className="text-slate-800">Remark</h2>
          
          <div>
            <label className={labelClass}>
              Remark (Optional)
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add any notes or observations..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
            />
          </div>
        </div>

        {/* Signature Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800">Signature</h2>
          
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
                className="w-full pl-12 pr-4 h-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Confirmation Slider Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-slate-800">Confirm Reading</h2>
          
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
                className="w-full h-12 appearance-none rounded-full cursor-pointer slider"
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
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid()}
            className={`flex-1 py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
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
      `}</style>
    </div>
  );
}