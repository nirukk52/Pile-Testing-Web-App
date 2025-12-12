/**
 * Types for pile load test calculations.
 * Why: Separates calculation result types from raw OCR types,
 * enabling clear distinction between extracted and computed values.
 */

import type { TestType, ExtractedReading, ProjectInfo } from '@/types';

/**
 * A single reading with calculated load and average settlement.
 * Why: Transforms raw dial gauge readings into engineering values
 * used for charts and pass/fail determination.
 */
export interface CalculatedReading {
  /** Original reading ID for React keys */
  id: string;
  /** Date of the reading */
  date: string | null;
  /** Time of the reading (HH:MM format) */
  time: string | null;
  /** Pressure gauge reading in kg/cm² */
  pressure: number;
  /** Calculated load: (pressure × ramArea) / 1000 in MT */
  load: number;
  /** Individual dial gauge readings in mm */
  gauge1: number;
  gauge2: number;
  gauge3: number;
  gauge4: number;
  /** Average settlement: (g1 + g2 + g3 + g4) / 4 in mm */
  avgSettlement: number;
  /** Phase of the test cycle */
  cycle: 'loading' | 'unloading' | 'holding';
  /** Optional remark from field sheet */
  remark: string | null;
}

/**
 * Summary statistics for the entire test.
 * Why: Provides at-a-glance KPI values for the report dashboard
 * and determines pass/fail status per IS 2911 Part 4.
 */
export interface ReportSummary {
  /** Test type code */
  testType: TestType;
  /** Human-readable test type name */
  testTypeName: string;
  /** Design load from project info in MT */
  designLoad: number;
  /** Test load (design × multiplier) in MT */
  testLoad: number;
  /** Load multiplier based on test type (2.5x for IVPLT, 1.5x for RVPLT) */
  loadMultiplier: number;
  /** Maximum load applied during test in MT */
  maxLoad: number;
  /** Maximum settlement recorded (gross settlement) in mm */
  grossSettlement: number;
  /** Net settlement after unloading (final - initial) in mm */
  netSettlement: number;
  /** Settlement at maximum load in mm */
  settlementAtMaxLoad: number;
  /** Pass/Fail status based on IS 2911 criteria */
  passed: boolean;
  /** Settlement limit for this test type in mm */
  settlementLimit: number;
  /** Safe load capacity in MT */
  safeLoadCapacity: number;
}

/**
 * Complete report data combining project info, readings, and summary.
 * Why: Single object containing everything needed to render the report
 * dashboard and generate the PDF.
 */
export interface ReportData {
  /** Project and pile specifications */
  projectInfo: {
    testNo: string | null;
    project: string | null;
    location: string | null;
    contractor: string | null;
    clientName: string | null;
    pileDiameter: string | null;
    pileDepth: string | null;
    designLoad: string | null;
    testLoad: string | null;
    ramArea: string | null;
    dateOfCasting: string | null;
    dateOfTesting: string | null;
    concreteGrade: string | null;
    lcDialGauge: string | null;
  };
  /** All readings with calculated values */
  readings: CalculatedReading[];
  /** Loading phase readings only */
  loadingReadings: CalculatedReading[];
  /** Unloading phase readings only */
  unloadingReadings: CalculatedReading[];
  /** Summary statistics and pass/fail status */
  summary: ReportSummary;
}

/**
 * Input parameters for calculating report data.
 * Why: Explicit interface for what the calculation functions need,
 * decoupling from the Zustand store structure.
 */
export interface CalculationInput {
  testType: TestType;
  projectInfo: ProjectInfo;
  readings: ExtractedReading[];
}


