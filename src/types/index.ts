/**
 * Supported pile load test types per IS 2911.
 * Why: Different test types have different load calculations and pass criteria.
 */
export type TestType = 'IVPLT' | 'RVPLT' | 'Lateral' | 'Uplift';

/**
 * Configuration for each test type displayed in the UI.
 * Why: Provides human-readable labels and descriptions for test type selection.
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
    id: 'Lateral',
    name: 'Lateral Load Test',
    fullName: 'Lateral Load Test',
    description: 'Horizontal load testing',
    loadMultiplier: 2.5,
    color: 'bg-orange-600',
    hoverColor: 'hover:bg-orange-700',
  },
  {
    id: 'Uplift',
    name: 'Uplift / Pullout Load Test',
    fullName: 'Uplift / Pullout Load Test',
    description: 'Testing upward resistance',
    loadMultiplier: 2.5,
    color: 'bg-purple-600',
    hoverColor: 'hover:bg-purple-700',
  },
];

// ============================================
// PROJECT & TEST DATA TYPES
// ============================================

/**
 * Project and test specification information.
 * Why: Contains all metadata needed to identify the pile test
 * and generate compliant reports.
 */
export interface ProjectInfo {
  reportNo: string;
  project: string;
  location: string;
  contractor: string;
  client: string;
  lcOfDialGauge: string;
  designLoadOnPile: string;
  mixedDesign: string;
  pileDiameter: string;
  ramArea: string;
  dateOfCasting: string;
  pileDepth: string;
  testType: TestType | null;
}

/**
 * Default empty project info for initialization.
 * Why: Provides type-safe defaults when creating new tests.
 */
export const EMPTY_PROJECT_INFO: ProjectInfo = {
  reportNo: '',
  project: '',
  location: '',
  contractor: '',
  client: '',
  lcOfDialGauge: '0.01',
  designLoadOnPile: '',
  mixedDesign: '',
  pileDiameter: '',
  ramArea: '',
  dateOfCasting: '',
  pileDepth: '',
  testType: null,
};

/**
 * Test phase during pile load testing.
 * Why: Tracks whether load is being increased, held, or decreased.
 */
export type TestPhase = 'loading' | 'holding' | 'unloading';

/**
 * A single reading captured during the pile load test.
 * Why: Represents one time-stamped measurement with pressure and dial gauge readings.
 */
export interface Reading {
  id: string;
  pressureGauge: string;
  load: string;
  dialGauge1: string;
  dialGauge2: string;
  dialGauge3: string;
  dialGauge4: string;
  timestamp: string;
  signature?: string;
  remark?: string;
  phase: TestPhase;
}

/**
 * A load entry containing readings at a specific pressure level.
 * Why: Groups readings by load increment for timeline display.
 */
export interface LoadEntry {
  id: string;
  pressureGauge: string;
  load: string;
  readings: Reading[];
  timestamp: string;
}

/**
 * User profile information for signatures.
 * Why: Stores engineer's identity for signing off readings.
 */
export interface UserProfile {
  name: string;
  initials: string;
  signature: string;
}

/**
 * A complete saved pile test.
 * Why: Represents a full test with all data for persistence.
 */
export interface SavedTest {
  id: string;
  projectInfo: ProjectInfo;
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

// ============================================
// WORKFLOW TYPES
// ============================================

/**
 * Current step in the test workflow.
 * Why: Tracks user progress through details → entry → report screens.
 */
export type WorkflowStep = 'details' | 'entry' | 'report';

/**
 * Current view in the app.
 * Why: Tracks whether user is on home screen or inside a test.
 */
export type AppView = 'home' | 'test';

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Calculate load from pressure gauge reading and ram area.
 * Why: Core formula for converting pressure to load (MT).
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
