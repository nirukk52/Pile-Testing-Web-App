/**
 * Test Type Engine - Core Interfaces
 * Why: Enables polymorphic handling of different test types (IVPLT, RVPLT, etc.)
 * without conditional logic scattered throughout the codebase.
 */

// =============================================================================
// ENUMS & BASE TYPES
// =============================================================================

/**
 * Types of pile load tests supported by the system.
 * Why: Determines which TestEngine to use for calculations and report generation.
 */
export type TestType = 'IVPLT' | 'RVPLT' | 'LATERAL' | 'UPLIFT';

/**
 * Phases during a pile load test.
 * Why: Readings are visually grouped and graphed by phase.
 */
export type TestPhase = 'LOADING' | 'HOLD' | 'UNLOADING';

/**
 * Status of a test throughout its lifecycle.
 * Why: Controls which UI actions are available.
 */
export type TestStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REPORTED';

/**
 * Types of calibration certificates.
 * Why: Certificates are categorized for proper ordering in final report.
 */
export type CertificateType =
  | 'HYDRAULIC_JACK'
  | 'PRESSURE_GAUGE'
  | 'DIAL_GAUGE'
  | 'PROVING_RING'
  | 'OTHER';

// =============================================================================
// ENGINE INPUT TYPES
// =============================================================================

/**
 * Metadata passed to engine calculations.
 * Why: Engine needs pile/equipment specs to compute results.
 */
export interface TestMeta {
  pileDiameterMm: number;
  pileDepthM: number;
  designLoadT: number;
  testLoadT: number;
  ramAreaCm2: number;
}

/**
 * A single reading for engine calculations.
 * Why: Simplified reading interface for calculation purposes.
 */
export interface ReadingInput {
  sequence: number;
  phase: TestPhase;
  loadT: number;
  avgSettlementMm: number;
}

// =============================================================================
// ENGINE OUTPUT TYPES
// =============================================================================

/**
 * Result of engine.calculate() method.
 * Why: Contains all computed values for KPIs and report.
 */
export interface CalculationResult {
  /** Maximum settlement recorded during test (mm) */
  maxSettlementMm: number;

  /** Elastic rebound = max settlement - final settlement (mm) */
  elasticReboundMm: number;

  /** Net settlement = max settlement - elastic rebound (mm) */
  netSettlementMm: number;

  /** Interpolated load at settlement limit (T) */
  loadAtLimitT: number | null;

  /** Safe load from settlement criterion: (2/3) × loadAtLimit (T) */
  safeLoadFromSettlementT: number | null;

  /** Load at 10% of pile diameter settlement (T) */
  loadAt10PercentDiaT: number | null;

  /** Safe load from ultimate criterion: 0.5 × loadAt10PercentDia (T) */
  safeLoadFromUltimateT: number | null;

  /** Which criterion governed the safe load determination */
  governingCriterion: 'SETTLEMENT' | 'ULTIMATE' | 'DESIGN' | 'NONE';

  /** Final adopted safe load (T) */
  safeLoadAdoptedT: number;

  /** Test passed IS 2911 criteria */
  isPassed: boolean;

  /** Settlement limit for this test type (mm) */
  settlementLimitMm: number;
}

/**
 * Acceptance criteria from engine.
 * Why: Displayed in report results section.
 */
export interface AcceptanceCriteria {
  /** Human-readable description */
  description: string;

  /** List of criteria per IS 2911 */
  criteria: string[];

  /** Settlement limit in mm */
  settlementLimitMm: number;

  /** Ultimate limit: 10% of pile diameter */
  ultimateLimitMm: number;
}

/**
 * Graph configuration from engine.
 * Why: Determines how chart is rendered.
 */
export interface GraphConfig {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;

  /** Whether Y-axis should be inverted (settlement goes down) */
  yAxisInverted: boolean;

  loadingCurveColor: string;
  holdCurveColor: string;
  unloadingCurveColor: string;

  annotations: {
    /** Show horizontal line at safe load */
    safeLoadLine: boolean;
    /** Show vertical line at settlement limit */
    settlementLimitLine: boolean;
    /** Settlement limit value in mm */
    settlementLimitValue: number;
  };
}

/**
 * Report section content.
 * Why: Engine provides IS 2911-compliant wording.
 */
export interface ReportSection {
  id: string;
  title: string;
  /** HTML or markdown content */
  content: string;
  pageBreakBefore?: boolean;
}

/**
 * KPI configuration for dashboard.
 * Why: Different test types show different KPIs.
 */
export interface KPIConfig {
  id: string;
  label: string;
  unit: string;
  /** Function to extract value from calculation result */
  getValue: (result: CalculationResult) => number | string;
  /** Color variant for the KPI card */
  color: 'default' | 'success' | 'warning' | 'destructive';
}

/**
 * Validation result for readings.
 * Why: Engine validates test-type-specific constraints.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Data bundle for report generation.
 * Why: All data needed to render full report.
 */
export interface ReportData {
  projectName: string;
  client: string;
  contractor: string;
  pmc?: string;
  location: string;

  testType: TestType;
  pileId: string;
  pileDiameterMm: number;
  pileDepthM: number;
  concreteGrade: string;
  designLoadT: number;
  testLoadT: number;
  testDate: Date;
  reportNo?: string;

  jackName?: string;
  ramAreaCm2: number;
  gaugeLeastCountMm: number;

  readings: ReadingInput[];
  result: CalculationResult;
  conclusion?: string;
}

// =============================================================================
// ENGINE INTERFACE
// =============================================================================

/**
 * Parent interface for all pile load test type engines.
 * Why: Enables polymorphic handling of different test types without conditional logic.
 */
export interface ITestEngine {
  /** Unique identifier for this test type */
  readonly testType: TestType;

  /** Human-readable name for UI display */
  readonly displayName: string;

  /** Full descriptive name */
  readonly fullName: string;

  /** Test load multiplier (e.g., 2.5 for IVPLT, 1.5 for RVPLT) */
  readonly testLoadMultiplier: number;

  /** Settlement limit in mm for this test type */
  readonly settlementLimitMm: number;

  /**
   * Calculate all derived values from readings and project metadata.
   * Why: Core calculation logic per IS 2911.
   */
  calculate(readings: ReadingInput[], meta: TestMeta): CalculationResult;

  /**
   * Get acceptance criteria for this test type per IS 2911.
   * Why: Display criteria in report.
   */
  getAcceptanceCriteria(meta: TestMeta): AcceptanceCriteria;

  /**
   * Get chart configuration (axes, colors, annotations).
   * Why: Different test types have different chart requirements.
   */
  getGraphConfig(meta: TestMeta): GraphConfig;

  /**
   * Get report sections with standard IS 2911 wording.
   * Why: Professional report content.
   */
  getReportSections(data: ReportData): ReportSection[];

  /**
   * Get AI prompt template for conclusion generation.
   * Why: Structured prompt for consistent AI output.
   */
  getAIConclusionPrompt(result: CalculationResult, data: ReportData): string;

  /**
   * Get KPI definitions for dashboard display.
   * Why: Show test-type-appropriate metrics.
   */
  getKPIConfig(): KPIConfig[];

  /**
   * Validate a reading before submission.
   * Why: Catch errors early before data is saved.
   */
  validateReading(reading: Partial<ReadingInput>): ValidationResult;

  /**
   * Calculate test load from design load.
   * Why: Auto-compute test load based on multiplier.
   */
  calculateTestLoad(designLoadT: number): number;
}


