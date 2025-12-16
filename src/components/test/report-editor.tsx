'use client';

/**
 * Report Editor Component
 * Why: Full-screen modal for editing and previewing reports before PDF generation.
 * Implements section-based editing as per report-generation-v2.md spec.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  X, Download, FileText, Loader2, AlertCircle, CheckCircle2, 
  XCircle, Edit3, Lock, ChevronRight, Image as ImageIcon,
  Sparkles, RotateCcw
} from 'lucide-react';
import type { LoadEntry, LegacyProjectInfo } from '@/types';
import type { CalculationResult, TestMeta } from '@/engines';

/**
 * Props for the ReportEditor component.
 */
interface ReportEditorProps {
  projectInfo: LegacyProjectInfo;
  loadEntries: LoadEntry[];
  testId?: string;
  result: CalculationResult;
  testMeta: TestMeta;
  testTypeConfig?: { id: string; name: string; fullName: string; loadMultiplier: number };
  chartRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

/**
 * Section configuration for the report editor.
 */
interface ReportSection {
  id: string;
  title: string;
  icon: typeof FileText;
  isLocked: boolean;
  description: string;
}

const REPORT_SECTIONS: ReportSection[] = [
  { id: 'cover', title: 'Cover Page', icon: FileText, isLocked: false, description: 'Title, project info, first site image' },
  { id: 'toc', title: 'Table of Contents', icon: FileText, isLocked: true, description: 'Auto-generated page numbers' },
  { id: 'general', title: '1.0 General', icon: FileText, isLocked: true, description: 'IS 2911 introduction' },
  { id: 'scope', title: '2.0 Scope of Work', icon: FileText, isLocked: false, description: 'Pile specifications' },
  { id: 'methodology', title: '3.0 Methodology', icon: FileText, isLocked: true, description: 'Test procedure' },
  { id: 'results', title: '4.0 Results', icon: FileText, isLocked: true, description: 'Calculated from readings' },
  { id: 'chart', title: '5.0 Chart Page', icon: FileText, isLocked: true, description: 'Key page - chart + KPIs' },
  { id: 'conclusion', title: '6.0 Conclusion', icon: Sparkles, isLocked: false, description: 'AI-generated, editable' },
  { id: 'data', title: '7.0 Data Table', icon: FileText, isLocked: true, description: 'Readings with signature column' },
  { id: 'images', title: '8.0 Site Images', icon: ImageIcon, isLocked: false, description: 'Select and caption images' },
];

/**
 * Report Editor Modal - Main component.
 */
export function ReportEditor({
  projectInfo,
  loadEntries,
  testId,
  result,
  testMeta,
  testTypeConfig,
  chartRef,
  onClose,
}: ReportEditorProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'modern'>('preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  
  // Editable fields
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [conclusion, setConclusion] = useState<string>('');
  const [isGeneratingConclusion, setIsGeneratingConclusion] = useState(false);

  // Fetch existing conclusion
  useEffect(() => {
    if (!testId) return;
    
    const fetchConclusion = async () => {
      try {
        const response = await fetch(`/api/tests/${testId}/conclusion`);
        if (response.ok) {
          const data = await response.json();
          if (data.conclusion) {
            setConclusion(data.conclusion);
          }
        }
      } catch (error) {
        console.error('Failed to fetch conclusion:', error);
      }
    };

    fetchConclusion();
  }, [testId]);

  /**
   * Generate AI conclusion.
   */
  const handleGenerateConclusion = useCallback(async () => {
    if (!testId) return;

    setIsGeneratingConclusion(true);
    try {
      const response = await fetch(`/api/tests/${testId}/conclusion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setConclusion(data.conclusion);
      }
    } catch (error) {
      console.error('Failed to generate conclusion:', error);
    } finally {
      setIsGeneratingConclusion(false);
    }
  }, [testId]);

  /**
   * Save conclusion to database.
   */
  const handleSaveConclusion = useCallback(async () => {
    if (!testId || !conclusion.trim()) return;

    try {
      const response = await fetch(`/api/tests/${testId}/conclusion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conclusion }),
      });
      
      if (response.ok) {
        setEditingSection(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to save conclusion:', errorData);
        alert('Failed to save conclusion. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save conclusion:', error);
      alert('Failed to save conclusion. Please try again.');
    }
  }, [testId, conclusion]);

  /**
   * Generate and download PDF report.
   */
  const handleGeneratePDF = useCallback(async () => {
    if (!testId) {
      setGenerateError('Test must be saved to database first');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      // Get chart as base64 if available
      let chartImageBase64: string | undefined;
      if (chartRef.current) {
        chartImageBase64 = chartRef.current.toDataURL('image/png');
      }

      const response = await fetch(`/api/tests/${testId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartImageBase64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const { filename, pdfBase64 } = await response.json();

      // Convert base64 to blob and download
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Close modal after successful download
      onClose();
    } catch (error) {
      console.error('PDF generation failed:', error);
      setGenerateError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  }, [testId, chartRef, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white w-full h-full md:w-[95%] md:h-[95%] md:rounded-xl md:shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-semibold">Generate Report</h2>
              <p className="text-slate-400 text-xs">
                {testTypeConfig?.fullName || 'IVPLT'} - {projectInfo.pileId || 'New Test'}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-800'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('modern')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'modern'
                  ? 'bg-white text-slate-800'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Modern Preview
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Print
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating || !testId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </header>

        {/* Error Message */}
        {generateError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4" />
            {generateError}
          </div>
        )}

        {/* Modal Content */}
        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'preview' ? (
            <PreviewTab
              projectInfo={projectInfo}
              loadEntries={loadEntries}
              result={result}
              testMeta={testMeta}
              testTypeConfig={testTypeConfig}
              conclusion={conclusion}
              setConclusion={setConclusion}
              editingSection={editingSection}
              setEditingSection={setEditingSection}
              onGenerateConclusion={handleGenerateConclusion}
              onSaveConclusion={handleSaveConclusion}
              isGeneratingConclusion={isGeneratingConclusion}
              testId={testId}
            />
          ) : (
            <ModernPreviewTab
              projectInfo={projectInfo}
              loadEntries={loadEntries}
              result={result}
              testMeta={testMeta}
              testTypeConfig={testTypeConfig}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Preview Tab - Shows formal PDF layout with section cards.
 */
interface PreviewTabProps {
  projectInfo: LegacyProjectInfo;
  loadEntries: LoadEntry[];
  result: CalculationResult;
  testMeta: TestMeta;
  testTypeConfig?: { id: string; name: string; fullName: string; loadMultiplier: number };
  conclusion: string;
  setConclusion: (value: string) => void;
  editingSection: string | null;
  setEditingSection: (value: string | null) => void;
  onGenerateConclusion: () => void;
  onSaveConclusion: () => void;
  isGeneratingConclusion: boolean;
  testId?: string;
}

function PreviewTab({
  projectInfo,
  result,
  testMeta,
  testTypeConfig,
  conclusion,
  setConclusion,
  editingSection,
  setEditingSection,
  onGenerateConclusion,
  onSaveConclusion,
  isGeneratingConclusion,
  testId,
}: PreviewTabProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Section List */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 overflow-auto flex-shrink-0">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Report Sections</h3>
          <div className="space-y-2">
            {REPORT_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => !section.isLocked && setEditingSection(section.id)}
                  disabled={section.isLocked}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    editingSection === section.id
                      ? 'bg-blue-50 border-blue-300'
                      : section.isLocked
                      ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${section.isLocked ? 'text-slate-400' : 'text-blue-600'}`} />
                      <span className={`text-sm font-medium ${section.isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                        {section.title}
                      </span>
                    </div>
                    {section.isLocked ? (
                      <Lock className="w-3 h-3 text-slate-400" />
                    ) : (
                      <Edit3 className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-6">{section.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Section Editor */}
      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        {editingSection === 'cover' && (
          <CoverSectionEditor
            projectInfo={projectInfo}
            testTypeConfig={testTypeConfig}
            testMeta={testMeta}
            onClose={() => setEditingSection(null)}
          />
        )}
        {editingSection === 'scope' && (
          <ScopeSectionEditor
            projectInfo={projectInfo}
            testMeta={testMeta}
            onClose={() => setEditingSection(null)}
          />
        )}
        {editingSection === 'conclusion' && (
          <ConclusionSectionEditor
            conclusion={conclusion}
            setConclusion={setConclusion}
            onGenerate={onGenerateConclusion}
            onSave={onSaveConclusion}
            isGenerating={isGeneratingConclusion}
            testId={testId}
            onClose={() => setEditingSection(null)}
          />
        )}
        {editingSection === 'images' && (
          <ImagesSectionEditor
            testId={testId}
            onClose={() => setEditingSection(null)}
          />
        )}
        {!editingSection && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Select a section to edit
              </h3>
              <p className="text-slate-500 text-sm">
                Click on any editable section from the list to customize your report.
                <br />
                Locked sections are auto-generated from your test data.
              </p>
            </div>

            {/* Quick Preview */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Report Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Project</p>
                  <p className="font-medium">{projectInfo.project || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Pile ID</p>
                  <p className="font-medium">{projectInfo.pileId || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Test Load</p>
                  <p className="font-medium">{testMeta.testLoadT.toFixed(1)} MT</p>
                </div>
                <div>
                  <p className="text-slate-500">Result</p>
                  <p className={`font-medium ${result.isPassed ? 'text-green-600' : 'text-red-600'}`}>
                    {result.isPassed ? '✓ PASSED' : '✗ FAILED'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Cover Section Editor.
 */
function CoverSectionEditor({
  projectInfo,
  testTypeConfig,
  testMeta,
  onClose,
}: {
  projectInfo: LegacyProjectInfo;
  testTypeConfig?: { id: string; name: string; fullName: string; loadMultiplier: number };
  testMeta: TestMeta;
  onClose: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Cover Page</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 rounded-lg p-6 text-center mb-4">
            <h1 className="text-xl font-bold text-blue-800 uppercase mb-2">
              {testTypeConfig?.fullName || 'INITIAL VERTICAL PILE LOAD TEST'}
            </h1>
            <h2 className="text-lg font-semibold text-slate-700">
              ON {projectInfo.pileDiameter || '600'}mm DIA PILE
            </h2>
            <h2 className="text-base text-slate-600">
              FOR {projectInfo.project || 'Project Name'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              AT {projectInfo.location || 'Location'}
            </p>
            <p className="text-sm text-slate-400">
              (TEST PILE {projectInfo.pileId || 'TP-01'})
            </p>
          </div>
          <p className="text-sm text-slate-500 text-center">
            The cover title is auto-generated from project details.
            <br />
            Edit project info in the Details tab to update.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Scope Section Editor.
 */
function ScopeSectionEditor({
  projectInfo,
  testMeta,
  onClose,
}: {
  projectInfo: LegacyProjectInfo;
  testMeta: TestMeta;
  onClose: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">2.0 Scope of Work</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-2 text-slate-500">Location</td>
                <td className="py-2 font-medium">{projectInfo.location || '-'}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-slate-500">Pile ID</td>
                <td className="py-2 font-medium">{projectInfo.pileId || '-'}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-slate-500">Pile Diameter</td>
                <td className="py-2 font-medium">{testMeta.pileDiameterMm} mm</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-slate-500">Pile Depth</td>
                <td className="py-2 font-medium">{testMeta.pileDepthM} m</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 text-slate-500">Design Load</td>
                <td className="py-2 font-medium">{testMeta.designLoadT} MT</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Test Load</td>
                <td className="py-2 font-medium">{testMeta.testLoadT} MT</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-slate-500 text-center mt-4">
            Pile specifications are pulled from project details.
            <br />
            Edit in the Details tab to update.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Conclusion Section Editor.
 */
function ConclusionSectionEditor({
  conclusion,
  setConclusion,
  onGenerate,
  onSave,
  isGenerating,
  testId,
  onClose,
}: {
  conclusion: string;
  setConclusion: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  isGenerating: boolean;
  testId?: string;
  onClose: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">6.0 Conclusion</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !testId}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : conclusion ? 'Regenerate' : 'Generate with AI'}
            </button>
            {conclusion && (
              <button
                onClick={() => setConclusion('')}
                className="px-3 py-2 text-slate-600 hover:text-slate-800 text-sm flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
          
          <textarea
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Enter conclusion text or generate with AI..."
            className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave();
              }}
              disabled={!conclusion.trim() || !testId}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Save Conclusion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Images Section Editor.
 */
function ImagesSectionEditor({
  testId,
  onClose,
}: {
  testId?: string;
  onClose: () => void;
}) {
  const [images, setImages] = useState<Array<{ id: string; url: string; caption?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testId) {
      setLoading(false);
      return;
    }

    const fetchImages = async () => {
      try {
        const response = await fetch(`/api/tests/${testId}/images`);
        if (response.ok) {
          const data = await response.json();
          setImages(data.images || []);
        }
      } catch (error) {
        console.error('Failed to fetch images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [testId]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">8.0 Site Images</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No images uploaded yet.</p>
              <p className="text-sm">Go to the Images tab to upload site photos.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {images.map((img, index) => (
                  <div key={img.id} className="relative rounded-lg overflow-hidden border border-slate-200">
                    <img src={img.url} alt={`Site ${index + 1}`} className="w-full h-32 object-cover" />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {index === 0 ? 'Cover' : index === 1 ? 'TOC' : `Image ${index + 1}`}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 text-center">
                Image 1 appears on cover, Image 2 on table of contents.
                <br />
                Remaining images appear in the Site Images section.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Modern Preview Tab - Shows web-styled view.
 */
function ModernPreviewTab({
  projectInfo,
  result,
  testMeta,
  testTypeConfig,
}: {
  projectInfo: LegacyProjectInfo;
  loadEntries: LoadEntry[];
  result: CalculationResult;
  testMeta: TestMeta;
  testTypeConfig?: { id: string; name: string; fullName: string; loadMultiplier: number };
}) {
  return (
    <div className="flex-1 overflow-auto bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Pass/Fail Banner */}
        <div
          className={`rounded-xl p-6 text-center ${
            result.isPassed
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-red-50 border-2 border-red-200'
          }`}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            {result.isPassed ? (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            ) : (
              <XCircle className="w-10 h-10 text-red-600" />
            )}
            <span className={`text-3xl font-bold ${result.isPassed ? 'text-green-700' : 'text-red-700'}`}>
              TEST {result.isPassed ? 'PASSED' : 'FAILED'}
            </span>
          </div>
          <p className={`text-lg ${result.isPassed ? 'text-green-600' : 'text-red-600'}`}>
            Net Settlement: {result.netSettlementMm.toFixed(2)}mm (Limit: {result.settlementLimitMm}mm)
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Test Load</p>
            <p className="text-2xl font-bold text-slate-800">{testMeta.testLoadT.toFixed(1)} MT</p>
            <p className="text-xs text-blue-600">{testTypeConfig?.loadMultiplier || 2.5}× Design</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Max Settlement</p>
            <p className="text-2xl font-bold text-slate-800">{result.maxSettlementMm.toFixed(2)} mm</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Elastic Rebound</p>
            <p className="text-2xl font-bold text-slate-800">{result.elasticReboundMm.toFixed(2)} mm</p>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border-2 ${
            result.isPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Net Settlement</p>
            <p className={`text-2xl font-bold ${result.isPassed ? 'text-green-700' : 'text-red-700'}`}>
              {result.netSettlementMm.toFixed(2)} mm
            </p>
            <p className={`text-xs ${result.isPassed ? 'text-green-600' : 'text-red-600'}`}>
              Limit: {result.settlementLimitMm}mm
            </p>
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Project Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Project</p>
              <p className="font-medium">{projectInfo.project || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Location</p>
              <p className="font-medium">{projectInfo.location || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Pile ID</p>
              <p className="font-medium">{projectInfo.pileId || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Diameter</p>
              <p className="font-medium">{projectInfo.pileDiameter || '-'} mm</p>
            </div>
            <div>
              <p className="text-slate-500">Depth</p>
              <p className="font-medium">{projectInfo.pileDepth || '-'} m</p>
            </div>
            <div>
              <p className="text-slate-500">Design Load</p>
              <p className="font-medium">{testMeta.designLoadT.toFixed(1)} MT</p>
            </div>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Load vs Settlement Chart</h3>
          <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
            Chart preview from Report Summary
          </div>
        </div>
      </div>
    </div>
  );
}
