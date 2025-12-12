import { ChevronRight } from 'lucide-react';
import { ProjectInfo } from '../App';

interface ProjectDetailsProps {
  projectInfo: ProjectInfo;
  setProjectInfo: (info: ProjectInfo) => void;
  onNext: () => void;
}

export function ProjectDetails({
  projectInfo,
  setProjectInfo,
  onNext,
}: ProjectDetailsProps) {
  const handleChange = (field: keyof ProjectInfo, value: string) => {
    setProjectInfo({ ...projectInfo, [field]: value });
  };

  const isFormValid = () => {
    return (
      projectInfo.reportNo &&
      projectInfo.project &&
      projectInfo.location &&
      projectInfo.contractor &&
      projectInfo.client &&
      projectInfo.ramArea
    );
  };

  const inputClass = "w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900";
  const labelClass = "block text-xs text-slate-500 uppercase mb-1";

  return (
    <div className="p-4 space-y-4">
      {/* Test Type Badge */}
      {projectInfo.testType && (
        <div className="bg-blue-600 text-white rounded-xl border border-blue-700 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200 uppercase mb-1">Test Type</p>
              <h3 className="text-white">{projectInfo.testType}</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-slate-800">Project Information</h2>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Report No. <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={projectInfo.reportNo}
              onChange={(e) => handleChange('reportNo', e.target.value)}
              placeholder="e.g., TP-04"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Project <span className="text-rose-600">*</span>
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
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-slate-800">Test Specifications</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              LC of Dial Gauge (mm)
            </label>
            <input
              type="text"
              value={projectInfo.lcOfDialGauge}
              onChange={(e) => handleChange('lcOfDialGauge', e.target.value)}
              placeholder="0.01"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Design Load (T)
            </label>
            <input
              type="text"
              value={projectInfo.designLoadOnPile}
              onChange={(e) =>
                handleChange('designLoadOnPile', e.target.value)
              }
              placeholder="3.5"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Mixed Design
            </label>
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
              Pile Diameter (mm)
            </label>
            <input
              type="text"
              value={projectInfo.pileDiameter}
              onChange={(e) => handleChange('pileDiameter', e.target.value)}
              placeholder="600"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Ram Area (cm²) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={projectInfo.ramArea}
              onChange={(e) => handleChange('ramArea', e.target.value)}
              placeholder="71.26"
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">Required to calculate pressure from load</p>
          </div>

          <div>
            <label className={labelClass}>
              Date of Casting
            </label>
            <input
              type="date"
              value={projectInfo.dateOfCasting}
              onChange={(e) => handleChange('dateOfCasting', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="col-span-2">
            <label className={labelClass}>
              Pile Depth (m)
            </label>
            <input
              type="text"
              value={projectInfo.pileDepth}
              onChange={(e) => handleChange('pileDepth', e.target.value)}
              placeholder="10.31"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!isFormValid()}
        className={`w-full py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm ${
          isFormValid()
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        <span>Continue to Data Entry</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}