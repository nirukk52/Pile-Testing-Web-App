'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Calculator, Loader2, CloudOff, Check } from 'lucide-react';
import type { LegacyProjectInfo } from '@/types';
import { TEST_TYPES } from '@/types';
import { useApiSync, useTestStore } from '@/store/test-store';
import { convertISOToDDMMYYYY, convertDDMMYYYYToISO } from '@/lib/utils';

/**
 * Props for the ProjectDetails component.
 * Why: Defines data and callbacks for project info form.
 */
interface ProjectDetailsProps {
  projectInfo: LegacyProjectInfo;
  onUpdateField: <K extends keyof LegacyProjectInfo>(field: K, value: LegacyProjectInfo[K]) => void;
  onNext: () => void;
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
}: ProjectDetailsProps) {
  const { saveTestToApi } = useApiSync();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleChange = (field: keyof LegacyProjectInfo, value: string) => {
    onUpdateField(field, value as LegacyProjectInfo[typeof field]);
    setSaveStatus('idle'); // Reset save status when user makes changes
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

  // Auto-calculate test load when design load changes
  useEffect(() => {
    if (projectInfo.designLoadOnPile) {
      const designLoad = parseFloat(projectInfo.designLoadOnPile);
      if (!isNaN(designLoad) && designLoad > 0) {
        const calculatedTestLoad = (designLoad * loadMultiplier).toFixed(2);
        if (projectInfo.testLoad !== calculatedTestLoad) {
          onUpdateField('testLoad', calculatedTestLoad);
        }
      }
    }
  }, [projectInfo.designLoadOnPile, loadMultiplier, projectInfo.testLoad, onUpdateField]);

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

  const inputClass =
    'w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900';
  const labelClass = 'block text-xs text-slate-500 uppercase mb-1 font-medium';

  return (
    <div className="p-4 space-y-4">
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
            </label>
            <input
              type="text"
              value={projectInfo.pileId}
              onChange={(e) => handleChange('pileId', e.target.value)}
              placeholder="e.g., TP-02"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Report No.
            </label>
            <input
              type="text"
              value={projectInfo.reportNo}
              onChange={(e) => handleChange('reportNo', e.target.value)}
              placeholder="e.g., IVPLT-001"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Test Date</label>
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
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Date of Casting</label>
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
              className={inputClass}
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
            </label>
            <input
              type="text"
              value={projectInfo.project}
              onChange={(e) => handleChange('project', e.target.value)}
              placeholder="e.g., Sewage Management System"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Location <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={projectInfo.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Pandhak STP 75 MLD"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Client <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={projectInfo.client}
                onChange={(e) => handleChange('client', e.target.value)}
                placeholder="e.g., NMC"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>PMC</label>
              <input
                type="text"
                value={projectInfo.pmc}
                onChange={(e) => handleChange('pmc', e.target.value)}
                placeholder="(Optional)"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Contractor <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={projectInfo.contractor}
              onChange={(e) => handleChange('contractor', e.target.value)}
              placeholder="e.g., KUMBH W. W.MANAGEMENT PVT.LTD."
              className={inputClass}
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
            </label>
            <input
              type="number"
              value={projectInfo.pileDiameter}
              onChange={(e) => handleChange('pileDiameter', e.target.value)}
              placeholder="600"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Pile Depth (m)</label>
            <input
              type="number"
              step="0.01"
              value={projectInfo.pileDepth}
              onChange={(e) => handleChange('pileDepth', e.target.value)}
              placeholder="10.31"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Concrete Grade</label>
            <input
              type="text"
              value={projectInfo.mixedDesign}
              onChange={(e) => handleChange('mixedDesign', e.target.value)}
              placeholder="M25"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Design Load (MT) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={projectInfo.designLoadOnPile}
              onChange={(e) => handleChange('designLoadOnPile', e.target.value)}
              placeholder="147"
              className={inputClass}
            />
          </div>
        </div>

        {/* Auto-calculated Test Load */}
        {projectInfo.designLoadOnPile && projectInfo.testLoad && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                <span className="text-blue-700">
                  Test Load ({loadMultiplier}× Design Load):
                </span>
              </div>
              <span className="text-blue-900 font-bold text-lg">{projectInfo.testLoad} MT</span>
            </div>
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
            </label>
            <input
              type="number"
              step="0.01"
              value={projectInfo.ramArea}
              onChange={(e) => handleChange('ramArea', e.target.value)}
              placeholder="71.26"
              className={inputClass}
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
              className={inputClass}
            />
          </div>

          <div className="col-span-2">
            <label className={labelClass}>Hydraulic Jack Name</label>
            <input
              type="text"
              value={projectInfo.jackName}
              onChange={(e) => handleChange('jackName', e.target.value)}
              placeholder="e.g., Jack Serial No. / Make"
              className={inputClass}
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
