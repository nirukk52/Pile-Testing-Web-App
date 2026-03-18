/**
 * Test Engine Factory
 * Why: Single point of engine instantiation, UI doesn't need to know concrete classes.
 */

import type { ITestEngine, TestType } from './types';
import { IvpltEngine } from './ivplt-engine';
import { RvpltEngine } from './rvplt-engine';
import { LateralEngine } from './lateral-engine';
import { UpliftEngine } from './uplift-engine';

/**
 * Engine registry mapping test types to their implementations.
 * Why: Enables runtime selection of correct engine based on test type.
 */
const engineRegistry: Record<TestType, () => ITestEngine> = {
  IVPLT: () => new IvpltEngine(),
  RVPLT: () => new RvpltEngine(),
  LATERAL: () => new LateralEngine(),
  UPLIFT: () => new UpliftEngine(),
};

/**
 * Get the appropriate test engine for a given test type.
 * Why: Factory pattern allows adding new test types without modifying calling code.
 *
 * @param testType - The type of test (IVPLT, RVPLT, LATERAL, UPLIFT)
 * @returns The test engine instance for calculations and report generation
 * @throws Error if the test type is not yet implemented
 *
 * @example
 * const engine = getTestEngine('IVPLT');
 * const result = engine.calculate(readings, meta);
 */
export function getTestEngine(testType: TestType): ITestEngine {
  const factory = engineRegistry[testType];
  if (!factory) {
    throw new Error(`Unknown test type: ${testType}`);
  }
  return factory();
}

/**
 * Check if a test type engine is implemented.
 * Why: UI can grey out unavailable test types.
 *
 * @param testType - The type of test to check
 * @returns true if the engine is implemented, false otherwise
 */
export function isEngineImplemented(testType: TestType): boolean {
  try {
    getTestEngine(testType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all available test types.
 * Why: UI needs list of test types for selection modal.
 */
export function getAvailableTestTypes(): TestType[] {
  return ['IVPLT', 'RVPLT', 'LATERAL', 'UPLIFT'];
}

/**
 * Get test type display info.
 * Why: UI needs human-readable labels and descriptions.
 */
export interface TestTypeInfo {
  id: TestType;
  name: string;
  fullName: string;
  description: string;
  multiplier: number;
  isImplemented: boolean;
}

/**
 * Get display information for all test types.
 * Why: Test type selection modal needs this info.
 */
export function getTestTypeInfoList(): TestTypeInfo[] {
  return [
    {
      id: 'IVPLT',
      name: 'IVPLT',
      fullName: 'Initial Vertical Pile Load Test',
      description: 'First-time load testing of new piles (2.5× design load)',
      multiplier: 2.5,
      isImplemented: true,
    },
    {
      id: 'RVPLT',
      name: 'RVPLT',
      fullName: 'Routine Vertical Pile Load Test',
      description: 'Standard vertical load testing (1.5× design load)',
      multiplier: 1.5,
      isImplemented: true,
    },
    {
      id: 'LATERAL',
      name: 'Lateral',
      fullName: 'Lateral Load Test',
      description: 'Horizontal load testing (2.5× design load)',
      multiplier: 2.5,
      isImplemented: true,
    },
    {
      id: 'UPLIFT',
      name: 'Uplift',
      fullName: 'Uplift / Pullout Load Test',
      description: 'Testing upward resistance (2.5× design load)',
      multiplier: 2.5,
      isImplemented: true,
    },
  ];
}


