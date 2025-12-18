'use client';

import { useState } from 'react';
import { X, Check, AlertTriangle, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import type { IngestionJob, ExtractedReading, ExtractedProjectInfo } from '@/types';
import { ConfidenceIndicator } from '@/components/ui/score-badge';

/**
 * Props for ExtractionPreviewModal.
 * Why: Defines the extracted data and callbacks for user actions.
 */
interface ExtractionPreviewModalProps {
  job: IngestionJob;
  onApply: (projectInfo: ExtractedProjectInfo, readings: ExtractedReading[]) => void;
  onCancel: () => void;
}

/**
 * Extraction Preview Modal
 * Why: Shows extracted data with confidence scores for user review.
 * Allows applying extracted data to the test form.
 */
export function ExtractionPreviewModal({
  job,
  onApply,
  onCancel,
}: ExtractionPreviewModalProps) {
  const [showAllReadings, setShowAllReadings] = useState(false);

  const projectInfo = job.extractedProjectInfo || {};
  const readings = job.extractedReadings || [];
  const displayReadings = showAllReadings ? readings : readings.slice(0, 5);

  // Count low confidence fields
  const lowConfidenceCount = job.lowConfidenceFields?.length || 0;

  const handleApply = () => {
    onApply(projectInfo, readings);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Extraction Preview</h2>
              <p className="text-sm text-slate-500">{job.fileName}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Confidence Banner */}
        <div className={`px-6 py-3 flex items-center gap-3 ${
          job.overallConfidence >= 90 ? 'bg-green-50' :
          job.overallConfidence >= 70 ? 'bg-amber-50' : 'bg-red-50'
        }`}>
          {job.overallConfidence >= 90 ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              job.overallConfidence >= 90 ? 'text-green-700' :
              job.overallConfidence >= 70 ? 'text-amber-700' : 'text-red-700'
            }`}>
              Extraction confidence: {job.overallConfidence}%
              {lowConfidenceCount > 0 && ` • ${lowConfidenceCount} fields need review`}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Project Info */}
          {Object.keys(projectInfo).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3">
                Project Information
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(projectInfo).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 capitalize mb-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${
                        value.confidence < 80 ? 'text-amber-700' : 'text-slate-800'
                      }`}>
                        {value.value || '-'}
                      </p>
                      <ConfidenceIndicator confidence={value.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Readings */}
          {readings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3">
                Readings ({readings.length} extracted)
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Pressure</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">DG1</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">DG2</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">DG3</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">DG4</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Conf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayReadings.map((reading, index) => {
                      const avgConf = Math.round(
                        (reading.pressureGauge.confidence +
                          reading.dialGauge1.confidence +
                          reading.dialGauge2.confidence +
                          reading.dialGauge3.confidence +
                          reading.dialGauge4.confidence) / 5
                      );
                      const isLowConf = avgConf < 80;

                      return (
                        <tr
                          key={index}
                          className={`border-t border-slate-100 ${isLowConf ? 'bg-amber-50' : ''}`}
                        >
                          <td className="px-3 py-2 text-slate-600">{index + 1}</td>
                          <td className="px-3 py-2 font-medium">{reading.pressureGauge.value}</td>
                          <td className="px-3 py-2">{reading.dialGauge1.value}</td>
                          <td className="px-3 py-2">{reading.dialGauge2.value}</td>
                          <td className="px-3 py-2">{reading.dialGauge3.value}</td>
                          <td className="px-3 py-2">{reading.dialGauge4.value}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-medium ${
                              avgConf >= 90 ? 'text-green-600' :
                              avgConf >= 70 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {avgConf}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {readings.length > 5 && (
                  <button
                    onClick={() => setShowAllReadings(!showAllReadings)}
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {showAllReadings ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show All {readings.length} Readings
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {job.lowConfidenceFields && job.lowConfidenceFields.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-800 mb-2">
                ⚠️ Review Required
              </h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {job.lowConfidenceFields.map((field, i) => (
                  <li key={i}>• {field}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={readings.length === 0}
            className="flex-1 max-w-xs px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Apply to Form ({readings.length} readings)
          </button>
        </div>
      </div>
    </div>
  );
}
