/**
 * Test Type Engines - Barrel Export
 * Why: Single import point for all engine-related types and functions.
 */

// Types
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
} from './types';

// Factory
export {
  getTestEngine,
  isEngineImplemented,
  getAvailableTestTypes,
  getTestTypeInfoList,
} from './factory';
export type { TestTypeInfo } from './factory';

// Concrete Engines (for direct instantiation if needed)
export { IvpltEngine } from './ivplt-engine';


