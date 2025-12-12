/**
 * Calculations for vertical pile load tests (IVPLT and RVPLT).
 * Why: Implements IS 2911 Part 4 formulas for determining pile capacity
 * and pass/fail criteria based on settlement limits.
 */

import type { TestType, ExtractedReading, ProjectInfo } from '@/types';
import type {
  CalculatedReading,
  ReportSummary,
  ReportData,
  CalculationInput,
} from './types';

/**
 * Load multipliers per IS 2911 Part 4.
 * Why: Different test types have different test load requirements
 * to verify pile capacity under various conditions.
 */
const LOAD_MULTIPLIERS: Record<'IVPLT' | 'RVPLT', number> = {
  IVPLT: 2.5, // Initial test: 2.5x design load
  RVPLT: 1.5, // Routine test: 1.5x design load
};

/**
 * Human-readable names for test types.
 * Why: Used in report headers and status displays.
 */
const TEST_TYPE_NAMES: Record<'IVPLT' | 'RVPLT', string> = {
  IVPLT: 'Initial Static Vertical Load Test',
  RVPLT: 'Routine Static Vertical Load Test',
};

/**
 * Settlement limit in mm per IS 2911 Part 4.
 * Why: Net settlement must not exceed 12mm for vertical tests to pass.
 */
const SETTLEMENT_LIMIT_MM = 12;

/**
 * Parses a numeric value from OCR output.
 * Why: OCR values can be strings with units or null; this extracts clean numbers.
 */
function parseNumeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  // Remove units and whitespace, extract number
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculates load from pressure and ram area.
 * Why: Field sheets record pressure in kg/cm²; we need load in MT.
 * Formula: Load (MT) = (Pressure × Ram Area) / 1000
 */
export function calculateLoad(pressure: number, ramArea: number): number {
  if (ramArea === 0) return 0;
  return (pressure * ramArea) / 1000;
}

/**
 * Calculates average settlement from 4 dial gauge readings.
 * Why: 4 gauges are placed around the pile for uniform measurement.
 */
export function calculateAvgSettlement(
  g1: number,
  g2: number,
  g3: number,
  g4: number
): number {
  return (g1 + g2 + g3 + g4) / 4;
}

/**
 * Transforms extracted readings into calculated readings.
 * Why: Adds computed load and average settlement to each row
 * for use in charts and data tables.
 */
export function transformReadings(
  readings: ExtractedReading[],
  ramArea: number
): CalculatedReading[] {
  return readings.map((reading) => {
    const pressure = reading.pressure.value ?? 0;
    const g1 = reading.gauge1.value ?? 0;
    const g2 = reading.gauge2.value ?? 0;
    const g3 = reading.gauge3.value ?? 0;
    const g4 = reading.gauge4.value ?? 0;

    return {
      id: reading.id,
      date: reading.date.value,
      time: reading.time.value,
      pressure,
      load: calculateLoad(pressure, ramArea),
      gauge1: g1,
      gauge2: g2,
      gauge3: g3,
      gauge4: g4,
      avgSettlement: calculateAvgSettlement(g1, g2, g3, g4),
      cycle: reading.cycle ?? 'loading',
      remark: reading.remark.value,
    };
  });
}

/**
 * Calculates summary statistics for the test.
 * Why: Provides KPI values and determines pass/fail status
 * according to IS 2911 Part 4 criteria.
 */
export function calculateSummary(
  testType: TestType,
  readings: CalculatedReading[],
  designLoadValue: number
): ReportSummary {
  // Only process vertical tests
  if (testType !== 'IVPLT' && testType !== 'RVPLT') {
    throw new Error(`Unsupported test type: ${testType}. Use lateral-test.ts for LATERAL tests.`);
  }

  const multiplier = LOAD_MULTIPLIERS[testType];
  const testLoad = designLoadValue * multiplier;

  // Find max load and corresponding settlement
  let maxLoad = 0;
  let settlementAtMaxLoad = 0;
  let grossSettlement = 0;

  readings.forEach((reading) => {
    if (reading.load > maxLoad) {
      maxLoad = reading.load;
      settlementAtMaxLoad = reading.avgSettlement;
    }
    if (reading.avgSettlement > grossSettlement) {
      grossSettlement = reading.avgSettlement;
    }
  });

  // Calculate net settlement (final reading - initial reading)
  const initialSettlement = readings.length > 0 ? readings[0].avgSettlement : 0;
  const finalSettlement = readings.length > 0 ? readings[readings.length - 1].avgSettlement : 0;
  const netSettlement = finalSettlement - initialSettlement;

  // Determine pass/fail per IS 2911
  const passed = netSettlement <= SETTLEMENT_LIMIT_MM;

  return {
    testType,
    testTypeName: TEST_TYPE_NAMES[testType],
    designLoad: designLoadValue,
    testLoad,
    loadMultiplier: multiplier,
    maxLoad,
    grossSettlement,
    netSettlement,
    settlementAtMaxLoad,
    passed,
    settlementLimit: SETTLEMENT_LIMIT_MM,
    safeLoadCapacity: designLoadValue, // Safe load is the design load if test passes
  };
}

/**
 * Separates readings into loading and unloading phases.
 * Why: Chart displays loading and unloading as separate curves
 * with different visual styles.
 */
export function separatePhases(readings: CalculatedReading[]): {
  loading: CalculatedReading[];
  unloading: CalculatedReading[];
} {
  return {
    loading: readings.filter((r) => r.cycle === 'loading' || r.cycle === 'holding'),
    unloading: readings.filter((r) => r.cycle === 'unloading'),
  };
}

/**
 * Extracts clean project info values from OCR output.
 * Why: Converts OCRValue objects to plain strings for display.
 */
function extractProjectInfo(projectInfo: ProjectInfo): ReportData['projectInfo'] {
  return {
    testNo: projectInfo.testNo.value,
    project: projectInfo.project.value,
    location: projectInfo.location.value,
    contractor: projectInfo.contractor.value,
    clientName: projectInfo.clientName.value,
    pileDiameter: projectInfo.pileDiameter.value,
    pileDepth: projectInfo.pileDepth.value,
    designLoad: projectInfo.designLoad.value,
    testLoad: projectInfo.testLoad.value,
    ramArea: projectInfo.ramArea.value,
    dateOfCasting: projectInfo.dateOfCasting.value,
    dateOfTesting: null, // Not in current ProjectInfo, could be extracted from readings
    concreteGrade: projectInfo.mixedDesign.value,
    lcDialGauge: projectInfo.lcDialGauge.value,
  };
}

/**
 * Main calculation function: transforms raw OCR data into complete report data.
 * Why: Single entry point for generating all report values from store data.
 */
export function calculateVerticalTestReport(input: CalculationInput): ReportData {
  const { testType, projectInfo, readings } = input;

  // Parse ram area and design load from project info
  const ramArea = parseNumeric(projectInfo.ramArea.value);
  const designLoad = parseNumeric(projectInfo.designLoad.value);

  // Transform readings with calculated values
  const calculatedReadings = transformReadings(readings, ramArea);

  // Separate into phases
  const { loading, unloading } = separatePhases(calculatedReadings);

  // Calculate summary statistics
  const summary = calculateSummary(testType, calculatedReadings, designLoad);

  return {
    projectInfo: extractProjectInfo(projectInfo),
    readings: calculatedReadings,
    loadingReadings: loading,
    unloadingReadings: unloading,
    summary,
  };
}


