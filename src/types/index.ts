/**
 * Supported pile load test types per IS 2911.
 * Why: Different test types have different load calculations and pass criteria.
 * The code is used for report generation and data validation.
 */
export type TestType = 'IVPLT' | 'RVPLT' | 'PULLOUT' | 'LATERAL';

/**
 * Configuration for each test type displayed in the UI.
 * Why: Provides human-readable labels and descriptions for test type selection,
 * helping field engineers choose the correct test type for their data.
 */
export interface TestTypeConfig {
  code: TestType;
  name: string;
  description: string;
  loadMultiplier: string;
}

/**
 * Available test types with their configurations.
 * Why: Centralized source of truth for test type metadata used across
 * the upload screen and report generation.
 */
export const TEST_TYPES: TestTypeConfig[] = [
  {
    code: 'IVPLT',
    name: 'Initial Vertical',
    description: 'Initial Static Vertical Pile Load Test',
    loadMultiplier: '2.5x Design Load',
  },
  {
    code: 'RVPLT',
    name: 'Routine Vertical',
    description: 'Routine Static Vertical Pile Load Test',
    loadMultiplier: '1.5x Design Load',
  },
  {
    code: 'PULLOUT',
    name: 'Pullout Test',
    description: 'Pile Pullout / Uplift Load Test',
    loadMultiplier: '2.5x Design Load',
  },
  {
    code: 'LATERAL',
    name: 'Lateral Test',
    description: 'Lateral Load Test on Pile',
    loadMultiplier: '2.5x Design Load',
  },
];

/**
 * Represents an uploaded file with preview capabilities.
 * Why: Stores both the file object and generated preview URL
 * for displaying thumbnails of uploaded images/PDFs.
 */
export interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

// ============================================
// OCR EXTRACTION TYPES
// ============================================

/**
 * A single extracted value with its OCR confidence score.
 * Why: Allows the verify UI to highlight low-confidence values (red background)
 * so engineers know which values need manual verification.
 */
export interface OCRValue<T = string | number | null> {
  value: T;
  confidence: number;
}

/**
 * A single row of readings extracted from the field sheet.
 * Why: Represents one time-stamped measurement with pressure and 4 dial gauge readings.
 * The `id` is used for React keys and tracking edits.
 */
export interface ExtractedReading {
  id: string;
  date: OCRValue<string | null>;
  time: OCRValue<string | null>;
  pressure: OCRValue<number | null>;
  gauge1: OCRValue<number | null>;
  gauge2: OCRValue<number | null>;
  gauge3: OCRValue<number | null>;
  gauge4: OCRValue<number | null>;
  remark: OCRValue<string | null>;
  /** 
   * Cycle phase detected from load progression.
   * Why: Auto-detect cycle changes checkbox uses this to show loading/unloading phases.
   */
  cycle?: 'loading' | 'unloading' | 'holding';
}

/**
 * Project/header information extracted from field sheet.
 * Why: Contains all the metadata needed to identify the pile test
 * and generate compliant reports (test number, location, pile specs, etc.).
 */
export interface ProjectInfo {
  testNo: OCRValue<string | null>;
  project: OCRValue<string | null>;
  location: OCRValue<string | null>;
  contractor: OCRValue<string | null>;
  clientName: OCRValue<string | null>;
  pileDiameter: OCRValue<string | null>;
  designLoad: OCRValue<string | null>;
  testLoad: OCRValue<string | null>;
  ramArea: OCRValue<string | null>;
  dateOfCasting: OCRValue<string | null>;
  pileDepth: OCRValue<string | null>;
  lcDialGauge: OCRValue<string | null>;
  testType: OCRValue<string | null>;
  mixedDesign: OCRValue<string | null>;
}

/**
 * Full response from the OCR extraction API.
 * Why: Bundles all extracted data with metadata about the extraction process.
 */
export interface OCRResponse {
  projectInfo: ProjectInfo;
  readings: ExtractedReading[];
  pageCount: number;
  totalReadings: number;
}

/**
 * Confidence thresholds for visual highlighting.
 * Why: Centralized thresholds for consistent UI feedback across components.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Below this = red background (needs attention) */
  LOW: 0.75,
  /** Below this = yellow background (verify) */
  MEDIUM: 0.85,
} as const;

/**
 * Helper to determine confidence level for a value.
 * Why: Consistent logic for applying visual styles based on OCR confidence.
 */
export function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < CONFIDENCE_THRESHOLDS.LOW) return 'low';
  if (confidence < CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'high';
}

// ============================================
// REPORT STATE TYPES
// ============================================

/**
 * Current step in the report generation workflow.
 * Why: Tracks user progress through upload → verify → report screens.
 */
export type WorkflowStep = 'upload' | 'verify' | 'report';

/**
 * Complete state for a pile test report in progress.
 * Why: Single source of truth for all data as it flows through the workflow.
 */
export interface ReportState {
  /** Files uploaded by the user */
  uploadedFiles: UploadedFile[];
  /** Selected test type */
  testType: TestType | null;
  /** OCR-extracted project info (editable) */
  projectInfo: ProjectInfo | null;
  /** OCR-extracted readings (editable) */
  readings: ExtractedReading[];
  /** Whether auto-detect cycle changes is enabled */
  autoDetectCycles: boolean;
  /** Current workflow step */
  currentStep: WorkflowStep;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
}

/**
 * Default empty project info for initialization.
 * Why: Provides type-safe defaults when creating new reports.
 */
export const EMPTY_PROJECT_INFO: ProjectInfo = {
  testNo: { value: null, confidence: 0 },
  project: { value: null, confidence: 0 },
  location: { value: null, confidence: 0 },
  contractor: { value: null, confidence: 0 },
  clientName: { value: null, confidence: 0 },
  pileDiameter: { value: null, confidence: 0 },
  designLoad: { value: null, confidence: 0 },
  testLoad: { value: null, confidence: 0 },
  ramArea: { value: null, confidence: 0 },
  dateOfCasting: { value: null, confidence: 0 },
  pileDepth: { value: null, confidence: 0 },
  lcDialGauge: { value: null, confidence: 0 },
  testType: { value: null, confidence: 0 },
  mixedDesign: { value: null, confidence: 0 },
};
