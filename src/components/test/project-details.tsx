'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Calculator, Loader2, CloudOff, Check, AlertTriangle, Pencil, RotateCcw } from 'lucide-react';
import type { LegacyProjectInfo, ExtractedProjectInfo } from '@/types';
import { TEST_TYPES } from '@/types';
import { useApiSync, useTestStore } from '@/store/test-store';
import { convertISOToDDMMYYYY, convertDDMMYYYYToISO } from '@/lib/utils';

/**
 * Field confidence data for highlighting low-confidence extractions.
 * Why: Maps project info fields to their confidence levels.
 */
export type FieldConfidenceMap = Partial<Record<keyof LegacyProjectInfo, number>>;

/**
 * Props for the ProjectDetails component.
 * Why: Defines data and callbacks for project info form.
 */
interface ProjectDetailsProps {
  projectInfo: LegacyProjectInfo;
  onUpdateField: <K extends keyof LegacyProjectInfo>(field: K, value: LegacyProjectInfo[K]) => void;
  onNext: () => void;
  /** Optional confidence scores for fields (0-100). Fields < 80 show warnings. */
  fieldConfidence?: FieldConfidenceMap;
  /** List of field names that need user verification */
  lowConfidenceFields?: string[];
}

/**
 * Gets the warning class for a field based on confidence level.
 * Why: Highlights low-confidence extracted fields for user review.
 */
function getConfidenceClass(confidence: number | undefined): string {
  if (confidence === undefined) return '';
  if (confidence < 50) return 'ring-2 ring-red-300 bg-red-50';
  if (confidence < 80) return 'ring-2 ring-amber-300 bg-amber-50';
  return '';
}

/**
 * Warning badge shown next to low-confidence field labels.
 * Why: Alerts users to verify extracted values that may need correction.
 */
function ConfidenceWarning({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined || confidence >= 80) return null;
  
  return (
    <span className={`ml-2 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
      confidence < 50 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    }`}>
      <AlertTriangle className="w-3 h-3" />
      {confidence < 50 ? 'Low conf' : 'Verify'}
    </span>
  );
}

/**
 * Form for entering project and pile specifications.
 * Why: Second step in test workflow - collects all metadata for IS 2911 compliant reports.
 * Upload tab handles field sheet extraction; this tab is for manual entry/editing.
 */
export function ProjectDetails({
  projectInfo,
  onUpdateField,
  onNext,
  fieldConfidence,
  lowConfidenceFields,
}: ProjectDetailsProps) {
  const { saveTestToApi } = useApiSync();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dismissedWarning, setDismissedWarning] = useState(false);
  /** Whether user is manually editing test load instead of auto-calculating */
  const [isTestLoadManual, setIsTestLoadManual] = useState(false);

  const handleChange = (field: keyof LegacyProjectInfo, value: string) => {
    onUpdateField(field, value as LegacyProjectInfo[typeof field]);
    setSaveStatus('idle'); // Reset save status when user makes changes
  };

  /**
   * Gets confidence for a field, handling naming differences.
   * Why: LegacyProjectInfo uses different names than ExtractedProjectInfo (e.g., mixedDesign vs concreteGrade).
   */
  const getFieldConfidence = (field: keyof LegacyProjectInfo): number | undefined => {
    if (!fieldConfidence) return undefined;
    
    // Map legacy field names to extracted field names
    const fieldMap: Partial<Record<keyof LegacyProjectInfo, keyof FieldConfidenceMap>> = {
      mixedDesign: 'concreteGrade' as keyof LegacyProjectInfo,
      designLoadOnPile: 'designLoad' as keyof LegacyProjectInfo,
    };
    
    const mappedField = fieldMap[field] || field;
    return fieldConfidence[mappedField];
  };

  // Get test type config for multiplier
  const testTypeConfig = TEST_TYPES.find(t => t.id === projectInfo.testType);
  const loadMultiplier = testTypeConfig?.loadMultiplier || 2.5;

  // Handle continue - save to API first
  const handleContinue = async () => {
    if (!isFormValid()) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await saveTestToApi();
      setSaveStatus('saved');
      onNext();
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('error');
      // Still allow proceeding with local data
      onNext();
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-calculate test load when design load changes (only if not in manual mode)
  useEffect(() => {
    if (isTestLoadManual) return; // Don't auto-calculate when user is manually editing
    
    if (projectInfo.designLoadOnPile) {
      const designLoad = parseFloat(projectInfo.designLoadOnPile);
      if (!isNaN(designLoad) && designLoad > 0) {
        const calculatedTestLoad = (designLoad * loadMultiplier).toFixed(2);
        if (projectInfo.testLoad !== calculatedTestLoad) {
          onUpdateField('testLoad', calculatedTestLoad);
        }
      }
    }
  }, [projectInfo.designLoadOnPile, loadMultiplier, projectInfo.testLoad, onUpdateField, isTestLoadManual]);

  /**
   * Gets the auto-calculated test load value.
   * Why: Shows user what the calculated value would be when in manual mode.
   */
  const getCalculatedTestLoad = (): string => {
    const designLoad = parseFloat(projectInfo.designLoadOnPile);
    if (!isNaN(designLoad) && designLoad > 0) {
      return (designLoad * loadMultiplier).toFixed(2);
    }
    return '';
  };

  /**
   * Reset test load to auto-calculated value.
   * Why: Allows user to switch back from manual override to auto-calculation.
   */
  const resetToAutoCalculated = () => {
    setIsTestLoadManual(false);
    const calculatedValue = getCalculatedTestLoad();
    if (calculatedValue) {
      onUpdateField('testLoad', calculatedValue);
    }
  };

  const isFormValid = () => {
    return (
      projectInfo.pileId &&
      projectInfo.project &&
      projectInfo.location &&
      projectInfo.contractor &&
      projectInfo.client &&
      projectInfo.ramArea &&
      projectInfo.pileDiameter &&
      projectInfo.designLoadOnPile
    );
  };

  const baseInputClass =
    'w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900';
  const labelClass = 'block text-xs text-slate-500 uppercase mb-1 font-medium';

  /**
   * Gets input class with confidence styling.
   * Why: Adds visual warning for low-confidence fields.
   */
  const getInputClass = (field: keyof LegacyProjectInfo): string => {
    const confidence = getFieldConfidence(field);
    const confidenceClass = getConfidenceClass(confidence);
    return `${baseInputClass} ${confidenceClass}`;
  };

  // Check if there are any low-confidence fields to show banner
  const hasLowConfidenceFields = lowConfidenceFields && lowConfidenceFields.length > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Verification Warning Banner */}
      {hasLowConfidenceFields && !dismissedWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-amber-800 font-semibold text-sm">Verify Extracted Data</h3>
              <p className="text-amber-700 text-sm mt-1">
                Some fields were extracted with low confidence. Please review the highlighted fields below:
              </p>
              <ul className="text-amber-700 text-sm mt-2 space-y-1">
                {lowConfidenceFields.map((field, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setDismissedWarning(true)}
              className="text-amber-600 hover:text-amber-800 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Test Type Badge */}
      {projectInfo.testType && (
        <div className="bg-blue-600 text-white rounded-xl border border-blue-700 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200 uppercase mb-1">Test Type</p>
              <h3 className="text-white font-semibold">{projectInfo.testType}</h3>
              <p className="text-blue-200 text-sm mt-1">
                Test Load = {loadMultiplier}× Design Load
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>
      )}

      {/* Pile Identification */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-slate-800 font-semibold text-lg">Pile Identification</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Pile ID <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('pileId')} />
            </label>
            <input
              type="text"
              value={projectInfo.pileId}
              onChange={(e) => handleChange('pileId', e.target.value)}
              placeholder="e.g., TP-02"
              className={getInputClass('pileId')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Report No.
              <ConfidenceWarning confidence={getFieldConfidence('reportNo')} />
            </label>
            <input
              type="text"
              value={projectInfo.reportNo}
              onChange={(e) => handleChange('reportNo', e.target.value)}
              placeholder="e.g., IVPLT-001"
              className={getInputClass('reportNo')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Test Date
              <ConfidenceWarning confidence={getFieldConfidence('testDate')} />
            </label>
            <input
              type="text"
              value={projectInfo.testDate ? convertISOToDDMMYYYY(projectInfo.testDate) : ''}
              onChange={(e) => {
                const value = e.target.value;
                // Allow user to type freely
                if (value === '' || /^[\d/]*$/.test(value)) {
                  // If complete format, convert to ISO
                  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                    handleChange('testDate', convertDDMMYYYYToISO(value));
                  } else {
                    // Store the partial input as-is for user feedback
                    handleChange('testDate', value);
                  }
                }
              }}
              placeholder="dd/mm/yyyy"
              className={getInputClass('testDate')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Date of Casting
              <ConfidenceWarning confidence={getFieldConfidence('dateOfCasting')} />
            </label>
            <input
              type="text"
              value={projectInfo.dateOfCasting ? convertISOToDDMMYYYY(projectInfo.dateOfCasting) : ''}
              onChange={(e) => {
                const value = e.target.value;
                // Allow user to type freely
                if (value === '' || /^[\d/]*$/.test(value)) {
                  // If complete format, convert to ISO
                  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                    handleChange('dateOfCasting', convertDDMMYYYYToISO(value));
                  } else {
                    // Store the partial input as-is for user feedback
                    handleChange('dateOfCasting', value);
                  }
                }
              }}
              placeholder="dd/mm/yyyy"
              className={getInputClass('dateOfCasting')}
            />
          </div>
        </div>
      </div>

      {/* Project Information */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-slate-800 font-semibold text-lg">Project Information</h2>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Project Name <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('project')} />
            </label>
            <input
              type="text"
              value={projectInfo.project}
              onChange={(e) => handleChange('project', e.target.value)}
              placeholder="e.g., Sewage Management System"
              className={getInputClass('project')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Location <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('location')} />
            </label>
            <input
              type="text"
              value={projectInfo.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Pandhak STP 75 MLD"
              className={getInputClass('location')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Client <span className="text-rose-600">*</span>
                <ConfidenceWarning confidence={getFieldConfidence('client')} />
              </label>
              <input
                type="text"
                value={projectInfo.client}
                onChange={(e) => handleChange('client', e.target.value)}
                placeholder="e.g., NMC"
                className={getInputClass('client')}
              />
            </div>

            <div>
              <label className={labelClass}>PMC</label>
              <input
                type="text"
                value={projectInfo.pmc}
                onChange={(e) => handleChange('pmc', e.target.value)}
                placeholder="(Optional)"
                className={baseInputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Contractor <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('contractor')} />
            </label>
            <input
              type="text"
              value={projectInfo.contractor}
              onChange={(e) => handleChange('contractor', e.target.value)}
              placeholder="e.g., KUMBH W. W.MANAGEMENT PVT.LTD."
              className={getInputClass('contractor')}
            />
          </div>
        </div>
      </div>

      {/* Pile Specifications */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-slate-800 font-semibold text-lg">Pile Specifications</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Pile Diameter (mm) <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('pileDiameter')} />
            </label>
            <input
              type="number"
              value={projectInfo.pileDiameter}
              onChange={(e) => handleChange('pileDiameter', e.target.value)}
              placeholder="600"
              className={getInputClass('pileDiameter')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Pile Depth (m)
              <ConfidenceWarning confidence={getFieldConfidence('pileDepth')} />
            </label>
            <input
              type="number"
              step="0.01"
              value={projectInfo.pileDepth}
              onChange={(e) => handleChange('pileDepth', e.target.value)}
              placeholder="10.31"
              className={getInputClass('pileDepth')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Concrete Grade
              <ConfidenceWarning confidence={getFieldConfidence('mixedDesign')} />
            </label>
            <input
              type="text"
              value={projectInfo.mixedDesign}
              onChange={(e) => handleChange('mixedDesign', e.target.value)}
              placeholder="M25"
              className={getInputClass('mixedDesign')}
            />
          </div>

          <div>
            <label className={labelClass}>
              Design Load (MT) <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('designLoadOnPile')} />
            </label>
            <input
              type="number"
              step="0.01"
              value={projectInfo.designLoadOnPile}
              onChange={(e) => handleChange('designLoadOnPile', e.target.value)}
              placeholder="147"
              className={getInputClass('designLoadOnPile')}
            />
          </div>
        </div>

        {/* Test Load - Auto-calculated or Manual */}
        {projectInfo.designLoadOnPile && (
          <div className={`rounded-lg p-4 border ${isTestLoadManual ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
            {isTestLoadManual ? (
              // Manual edit mode
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 font-medium">Manual Test Load Override</span>
                  </div>
                  <button
                    onClick={resetToAutoCalculated}
                    className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 transition-colors"
                    title="Reset to auto-calculated value"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    value={projectInfo.testLoad}
                    onChange={(e) => handleChange('testLoad', e.target.value)}
                    className="flex-1 h-12 px-4 rounded-lg border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-slate-900 font-semibold text-lg"
                    placeholder="Enter test load"
                  />
                  <span className="text-amber-900 font-medium">MT</span>
                </div>
                <p className="text-xs text-amber-600">
                  Auto-calculated: {getCalculatedTestLoad()} MT ({loadMultiplier}× Design Load)
                </p>
              </div>
            ) : (
              // Auto-calculated mode (default)
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-700">
                    Test Load ({loadMultiplier}× Design Load):
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-900 font-bold text-lg">{projectInfo.testLoad} MT</span>
                  <button
                    onClick={() => setIsTestLoadManual(true)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Edit test load manually"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Equipment Specifications */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-slate-800 font-semibold text-lg">Equipment Specifications</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Ram Area (cm²) <span className="text-rose-600">*</span>
              <ConfidenceWarning confidence={getFieldConfidence('ramArea')} />
            </label>
            <input
              type="number"
              step="0.01"
              value={projectInfo.ramArea}
              onChange={(e) => handleChange('ramArea', e.target.value)}
              placeholder="71.26"
              className={getInputClass('ramArea')}
            />
            <p className="text-xs text-slate-500 mt-1">
              Required to calculate load from pressure
            </p>
          </div>

          <div>
            <label className={labelClass}>LC of Dial Gauge (mm)</label>
            <input
              type="number"
              step="0.001"
              value={projectInfo.lcOfDialGauge}
              onChange={(e) => handleChange('lcOfDialGauge', e.target.value)}
              placeholder="0.01"
              className={baseInputClass}
            />
          </div>

          <div className="col-span-2">
            <label className={labelClass}>Hydraulic Jack Name</label>
            <input
              type="text"
              value={projectInfo.jackName}
              onChange={(e) => handleChange('jackName', e.target.value)}
              placeholder="e.g., Jack Serial No. / Make"
              className={baseInputClass}
            />
          </div>
        </div>
      </div>

      {/* Save Status Indicator */}
      {saveStatus !== 'idle' && (
        <div className={`rounded-lg p-3 flex items-center gap-2 text-sm ${
          saveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
          saveStatus === 'saved' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveStatus === 'saved' && <Check className="w-4 h-4" />}
          {saveStatus === 'error' && <CloudOff className="w-4 h-4" />}
          <span>
            {saveStatus === 'saving' && 'Saving to cloud...'}
            {saveStatus === 'saved' && 'Saved to cloud'}
            {saveStatus === 'error' && 'Failed to save. Please check connection and try again.'}
          </span>
        </div>
      )}

      {/* Continue Button */}
      <button
        onClick={handleContinue}
        disabled={!isFormValid() || isSaving}
        className={`w-full py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm font-semibold ${
          isFormValid() && !isSaving
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <span>Continue to Data Entry</span>
            <ChevronRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
