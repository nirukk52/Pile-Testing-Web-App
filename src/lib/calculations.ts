/**
 * Shared Calculation Utilities for Pile Load Tests
 * Why: Centralizes common calculation logic used by all test type engines.
 */

import type { ReadingInput, TestPhase } from '@/engines/types';

// =============================================================================
// BASIC CALCULATIONS
// =============================================================================

/**
 * Calculate load from pressure gauge reading and ram area.
 * Formula: load = (pressure × ramArea) / 1000
 * Why: Converts field measurement to engineering units (metric tons).
 */
export function calculateLoadFromPressure(
  pressureKgCm2: number,
  ramAreaCm2: number
): number {
  if (ramAreaCm2 <= 0) {
    throw new Error('Ram area must be positive');
  }
  return (pressureKgCm2 * ramAreaCm2) / 1000;
}

/**
 * Calculate average settlement from enabled dial gauges only.
 * Why: Faulty gauges must be excluded per IS 2911 requirements (FR-004).
 */
export function calculateAverageSettlement(
  dg1: number,
  dg2: number,
  dg3: number,
  dg4: number,
  dg1Enabled: boolean,
  dg2Enabled: boolean,
  dg3Enabled: boolean,
  dg4Enabled: boolean
): number {
  const gauges = [
    { value: dg1, enabled: dg1Enabled },
    { value: dg2, enabled: dg2Enabled },
    { value: dg3, enabled: dg3Enabled },
    { value: dg4, enabled: dg4Enabled },
  ];

  const enabled = gauges.filter((g) => g.enabled);
  if (enabled.length === 0) {
    throw new Error('At least one dial gauge must be enabled');
  }

  return enabled.reduce((sum, g) => sum + g.value, 0) / enabled.length;
}

// =============================================================================
// SETTLEMENT ANALYSIS
// =============================================================================

/**
 * Find maximum settlement from all readings.
 * Why: Required for IS 2911 calculations (FR-008).
 */
export function findMaxSettlement(readings: ReadingInput[]): number {
  if (readings.length === 0) return 0;
  return Math.max(...readings.map((r) => r.avgSettlementMm ?? 0));
}

/**
 * Find final settlement after complete unloading.
 * Why: Used to calculate elastic rebound (FR-009).
 */
export function findFinalSettlement(readings: ReadingInput[]): number {
  const unloadingReadings = readings.filter((r) => r.phase === 'UNLOADING');
  if (unloadingReadings.length === 0) {
    // If no unloading phase, return max settlement
    return findMaxSettlement(readings);
  }

  // Final settlement should be the LAST reading at the MINIMUM unloading load
  // (typically 0 load with 1/5/15 min stabilization readings).
  const minLoad = Math.min(...unloadingReadings.map((r) => r.loadT));
  for (let i = unloadingReadings.length - 1; i >= 0; i--) {
    if (unloadingReadings[i].loadT === minLoad) {
      return unloadingReadings[i].avgSettlementMm;
    }
  }

  // Fallback (should never happen)
  return unloadingReadings[unloadingReadings.length - 1].avgSettlementMm;
}

/**
 * Calculate elastic rebound.
 * Formula: elastic rebound = max settlement - final settlement
 * Why: Required for IS 2911 pass/fail determination (FR-009).
 */
export function calculateElasticRebound(readings: ReadingInput[]): number {
  const maxSettlement = findMaxSettlement(readings);
  const finalSettlement = findFinalSettlement(readings);
  return Math.max(0, maxSettlement - finalSettlement);
}

/**
 * Calculate net settlement.
 * Formula: net settlement = max settlement - elastic rebound
 * Why: Primary criterion for pass/fail per IS 2911 (FR-010).
 */
export function calculateNetSettlement(readings: ReadingInput[]): number {
  const maxSettlement = findMaxSettlement(readings);
  const elasticRebound = calculateElasticRebound(readings);
  return maxSettlement - elasticRebound;
}

// =============================================================================
// LINEAR INTERPOLATION
// =============================================================================

/**
 * Interpolate load at a specific settlement value.
 * Uses linear interpolation between adjacent readings.
 * Why: Required to find load at 12mm settlement for safe load calculation (FR-012).
 */
export function interpolateLoadAtSettlement(
  readings: ReadingInput[],
  targetSettlementMm: number,
  phase: TestPhase = 'LOADING'
): number | null {
  // Filter to specific phase and sort by settlement
  const phaseReadings = readings
    .filter((r) => r.phase === phase)
    .sort((a, b) => a.avgSettlementMm - b.avgSettlementMm);

  if (phaseReadings.length < 2) return null;

  // Check if target is within range
  const minSettlement = phaseReadings[0].avgSettlementMm;
  const maxSettlement = phaseReadings[phaseReadings.length - 1].avgSettlementMm;

  if (targetSettlementMm < minSettlement) return null;
  if (targetSettlementMm > maxSettlement) return null;

  // Find the two readings that bracket the target settlement
  for (let i = 0; i < phaseReadings.length - 1; i++) {
    const r1 = phaseReadings[i];
    const r2 = phaseReadings[i + 1];

    if (
      targetSettlementMm >= r1.avgSettlementMm &&
      targetSettlementMm <= r2.avgSettlementMm
    ) {
      // Linear interpolation
      const ratio =
        (targetSettlementMm - r1.avgSettlementMm) /
        (r2.avgSettlementMm - r1.avgSettlementMm);
      return r1.loadT + ratio * (r2.loadT - r1.loadT);
    }
  }

  return null;
}

// =============================================================================
// SAFE LOAD CALCULATIONS
// =============================================================================

/**
 * Calculate safe load from settlement criterion (IS 2911).
 * Formula: safe load = (2/3) × load at settlement limit
 * Why: Primary safe load criterion per IS 2911 Part 4 (FR-012).
 */
export function calculateSafeLoadFromSettlement(
  readings: ReadingInput[],
  settlementLimitMm: number
): number | null {
  const loadAtLimit = interpolateLoadAtSettlement(
    readings,
    settlementLimitMm,
    'LOADING'
  );
  if (loadAtLimit === null) return null;
  return (2 / 3) * loadAtLimit;
}

/**
 * Calculate safe load from ultimate capacity criterion (IS 2911).
 * Formula: safe load = 0.5 × load at 10% pile diameter settlement
 * Why: Secondary safe load criterion per IS 2911 Part 4 (FR-012).
 */
export function calculateSafeLoadFromUltimate(
  readings: ReadingInput[],
  pileDiameterMm: number
): number | null {
  const ultimateLimitMm = 0.1 * pileDiameterMm; // 10% of pile diameter
  const loadAtUltimate = interpolateLoadAtSettlement(
    readings,
    ultimateLimitMm,
    'LOADING'
  );
  if (loadAtUltimate === null) return null;
  return 0.5 * loadAtUltimate;
}

/**
 * Determine final safe load by comparing criteria.
 * Why: Safe load is the minimum of all applicable criteria.
 */
export function determineSafeLoad(
  designLoadT: number,
  safeLoadFromSettlement: number | null,
  safeLoadFromUltimate: number | null
): {
  safeLoadAdoptedT: number;
  governingCriterion: 'SETTLEMENT' | 'ULTIMATE' | 'DESIGN' | 'NONE';
} {
  const candidates: { value: number; criterion: 'SETTLEMENT' | 'ULTIMATE' | 'DESIGN' }[] = [];

  if (safeLoadFromSettlement !== null && safeLoadFromSettlement > 0) {
    candidates.push({ value: safeLoadFromSettlement, criterion: 'SETTLEMENT' });
  }
  if (safeLoadFromUltimate !== null && safeLoadFromUltimate > 0) {
    candidates.push({ value: safeLoadFromUltimate, criterion: 'ULTIMATE' });
  }

  // If no calculated safe loads, use design load
  if (candidates.length === 0) {
    return {
      safeLoadAdoptedT: designLoadT,
      governingCriterion: 'DESIGN',
    };
  }

  // Take minimum
  const minimum = candidates.reduce((min, c) =>
    c.value < min.value ? c : min
  );

  // But don't exceed design load
  if (minimum.value >= designLoadT) {
    return {
      safeLoadAdoptedT: designLoadT,
      governingCriterion: 'DESIGN',
    };
  }

  return {
    safeLoadAdoptedT: minimum.value,
    governingCriterion: minimum.criterion,
  };
}

// =============================================================================
// PASS/FAIL DETERMINATION
// =============================================================================

/**
 * Determine if test passed IS 2911 criteria.
 * Criteria: net settlement ≤ min(12mm, 2% of pile diameter)
 * Why: Core pass/fail logic per IS 2911 Part 4 (FR-011).
 */
export function determinePassFail(
  netSettlementMm: number,
  settlementLimitMm: number,
  pileDiameterMm: number
): boolean {
  const twoPercentDia = 0.02 * pileDiameterMm;
  const effectiveLimit = Math.min(settlementLimitMm, twoPercentDia);
  return netSettlementMm <= effectiveLimit;
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Round a number to specified decimal places.
 * Why: Consistent precision in reports.
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Format a number for display.
 * Why: Consistent formatting in UI.
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
  fallback: string = '-'
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}


