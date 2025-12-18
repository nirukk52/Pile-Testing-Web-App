/**
 * Eval Types
 * Why: Defines the structure for evaluation data, results, and metrics.
 */

/**
 * Expected data structure - the ground truth from Supabase.
 * Why: This is what we compare Vision API output against.
 */
export interface ExpectedData {
  testId: string;
  testType: 'IVPLT' | 'RVPLT' | 'Lateral' | 'Uplift';
  
  projectInfo: ExpectedProjectInfo;
  readings: ExpectedReading[];
}

/**
 * Expected project info fields.
 */
export interface ExpectedProjectInfo {
  pileId: string;
  reportNo?: string;
  project: string;
  location: string;
  client: string;
  contractor: string;
  pileDiameter: number;   // mm
  pileDepth: number;      // m
  designLoad: number;     // T
  testLoad: number;       // T
  ramArea: number;        // cm²
  concreteGrade: string;  // M25, M35, etc.
  testDate: string;       // ISO date
  dateOfCasting?: string; // ISO date
}

/**
 * Expected reading structure - RAW FIELDS ONLY.
 * Why: We only evaluate what Vision API extracts, not calculated values.
 * Load and avgSettlement are CALCULATED from pressure/ramArea and dg1-4.
 */
export interface ExpectedReading {
  sequence: number;
  date?: string;          // Extracted date (YYYY-MM-DD)
  time?: string;          // Extracted time (HH:MM)
  pressure: number;       // kg/cm² - RAW
  dg1: number;            // mm - RAW
  dg2: number;            // mm - RAW
  dg3: number;            // mm - RAW
  dg4: number;            // mm - RAW
  // NOTE: phase, load, avgSettlement are CALCULATED - not part of eval
}

/**
 * Extracted data structure - what Vision API returns.
 * Why: This is the AI's output that we evaluate.
 */
export interface ExtractedData {
  projectInfo: Partial<ExpectedProjectInfo>;
  readings: Array<Partial<ExpectedReading>>;
  confidence: number;
  extractedAt: string;
  model: string;
}

/**
 * Field comparison result.
 * Why: Tracks whether each field matched and why.
 */
export interface FieldComparison {
  field: string;
  expected: unknown;
  extracted: unknown;
  match: boolean;
  matchType: 'exact' | 'fuzzy' | 'tolerance' | 'missing' | 'mismatch';
  message?: string;
}

/**
 * Reading comparison result.
 * Why: Tracks accuracy for a single reading row.
 */
export interface ReadingComparison {
  sequence: number;
  phase: string;
  fields: FieldComparison[];
  overallMatch: boolean;
}

/**
 * Eval result for a single report.
 * Why: Complete evaluation output for one training example.
 */
export interface EvalResult {
  reportId: string;
  testType: string;
  timestamp: string;
  
  // Scores
  overallScore: number;           // 0-100
  projectInfoScore: number;       // 0-100
  readingsScore: number;          // 0-100
  
  // Details
  projectInfoComparisons: FieldComparison[];
  readingsComparisons: ReadingComparison[];
  
  // Summary
  totalReadingsExpected: number;
  totalReadingsExtracted: number;
  fieldsMatched: number;
  fieldsMissing: number;
  fieldsMismatched: number;
  
  // Pass/Fail
  passed: boolean;
  passThreshold: number;
  
  // Failures (for debugging)
  failures: string[];
}

/**
 * Eval configuration.
 * Why: Defines thresholds and tolerances for evaluation.
 */
export interface EvalConfig {
  passThreshold: number;          // Default: 80
  
  tolerances: {
    dialGauge: number;            // mm (default: 0.05)
    pressure: number;             // % (default: 1)
    load: number;                 // % (default: 1)
  };
  
  weights: {
    projectInfo: number;          // Default: 30
    readingCount: number;         // Default: 20
    dialGaugeValues: number;      // Default: 30
    pressureLoadValues: number;   // Default: 20
  };
}

/**
 * Default eval configuration.
 * Why: Tolerances calibrated for handwritten field sheets where OCR can vary.
 */
export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  passThreshold: 80,
  
  tolerances: {
    dialGauge: 0.10,    // ±0.10mm - realistic for handwritten data (0.05mm was too strict)
    pressure: 1,        // ±1%
    load: 1,            // ±1%
  },
  
  weights: {
    projectInfo: 30,
    readingCount: 20,
    dialGaugeValues: 30,
    pressureLoadValues: 20,
  },
};

