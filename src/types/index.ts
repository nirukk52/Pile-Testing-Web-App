/**
 * PileTest Pro - Core TypeScript Types
 * Why: Centralized type definitions for the entire application.
 */

// =============================================================================
// RE-EXPORT ENGINE TYPES
// =============================================================================

export type {
  TestType,
  TestPhase,
  TestStatus,
  CertificateType,
  TestMeta,
  ReadingInput,
  CalculationResult,
  AcceptanceCriteria,
  GraphConfig,
  ReportSection,
  KPIConfig,
  ValidationResult,
  ReportData,
  ITestEngine,
  TestTypeInfo,
} from '@/engines';

export {
  getTestEngine,
  isEngineImplemented,
  getAvailableTestTypes,
  getTestTypeInfoList,
} from '@/engines';

// =============================================================================
// LEGACY TEST TYPE CONFIG (for backward compatibility)
// =============================================================================

import type { TestType } from '@/engines';

/**
 * Configuration for each test type displayed in the UI.
 * Why: Provides human-readable labels and descriptions for test type selection.
 * @deprecated Use getTestTypeInfoList() from @/engines instead
 */
export interface TestTypeConfig {
  id: TestType;
  name: string;
  fullName: string;
  description: string;
  loadMultiplier: number;
  color: string;
  hoverColor: string;
}

/**
 * Available test types with their configurations.
 * Why: Centralized source of truth for test type metadata.
 */
export const TEST_TYPES: TestTypeConfig[] = [
  {
    id: 'IVPLT',
    name: 'IVPLT',
    fullName: 'Initial Vertical Load Test',
    description: 'First-time load testing of new piles',
    loadMultiplier: 2.5,
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  {
    id: 'RVPLT',
    name: 'RVPLT',
    fullName: 'Routine Vertical Load Test',
    description: 'Standard vertical load testing',
    loadMultiplier: 1.5,
    color: 'bg-green-600',
    hoverColor: 'hover:bg-green-700',
  },
  {
    id: 'LATERAL',
    name: 'Lateral Load Test',
    fullName: 'Lateral Load Test',
    description: 'Horizontal load testing',
    loadMultiplier: 2.5,
    color: 'bg-orange-600',
    hoverColor: 'hover:bg-orange-700',
  },
  {
    id: 'UPLIFT',
    name: 'Uplift / Pullout Load Test',
    fullName: 'Uplift / Pullout Load Test',
    description: 'Testing upward resistance',
    loadMultiplier: 2.5,
    color: 'bg-purple-600',
    hoverColor: 'hover:bg-purple-700',
  },
];

// =============================================================================
// PROJECT & PILE TYPES
// =============================================================================

/**
 * Project-level info shared across tests.
 * Why: Provides context for report header and title page.
 */
export interface ProjectInfo {
  id?: string;
  name: string;
  client: string;
  contractor: string;
  pmc?: string;
  location: string;
}

/**
 * Pile specifications for a test.
 * Why: Essential parameters for IS 2911 calculations.
 */
export interface PileSpecs {
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
}

/**
 * Equipment specifications for a test.
 * Why: Required for load calculation and report methodology section.
 */
export interface EquipmentSpecs {
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;
}

// =============================================================================
// TEST & READING TYPES
// =============================================================================

import type { TestPhase, TestStatus, CertificateType } from '@/engines';

/**
 * A complete test instance combining all data.
 * Why: Main working object for UI and calculations.
 */
export interface Test {
  id: string;
  projectId: string;
  testType: TestType;
  reportNo?: string;
  testDate: Date;

  // Pile specs
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;

  // Equipment
  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;

  // State
  status: TestStatus;

  // Computed results (nullable until calculated)
  maxSettlementMm?: number;
  elasticReboundMm?: number;
  netSettlementMm?: number;
  safeLoadAdoptedT?: number;
  isPassed?: boolean;
  conclusion?: string;

  // Relations (loaded separately)
  readings?: Reading[];
  siteImages?: SiteImage[];
  certificates?: CalibrationCertificate[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single reading during the test.
 * Why: Core data point for calculations and display.
 */
export interface Reading {
  id: string;
  testId: string;
  sequence: number;
  phase: TestPhase;
  recordedAt: Date;

  // Raw values
  pressureKgCm2: number;
  loadT: number;

  // Dial gauges
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;

  // Gauge status
  dg1Enabled: boolean;
  dg2Enabled: boolean;
  dg3Enabled: boolean;
  dg4Enabled: boolean;

  // Computed
  avgSettlementMm: number;

  remark?: string;
  createdAt: Date;
}

/**
 * Site image attachment.
 * Why: Visual documentation for report.
 */
export interface SiteImage {
  id: string;
  testId: string;
  storagePath: string;
  fileName: string;
  caption?: string;
  displayOrder: number;
  createdAt: Date;
}

/**
 * Calibration certificate attachment.
 * Why: PDF to append to final report.
 */
export interface CalibrationCertificate {
  id: string;
  testId: string;
  certificateType: CertificateType;
  storagePath: string;
  fileName: string;
  createdAt: Date;
}

/**
 * User profile for signatures.
 * Why: Attribution on reports.
 */
export interface UserProfile {
  id?: string;
  name: string;
  initials?: string;
  email?: string;
  company?: string;
  designation?: string;
  signature?: string;
}

// =============================================================================
// LEGACY TYPES (for backward compatibility with existing components)
// =============================================================================

/**
 * Legacy project info structure.
 * Why: Maintains compatibility with existing home-screen and project-details components.
 * @deprecated Migrate to ProjectInfo + PileSpecs + EquipmentSpecs
 */
export interface LegacyProjectInfo {
  reportNo: string;
  project: string;
  location: string;
  contractor: string;
  client: string;
  pmc: string; // Project Management Consultant (optional)
  // New pile identification fields
  pileId: string; // e.g., "TP-02"
  testDate: string; // ISO date string
  // Equipment fields
  jackName: string; // Hydraulic jack identifier
  lcOfDialGauge: string;
  designLoadOnPile: string;
  testLoad: string; // Auto-calculated: designLoad × multiplier
  mixedDesign: string; // Concrete grade e.g., "M25"
  pileDiameter: string;
  ramArea: string;
  dateOfCasting: string;
  pileDepth: string;
  testType: TestType | null;
}

/**
 * Default empty legacy project info for initialization.
 * Why: Provides type-safe defaults when creating new tests.
 * @deprecated Use new entity types instead
 */
export const EMPTY_PROJECT_INFO: LegacyProjectInfo = {
  reportNo: '',
  project: '',
  location: '',
  contractor: '',
  client: '',
  pmc: '',
  pileId: '',
  testDate: new Date().toISOString().split('T')[0],
  jackName: '',
  lcOfDialGauge: '0.01',
  designLoadOnPile: '',
  testLoad: '',
  mixedDesign: '',
  pileDiameter: '',
  ramArea: '',
  dateOfCasting: '',
  pileDepth: '',
  testType: null,
};

/**
 * Legacy test phase type.
 * Why: Existing components use lowercase phase names.
 * @deprecated Migrate to TestPhase from engines (uppercase)
 */
export type LegacyTestPhase = 'loading' | 'holding' | 'unloading';

/**
 * Legacy reading structure.
 * Why: Maintains compatibility with existing data-entry components.
 * @deprecated Migrate to Reading type
 */
export interface LegacyReading {
  id: string;
  pressureGauge: string;
  load: string;
  dialGauge1: string;
  dialGauge2: string;
  dialGauge3: string;
  dialGauge4: string;
  // Gauge enabled flags (defaults to true if not present for backward compatibility)
  dg1Enabled?: boolean;
  dg2Enabled?: boolean;
  dg3Enabled?: boolean;
  dg4Enabled?: boolean;
  // Stored average settlement (for detecting manual overrides when editing)
  avgSettlement?: string;
  timestamp: string;
  signature?: string;
  remark?: string;
  phase: LegacyTestPhase;
}

/**
 * Legacy load entry containing readings at a specific pressure level.
 * Why: Groups readings by load increment for timeline display.
 * @deprecated Migrate to Reading type with phase grouping
 */
export interface LoadEntry {
  id: string;
  pressureGauge: string;
  load: string;
  readings: LegacyReading[];
  timestamp: string;
}

/**
 * Legacy saved test structure.
 * Why: Maintains compatibility with localStorage persistence.
 * @deprecated Migrate to Test type with Supabase
 */
export interface SavedTest {
  id: string;
  projectInfo: LegacyProjectInfo;
  loadEntries: LoadEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Summary info for displaying in test list.
 * Why: Lightweight representation for the home screen test cards.
 */
export interface PileTestSummary {
  id: string;
  reportNo: string;
  project: string;
  location: string;
  dateOfCasting: string;
  createdAt: string;
  readingsCount: number;
  testType: TestType | null;
}

// =============================================================================
// WORKFLOW TYPES
// =============================================================================

/**
 * Current step in the test workflow.
 * Why: Tracks user progress through upload → details → entry → report screens.
 * 'upload' is first tab - upload field sheet PDFs for AI extraction.
 */
export type WorkflowStep = 'upload' | 'details' | 'entry' | 'images' | 'certificates' | 'report';

/**
 * Current view in the app.
 * Why: Tracks whether user is on home screen or inside a test.
 */
export type AppView = 'home' | 'test';

// =============================================================================
// CALCULATION HELPERS (Legacy)
// =============================================================================

/**
 * Calculate load from pressure gauge reading and ram area.
 * Why: Core formula for converting pressure to load (MT).
 * @deprecated Use calculateLoadFromPressure from @/lib/calculations
 */
export function calculateLoad(pressure: string, ramArea: string): string {
  const pressureValue = parseFloat(pressure);
  const ramAreaValue = parseFloat(ramArea);
  if (ramAreaValue && pressureValue) {
    return ((pressureValue * ramAreaValue) / 1000).toFixed(2);
  }
  return '-';
}

/**
 * Calculate average settlement from 4 dial gauge readings.
 * Why: Standard calculation for average pile settlement.
 * @deprecated Use calculateAverageSettlement from @/lib/calculations
 */
export function calculateAverageSettlement(
  g1: string,
  g2: string,
  g3: string,
  g4: string
): string {
  const values = [g1, g2, g3, g4]
    .map((g) => parseFloat(g))
    .filter((v) => !isNaN(v) && v !== 0);

  if (values.length > 0) {
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  }
  return '-';
}

/**
 * IS 2911 settlement limit for vertical tests.
 * Why: Pass/fail criteria - net settlement must be ≤ 12mm.
 */
export const SETTLEMENT_LIMIT_MM = 12;

// =============================================================================
// INGESTION & VERIFICATION TYPES (002-auto-report-pipeline)
// =============================================================================

/**
 * Supported file types for ingestion.
 * Why: Defines what files the system can process for data extraction.
 */
export type IngestionFileType = 'pdf' | 'xlsx' | 'csv' | 'image';

/**
 * Methods used to extract data from uploaded files.
 * Why: Different file types require different extraction approaches.
 */
export type ExtractionMethod = 'excel' | 'pdf-text' | 'vision';

/**
 * Status of an ingestion job.
 * Why: Tracks progress through the extraction pipeline.
 */
export type IngestionStatus = 'pending' | 'extracting' | 'review' | 'completed' | 'failed';

/**
 * A value extracted from a file with confidence score.
 * Why: Allows users to review low-confidence extractions before applying.
 */
export interface ExtractedValue {
  value: string;
  confidence: number; // 0-100
}

/**
 * A reading row extracted from uploaded file.
 * Why: Maps raw file data to our LoadEntry structure with confidence tracking.
 */
export interface ExtractedReading {
  rowIndex: number;
  timestamp?: ExtractedValue;
  pressureGauge: ExtractedValue;
  dialGauge1: ExtractedValue;
  dialGauge2: ExtractedValue;
  dialGauge3: ExtractedValue;
  dialGauge4: ExtractedValue;
  phase?: ExtractedValue;
  remark?: ExtractedValue;
}

/**
 * Project info extracted from uploaded file.
 * Why: Partial extraction - some fields may not be present in source.
 */
export interface ExtractedProjectInfo {
  pileId?: ExtractedValue;
  reportNo?: ExtractedValue;
  project?: ExtractedValue;
  location?: ExtractedValue;
  client?: ExtractedValue;
  contractor?: ExtractedValue;
  pileDiameter?: ExtractedValue;
  pileDepth?: ExtractedValue;
  designLoad?: ExtractedValue;
  ramArea?: ExtractedValue;
  testDate?: ExtractedValue;
  dateOfCasting?: ExtractedValue;
  concreteGrade?: ExtractedValue;
}

/**
 * Tracks a file upload and extraction session.
 * Why: Enables async processing and progress tracking for file ingestion.
 */
export interface IngestionJob {
  id: string;
  testId?: string; // Linked after extraction is confirmed

  // File metadata
  fileName: string;
  fileType: IngestionFileType;
  fileUrl?: string; // Supabase Storage URL
  fileSizeBytes: number;

  // Processing state
  status: IngestionStatus;
  extractionMethod?: ExtractionMethod;

  // Extracted data (populated after extraction)
  extractedProjectInfo?: ExtractedProjectInfo;
  extractedReadings?: ExtractedReading[];

  // Quality metrics
  overallConfidence: number; // 0-100
  lowConfidenceFields: string[]; // Fields requiring user review
  extractionErrors?: string[];

  // Timestamps
  createdAt: string;
  completedAt?: string;
}

/**
 * Verification status for a test report.
 * Why: Tracks whether a report has been verified and approved.
 */
export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'approved';

/**
 * Result of a single verification check.
 * Why: Provides granular feedback on each aspect of report quality.
 */
export interface CheckResult {
  passed: boolean;
  score: number; // 0-100
  details?: string;
}

/**
 * Severity levels for verification issues.
 * Why: Helps users prioritize which issues to fix first.
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Categories of verification issues.
 * Why: Groups issues by type for better organization.
 */
export type IssueCategory = 'data' | 'compliance' | 'formatting';

/**
 * A single issue found during verification.
 * Why: Actionable feedback for improving report quality.
 */
export interface VerificationIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  location?: string; // e.g., "Reading #5, Dial Gauge 1"
  suggestedCorrection?: string;
  correctionConfidence?: number; // 0-100
}

/**
 * Output of the verification agent.
 * Why: Comprehensive quality assessment of a generated report.
 */
export interface VerificationReport {
  id: string;
  testId: string;
  reportVersion: number;

  // Scoring
  score: number; // 0-100
  status: 'pass' | 'warn' | 'fail'; // pass >= 90, warn 80-89, fail < 80

  // Individual checks
  checks: {
    dataIntegrity: CheckResult;
    complianceIS2911: CheckResult;
    visualQuality: CheckResult;
  };

  // Issues found
  issues: VerificationIssue[];

  // Summary
  summary: string;

  // Timestamps
  createdAt: string;
}

/**
 * Records a correction made by the system or user.
 * Why: Audit trail for all changes, enables rollback if needed.
 */
export interface CorrectionLog {
  id: string;
  testId: string;
  verificationReportId: string;

  // What was corrected
  issueId: string;
  field: string; // e.g., "readings[5].dialGauge1"
  originalValue: string;
  correctedValue: string;

  // Confidence and approval
  confidence: number; // 0-100
  autoApplied: boolean; // true if confidence > 90
  userApproved?: boolean;

  // Result
  resultedInImprovement?: boolean;

  // Timestamps
  createdAt: string;
  appliedAt?: string;
}

// =============================================================================
// EXTENDED SAVED TEST (with verification fields)
// =============================================================================

/**
 * Source file info attached to a test.
 * Why: Audit trail - links generated report back to original data source.
 */
export interface SourceFile {
  name: string;
  url: string;
  type: IngestionFileType | 'manual';
}

/**
 * Extended SavedTest with ingestion and verification tracking.
 * Why: Adds traceability from source file through verification to approval.
 */
export interface SavedTestExtended extends SavedTest {
  // Ingestion tracking
  ingestionJobId?: string;
  sourceFile?: SourceFile;

  // Verification status
  verificationStatus: VerificationStatus;
  latestVerificationId?: string;
  verificationScore?: number;

  // Approval tracking
  approvedAt?: string;
  approvedBy?: string;
}
