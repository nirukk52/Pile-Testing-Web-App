'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Database, Cloud } from 'lucide-react';
import type { AgentSwarmResult } from '@/lib/ai/agent-swarm';
import { useTestStore, useApiSync } from '@/store/test-store';
import type { LegacyProjectInfo, LoadEntry, LegacyReading } from '@/types';

/**
 * Props for FieldUpload component.
 */
interface FieldUploadProps {
  onNext: () => void;
  projectInfo: LegacyProjectInfo;
  onUpdateField: <K extends keyof LegacyProjectInfo>(field: K, value: LegacyProjectInfo[K]) => void;
}

/**
 * Field Upload Tab - First tab for uploading field sheet PDFs.
 * Why: Runs Agent Swarm extraction to auto-fill project info and readings.
 * Big bold dropzone with submit button for easy mobile use.
 * Extraction result is persisted in the store so it survives tab navigation.
 */
export function FieldUpload({ onNext, projectInfo, onUpdateField }: FieldUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use store for extraction result persistence (survives tab navigation)
  const extractionResult = useTestStore((s) => s.extractionResult);
  const setExtractionResult = useTestStore((s) => s.setExtractionResult);
  const setLoadEntries = useTestStore((s) => s.setLoadEntries);
  const loadEntries = useTestStore((s) => s.loadEntries);
  
  // API sync methods for saving to database
  const { saveTestToApi, addReadingsBatchToApi } = useApiSync();

  /**
   * Handles file selection from dropzone or file input.
   */
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const selectedFile = files[0];
    
    // Validate PDF
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    
    // Validate size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size: 50MB');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setExtractionResult(null);
  };

  /**
   * Handles drag and drop.
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  /**
   * Runs the Agent Swarm extraction on the uploaded file.
   */
  const handleSubmit = async () => {
    if (!file) return;
    
    setIsExtracting(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Extraction failed');
      }
      
      const result: AgentSwarmResult = await response.json();
      setExtractionResult(result);
      
      // Auto-apply the extracted data
      applyExtractedData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      console.error('Extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * Applies extracted data to the store.
   * Why: Auto-fills project info and readings from AI extraction.
   */
  const applyExtractedData = (result: AgentSwarmResult) => {
    const pi = result.projectInfo.value;
    
    // Apply project info
    if (pi.pileId) onUpdateField('pileId', pi.pileId);
    if (pi.project) onUpdateField('project', pi.project);
    if (pi.location) onUpdateField('location', pi.location);
    if (pi.client) onUpdateField('client', pi.client);
    if (pi.contractor) onUpdateField('contractor', pi.contractor);
    if (pi.pileDiameter) onUpdateField('pileDiameter', String(pi.pileDiameter));
    if (pi.pileDepth) onUpdateField('pileDepth', String(pi.pileDepth));
    if (pi.designLoad) onUpdateField('designLoadOnPile', String(pi.designLoad));
    if (pi.ramArea) onUpdateField('ramArea', String(pi.ramArea));
    if (pi.concreteGrade) onUpdateField('mixedDesign', pi.concreteGrade);
    if (pi.testDate) onUpdateField('testDate', pi.testDate);
    if (pi.dateOfCasting) onUpdateField('dateOfCasting', pi.dateOfCasting);
    if (pi.reportNo) onUpdateField('reportNo', pi.reportNo);
    
    // Convert readings to LoadEntry format
    const ramArea = pi.ramArea || parseFloat(projectInfo.ramArea || '0');
    const loadEntries: LoadEntry[] = result.readings
      .filter(r => !r.isEmpty) // Skip empty placeholder rows
      .map((reading, index) => {
        const pressure = reading.pressure;
        const load = ramArea > 0 ? ((pressure * ramArea) / 1000).toFixed(2) : '0';
        
        // Create a valid timestamp from extracted date/time
        // CRITICAL: All extracted times are in IST (Asia/Kolkata, UTC+5:30)
        // We must create timestamps that represent IST time correctly
        let timestamp = new Date().toISOString();
        if (reading.date && reading.time) {
          try {
            const dateStr = reading.date; // e.g. "2025-12-09" or "9/12/2025"
            const timeStr = reading.time; // e.g. "04:30" (always IST)
            
            // Parse the date parts
            let year: number, month: number, day: number;
            
            // Try ISO format first (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              [year, month, day] = dateStr.split('-').map(Number);
            } 
            // Try DD/MM/YYYY or D/M/YYYY format
            else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
              const parts = dateStr.split('/').map(Number);
              day = parts[0];
              month = parts[1];
              year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
            }
            // Try DD-MM-YYYY format
            else if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(dateStr)) {
              const parts = dateStr.split('-').map(Number);
              day = parts[0];
              month = parts[1];
              year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
            }
            else {
              throw new Error('Unknown date format');
            }
            
            // Parse time parts
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
              // Create ISO string with IST offset (+05:30)
              // Format: YYYY-MM-DDTHH:MM:00+05:30
              const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`;
              const istDate = new Date(isoString);
              if (!isNaN(istDate.getTime())) {
                timestamp = istDate.toISOString();
              }
            }
          } catch {
            // Keep default timestamp on any parsing error
          }
        }
        
        const legacyReading: LegacyReading = {
          id: `extracted-${Date.now()}-${index}`,
          pressureGauge: String(pressure),
          load,
          dialGauge1: String(reading.dg1),
          dialGauge2: String(reading.dg2),
          dialGauge3: String(reading.dg3),
          dialGauge4: String(reading.dg4),
          dg1Enabled: true,
          dg2Enabled: true,
          dg3Enabled: true,
          dg4Enabled: true,
          timestamp,
          phase: reading.phase || 'loading', // Use extracted phase from agent swarm
          remark: reading.confidence === 'low' ? '⚠️ Low confidence' : '',
        };
        
        return {
          id: `entry-${Date.now()}-${index}`,
          pressureGauge: String(pressure),
          load,
          readings: [legacyReading],
          timestamp: legacyReading.timestamp,
        };
      });
    
    setLoadEntries(loadEntries);
  };

  /**
   * Saves extracted readings to the database.
   * Why: Persists all extracted readings in one batch operation for efficiency.
   * Uses batch API to insert all readings in a single transaction (~100ms vs 10-30s).
   */
  const handleSaveToDatabase = async () => {
    if (loadEntries.length === 0) {
      setError('No readings to save. Please extract data first.');
      return;
    }

    setIsSavingToDb(true);
    setSavedToDb(false);
    setError(null);
    setSaveProgress({ current: 0, total: loadEntries.length });

    try {
      // First save the test/project info to get a test ID
      await saveTestToApi();

      // Collect all readings from entries
      const allReadings = loadEntries
        .map((entry) => entry.readings[0])
        .filter((reading): reading is LegacyReading => reading !== undefined);

      // Batch save all readings in a single API call
      await addReadingsBatchToApi(allReadings);
      setSaveProgress({ current: loadEntries.length, total: loadEntries.length });

      setSavedToDb(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save readings to database');
      console.error('Save to database error:', err);
    } finally {
      setIsSavingToDb(false);
    }
  };

  /**
   * Continues to next tab (Details).
   */
  const handleContinue = () => {
    onNext();
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Upload Field Sheet
        </h2>
        <p className="text-slate-600">
          Upload your handwritten field sheet PDF for AI extraction
        </p>
      </div>

      {/* Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          relative border-4 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${file 
            ? 'border-green-400 bg-green-50' 
            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
          }
          ${isExtracting ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        {file ? (
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-green-800">{file.name}</p>
            <p className="text-sm text-green-600">
              {(file.size / 1024 / 1024).toFixed(2)} MB • Click to change
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-20 h-20 mx-auto bg-slate-200 rounded-full flex items-center justify-center">
              <Upload className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-slate-700">
              Drop PDF here
            </p>
            <p className="text-slate-500">
              or tap to browse files
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Extraction Failed</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {file && !extractionResult && (
        <button
          onClick={handleSubmit}
          disabled={isExtracting}
          className={`
            w-full py-5 rounded-2xl font-bold text-xl transition-all
            flex items-center justify-center gap-3
            ${isExtracting 
              ? 'bg-blue-400 text-white cursor-wait' 
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg'
            }
          `}
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Extracting Data...</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span>Extract Data</span>
            </>
          )}
        </button>
      )}

      {/* Extraction Result */}
      {extractionResult && (
        <div className="space-y-4">
          {/* Success Banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-green-800 text-lg">Extraction Complete!</p>
              <p className="text-sm text-green-600 mt-1">
                {extractionResult.extractedRowCount} readings extracted • {extractionResult.lowConfidenceCount} need review
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">
                {extractionResult.extractedRowCount}
              </p>
              <p className="text-xs text-blue-600 mt-1">Readings</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-700">
                {extractionResult.readings.filter(r => r.confidence === 'high').length}
              </p>
              <p className="text-xs text-green-600 mt-1">High Confidence</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-700">
                {extractionResult.lowConfidenceCount}
              </p>
              <p className="text-xs text-amber-600 mt-1">Need Review</p>
            </div>
          </div>

          {/* Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <span className="font-medium text-slate-700">View Extraction Details</span>
            {showDetails ? (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-500" />
            )}
          </button>

          {showDetails && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-4 text-sm">
              {/* Project Info */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Project Info</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(extractionResult.projectInfo.value).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-500">{key}:</span>
                      <span className={`font-medium ${
                        extractionResult.projectInfo.confidence[key as keyof typeof extractionResult.projectInfo.confidence] === 'high' 
                          ? 'text-slate-800' 
                          : 'text-amber-600'
                      }`}>
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Confidence Readings */}
              {extractionResult.lowConfidenceCount > 0 && (
                <div>
                  <h4 className="font-semibold text-amber-700 mb-2">
                    ⚠️ Low Confidence Readings ({extractionResult.lowConfidenceCount})
                  </h4>
                  <p className="text-slate-600">
                    These readings have calculated avgSettlement that differs from extracted avg by &gt;0.05mm.
                    Please review them in the Data Entry tab.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Save to Database Button */}
          {!savedToDb ? (
            <button
              onClick={handleSaveToDatabase}
              disabled={isSavingToDb || loadEntries.length === 0}
              className={`
                w-full py-5 rounded-2xl font-bold text-xl transition-all shadow-lg flex items-center justify-center gap-3
                ${isSavingToDb 
                  ? 'bg-blue-400 text-white cursor-wait' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }
                ${loadEntries.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isSavingToDb ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Saving {saveProgress.current}/{saveProgress.total}...</span>
                </>
              ) : (
                <>
                  <Database className="w-6 h-6" />
                  <span>Save Readings to Database</span>
                </>
              )}
            </button>
          ) : (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5 flex items-center justify-center gap-3">
              <Cloud className="w-6 h-6 text-green-600" />
              <span className="font-bold text-xl text-green-700">
                {loadEntries.length} Readings Saved to Database ✓
              </span>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full py-5 rounded-2xl font-bold text-xl bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-all shadow-lg flex items-center justify-center gap-3"
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>Continue to Details</span>
          </button>
        </div>
      )}

      {/* Skip Link */}
      {!extractionResult && (
        <button
          onClick={handleContinue}
          className="w-full py-3 text-slate-500 hover:text-slate-700 transition-colors"
        >
          Skip - Enter data manually →
        </button>
      )}
    </div>
  );
}


