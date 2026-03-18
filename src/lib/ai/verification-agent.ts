/**
 * Verification Agent
 * Why: Scores generated reports for data integrity, IS 2911 compliance, and quality.
 * Returns a verification report with score, status, and actionable issues.
 */

import type {
  VerificationReport,
  VerificationIssue,
  CheckResult,
  LegacyProjectInfo,
  LoadEntry,
} from '@/types';
import { SETTLEMENT_LIMIT_MM } from '@/types';

/**
 * Score thresholds for verification status.
 * Why: Defines pass/warn/fail boundaries per spec.
 */
const SCORE_THRESHOLDS = {
  PASS: 90,
  WARN: 80,
};

/**
 * Generates a unique ID for issues.
 * Why: Each issue needs a stable identifier for tracking corrections.
 */
function generateIssueId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main verification function - analyzes a test and returns a verification report.
 * Why: Single entry point for all verification checks.
 */
export function verifyTest(
  testId: string,
  projectInfo: LegacyProjectInfo,
  loadEntries: LoadEntry[],
  reportVersion = 1
): VerificationReport {
  const issues: VerificationIssue[] = [];

  // Run all checks
  const dataIntegrity = checkDataIntegrity(projectInfo, loadEntries, issues);
  const complianceIS2911 = checkIS2911Compliance(projectInfo, loadEntries, issues);
  const visualQuality = checkVisualQuality(projectInfo, loadEntries, issues);

  // Calculate overall score (weighted average)
  const weights = { dataIntegrity: 0.4, compliance: 0.4, visual: 0.2 };
  const score = Math.round(
    dataIntegrity.score * weights.dataIntegrity +
      complianceIS2911.score * weights.compliance +
      visualQuality.score * weights.visual
  );

  // Determine status
  let status: 'pass' | 'warn' | 'fail';
  if (score >= SCORE_THRESHOLDS.PASS) {
    status = 'pass';
  } else if (score >= SCORE_THRESHOLDS.WARN) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  // Generate summary
  const summary = generateSummary(score, status, issues);

  return {
    id: `vr-${Date.now()}`,
    testId,
    reportVersion,
    score,
    status,
    checks: {
      dataIntegrity,
      complianceIS2911,
      visualQuality,
    },
    issues,
    summary,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Checks data integrity - verifies values are consistent and reasonable.
 * Why: Catches OCR errors, typos, and data entry mistakes.
 */
function checkDataIntegrity(
  projectInfo: LegacyProjectInfo,
  loadEntries: LoadEntry[],
  issues: VerificationIssue[]
): CheckResult {
  let score = 100;
  const details: string[] = [];

  // Check 1: Required fields present
  const requiredFields: Array<keyof LegacyProjectInfo> = [
    'pileId',
    'project',
    'designLoadOnPile',
    'ramArea',
    'pileDiameter',
  ];
  for (const field of requiredFields) {
    if (!projectInfo[field]) {
      score -= 10;
      issues.push({
        id: generateIssueId(),
        severity: 'critical',
        category: 'data',
        message: `Missing required field: ${field}`,
        location: 'Project Details',
      });
    }
  }

  // Check 2: Readings exist
  if (loadEntries.length === 0) {
    score -= 30;
    issues.push({
      id: generateIssueId(),
      severity: 'critical',
      category: 'data',
      message: 'No readings recorded',
      location: 'Data Entry',
    });
    details.push('No readings');
  }

  // Check 3: Validate each reading
  const ramArea = parseFloat(projectInfo.ramArea) || 0;
  loadEntries.forEach((entry, index) => {
    const reading = entry.readings[0];
    if (!reading) return;

    const pressure = parseFloat(reading.pressureGauge);
    const expectedLoad = ramArea > 0 ? (pressure * ramArea) / 1000 : 0;
    const actualLoad = parseFloat(reading.load);

    // Check for load calculation mismatch
    if (ramArea > 0 && Math.abs(expectedLoad - actualLoad) > 0.5) {
      score -= 5;
      issues.push({
        id: generateIssueId(),
        severity: 'warning',
        category: 'data',
        message: `Load calculation mismatch: expected ${expectedLoad.toFixed(2)} MT, got ${actualLoad} MT`,
        location: `Reading #${index + 1}`,
        suggestedCorrection: expectedLoad.toFixed(2),
        correctionConfidence: 95,
      });
    }

    // Check for suspiciously high dial gauge values
    const dialGauges = [
      parseFloat(reading.dialGauge1),
      parseFloat(reading.dialGauge2),
      parseFloat(reading.dialGauge3),
      parseFloat(reading.dialGauge4),
    ];
    dialGauges.forEach((dg, dgIndex) => {
      if (dg > 100) {
        score -= 3;
        issues.push({
          id: generateIssueId(),
          severity: 'warning',
          category: 'data',
          message: `DG${dgIndex + 1} value ${dg}mm seems too high - possible decimal error`,
          location: `Reading #${index + 1}`,
          suggestedCorrection: (dg / 10).toFixed(2),
          correctionConfidence: 70,
        });
      }
    });

    // Check for non-monotonic settlement during loading
    if (index > 0 && reading.phase === 'loading') {
      const prevEntry = loadEntries[index - 1];
      const prevReading = prevEntry?.readings[0];
      if (prevReading) {
        const prevAvg = parseFloat(prevReading.avgSettlement || '0');
        const currDg1 = parseFloat(reading.dialGauge1);
        if (currDg1 < prevAvg * 0.9 && prevAvg > 0) {
          score -= 2;
          issues.push({
            id: generateIssueId(),
            severity: 'info',
            category: 'data',
            message: 'Settlement decreased during loading - unusual but possible',
            location: `Reading #${index + 1}`,
          });
        }
      }
    }
  });

  return {
    passed: score >= 80,
    score: Math.max(0, score),
    details: details.length > 0 ? details.join('; ') : 'Data integrity checks passed',
  };
}

/**
 * Checks IS 2911 compliance - verifies test follows Indian Standard requirements.
 * Why: Ensures report meets regulatory requirements.
 */
function checkIS2911Compliance(
  projectInfo: LegacyProjectInfo,
  loadEntries: LoadEntry[],
  issues: VerificationIssue[]
): CheckResult {
  let score = 100;
  const details: string[] = [];

  const designLoad = parseFloat(projectInfo.designLoadOnPile) || 0;
  const testLoad = parseFloat(projectInfo.testLoad) || 0;
  const pileDiameter = parseFloat(projectInfo.pileDiameter) || 0;
  const testType = projectInfo.testType;

  // Check 1: Test load multiplier
  if (designLoad > 0 && testLoad > 0) {
    const multiplier = testLoad / designLoad;
    const expectedMultiplier = testType === 'RVPLT' ? 1.5 : 2.5;

    if (Math.abs(multiplier - expectedMultiplier) > 0.1) {
      score -= 10;
      issues.push({
        id: generateIssueId(),
        severity: 'warning',
        category: 'compliance',
        message: `Test load ratio is ${multiplier.toFixed(2)}x, expected ${expectedMultiplier}x for ${testType || 'IVPLT'}`,
        location: 'Pile Specifications',
      });
    }
  }

  // Check 2: Settlement limit — type-aware per IS 2911
  // RVPLT: 12mm for dia ≤ 600mm, min(18, 2%dia) for dia > 600mm
  // IVPLT/others: min(12, 2%dia)
  const settlementLimit = (() => {
    if (pileDiameter <= 0) return SETTLEMENT_LIMIT_MM;
    if (testType === 'RVPLT') {
      return pileDiameter <= 600 ? 12 : Math.min(18, 0.02 * pileDiameter);
    }
    return Math.min(SETTLEMENT_LIMIT_MM, pileDiameter * 0.02);
  })();

  // Compute max and net settlement from readings.
  // Net settlement = max settlement - elastic rebound (IS 2911 pass/fail criterion).
  let maxSettlement = 0;
  let finalSettlement = 0;
  const pressureValues: number[] = [];
  loadEntries.forEach((entry) => {
    const reading = entry.readings[0];
    if (reading) {
      const pressure = parseFloat(reading.pressureGauge) || 0;
      pressureValues.push(pressure);
      const dialGauges = [
        reading.dialGauge1,
        reading.dialGauge2,
        reading.dialGauge3,
        reading.dialGauge4,
      ].map((dg) => parseFloat(dg) || 0);
      const enabledGauges = dialGauges.filter((_, i) => {
        const enabled = [
          reading.dg1Enabled ?? true,
          reading.dg2Enabled ?? true,
          reading.dg3Enabled ?? true,
          reading.dg4Enabled ?? true,
        ][i];
        return enabled && dialGauges[i] > 0;
      });
      if (enabledGauges.length > 0) {
        const avg = enabledGauges.reduce((a, b) => a + b, 0) / enabledGauges.length;
        maxSettlement = Math.max(maxSettlement, avg);
        finalSettlement = avg;
      }
    }
  });

  // Detect unloading by checking if pressure decreases at the end of the sequence
  const hasUnloading = pressureValues.length >= 3 &&
    pressureValues[pressureValues.length - 1] < pressureValues[Math.floor(pressureValues.length / 2)];

  const elasticRebound = hasUnloading ? maxSettlement - finalSettlement : 0;
  const netSettlement = maxSettlement - elasticRebound;

  // Check 3: Borderline settlement handling (using net settlement)
  if (netSettlement > settlementLimit * 0.9 && netSettlement <= settlementLimit * 1.05) {
    issues.push({
      id: generateIssueId(),
      severity: 'warning',
      category: 'compliance',
      message: `Net settlement ${netSettlement.toFixed(2)}mm is near the ${settlementLimit.toFixed(1)}mm limit - requires human review`,
      location: 'Test Results',
    });
    score -= 5;
  } else if (netSettlement > settlementLimit * 1.05) {
    issues.push({
      id: generateIssueId(),
      severity: 'critical',
      category: 'compliance',
      message: `Net settlement ${netSettlement.toFixed(2)}mm exceeds ${settlementLimit.toFixed(1)}mm limit - test FAILED per IS 2911`,
      location: 'Test Results',
    });
    score -= 20;
  }

  // Check 4: Required loading stages
  const pressures = loadEntries.map((e) => parseFloat(e.readings[0]?.pressureGauge || '0'));
  const uniquePressures = new Set(pressures.filter((p) => p > 0));
  const minStagesByType: Record<string, number> = {
    IVPLT: 8,
    RVPLT: 5,
    LATERAL: 5,
    UPLIFT: 5,
  };
  const minStages = minStagesByType[testType ?? 'IVPLT'] ?? 5;
  if (uniquePressures.size < minStages) {
    issues.push({
      id: generateIssueId(),
      severity: 'info',
      category: 'compliance',
      message: `Only ${uniquePressures.size} load stages recorded - IS 2911 recommends minimum ${minStages} stages for ${testType}`,
      location: 'Data Entry',
    });
  }

  return {
    passed: score >= 80,
    score: Math.max(0, score),
    details: details.length > 0 ? details.join('; ') : 'IS 2911 compliance checks passed',
  };
}

/**
 * Checks visual quality - verifies report formatting and completeness.
 * Why: Ensures professional report output.
 */
function checkVisualQuality(
  projectInfo: LegacyProjectInfo,
  loadEntries: LoadEntry[],
  issues: VerificationIssue[]
): CheckResult {
  let score = 100;

  // Check 1: Too many readings (might cause table overflow)
  if (loadEntries.length > 50) {
    score -= 10;
    issues.push({
      id: generateIssueId(),
      severity: 'info',
      category: 'formatting',
      message: `${loadEntries.length} readings may cause table overflow - consider page breaks`,
      location: 'Data Table',
    });
  }

  // Check 2: Missing optional but recommended fields
  const recommendedFields = ['reportNo', 'testDate', 'pileDepth', 'mixedDesign'];
  const missingRecommended = recommendedFields.filter((f) => !projectInfo[f as keyof LegacyProjectInfo]);
  if (missingRecommended.length > 0) {
    score -= missingRecommended.length * 2;
    issues.push({
      id: generateIssueId(),
      severity: 'info',
      category: 'formatting',
      message: `Recommended fields missing: ${missingRecommended.join(', ')}`,
      location: 'Project Details',
    });
  }

  // Check 3: Readings without timestamps
  const readingsWithoutTime = loadEntries.filter(
    (e) => !e.readings[0]?.timestamp || e.readings[0].timestamp === ''
  );
  if (readingsWithoutTime.length > loadEntries.length / 2) {
    score -= 5;
    issues.push({
      id: generateIssueId(),
      severity: 'info',
      category: 'formatting',
      message: 'Many readings missing timestamps - chart may not display correctly',
      location: 'Data Entry',
    });
  }

  return {
    passed: score >= 80,
    score: Math.max(0, score),
    details: 'Visual quality checks completed',
  };
}

/**
 * Generates a human-readable summary of verification results.
 * Why: Provides quick overview for users.
 */
function generateSummary(
  score: number,
  status: 'pass' | 'warn' | 'fail',
  issues: VerificationIssue[]
): string {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  if (status === 'pass') {
    return `Report verified successfully with score ${score}/100. ${
      warningCount > 0 ? `${warningCount} minor warnings to review.` : 'No issues found.'
    }`;
  } else if (status === 'warn') {
    return `Report needs attention. Score: ${score}/100. Found ${warningCount} warnings that should be reviewed before approval.`;
  } else {
    return `Report verification failed. Score: ${score}/100. ${criticalCount} critical issues must be resolved before approval.`;
  }
}

/**
 * Quick verification for real-time feedback during data entry.
 * Why: Provides immediate feedback without full report generation.
 */
export function quickVerify(
  projectInfo: LegacyProjectInfo,
  loadEntries: LoadEntry[]
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Quick checks
  if (!projectInfo.pileId) warnings.push('Pile ID required');
  if (!projectInfo.ramArea) warnings.push('Ram Area required for calculations');
  if (loadEntries.length === 0) warnings.push('No readings recorded');

  // Check for obvious data issues
  const ramArea = parseFloat(projectInfo.ramArea) || 0;
  if (ramArea > 0) {
    loadEntries.forEach((entry, i) => {
      const reading = entry.readings[0];
      if (reading) {
        const pressure = parseFloat(reading.pressureGauge);
        const load = parseFloat(reading.load);
        const expected = (pressure * ramArea) / 1000;
        if (Math.abs(expected - load) > 1) {
          warnings.push(`Reading ${i + 1}: Load mismatch`);
        }
      }
    });
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
