'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentSwarmResult } from '@/lib/ai/agent-swarm';
import { useTestStore } from '@/store/test-store';
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
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use store for extraction result persistence (survives tab navigation)
  const extractionResult = useTestStore((s) => s.extractionResult);
  const setExtractionResult = useTestStore((s) => s.setExtractionResult);
  const setLoadEntries = useTestStore((s) => s.setLoadEntries);

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
        // Extracted dates may be in formats like "9/12/15", "10-12-23", etc.
        let timestamp = new Date().toISOString();
        if (reading.date && reading.time) {
          try {
            // Try to parse the date - handle various formats
            const dateStr = reading.date;
            const timeStr = reading.time;
            
            // Try creating a date directly first
            const testDate = new Date(`${dateStr} ${timeStr}`);
            if (!isNaN(testDate.getTime())) {
              timestamp = testDate.toISOString();
            } else {
              // Fall back to current date with the extracted time
              const today = new Date();
              const [hours, minutes] = timeStr.split(':').map(Number);
              if (!isNaN(hours) && !isNaN(minutes)) {
                today.setHours(hours, minutes, 0, 0);
                timestamp = today.toISOString();
              }
            }
          } catch {
            // Keep default timestamp
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
          phase: 'loading', // Will be auto-detected in data entry
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

