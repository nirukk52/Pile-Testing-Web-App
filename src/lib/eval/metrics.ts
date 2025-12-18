/**
 * Eval Metrics
 * Why: Helper functions to calculate accuracy and compare values.
 */

import type { 
  ExpectedProjectInfo, 
  ExpectedReading, 
  FieldComparison,
  ReadingComparison,
  EvalConfig,
  DEFAULT_EVAL_CONFIG 
} from './types';

/**
 * Compares two string values with fuzzy matching.
 * Why: Handles minor variations like "ABC Infra" vs "ABC Infrastructure".
 */
export function compareStrings(expected: string, extracted: string): FieldComparison {
  const exp = (expected || '').trim().toLowerCase();
  const ext = (extracted || '').trim().toLowerCase();
  
  if (!ext) {
    return {
      field: '',
      expected,
      extracted,
      match: false,
      matchType: 'missing',
      message: 'Value not extracted',
    };
  }
  
  if (exp === ext) {
    return {
      field: '',
      expected,
      extracted,
      match: true,
      matchType: 'exact',
    };
  }
  
  // Fuzzy match - check if one contains the other
  if (exp.includes(ext) || ext.includes(exp)) {
    return {
      field: '',
      expected,
      extracted,
      match: true,
      matchType: 'fuzzy',
      message: 'Partial match',
    };
  }
  
  return {
    field: '',
    expected,
    extracted,
    match: false,
    matchType: 'mismatch',
  };
}

/**
 * Compares two numeric values with tolerance.
 * Why: Allows small differences due to rounding or OCR errors.
 */
export function compareNumbers(
  expected: number, 
  extracted: number, 
  tolerancePercent: number = 1
): FieldComparison {
  if (extracted === undefined || extracted === null || isNaN(extracted)) {
    return {
      field: '',
      expected,
      extracted,
      match: false,
      matchType: 'missing',
      message: 'Value not extracted',
    };
  }
  
  if (expected === extracted) {
    return {
      field: '',
      expected,
      extracted,
      match: true,
      matchType: 'exact',
    };
  }
  
  // Handle zero case
  if (expected === 0) {
    const isClose = Math.abs(extracted) < 0.01;
    return {
      field: '',
      expected,
      extracted,
      match: isClose,
      matchType: isClose ? 'tolerance' : 'mismatch',
      message: isClose ? 'Within tolerance of zero' : `Expected 0, got ${extracted}`,
    };
  }
  
  // Calculate percentage difference
  const diff = Math.abs(expected - extracted);
  const percentDiff = (diff / Math.abs(expected)) * 100;
  
  if (percentDiff <= tolerancePercent) {
    return {
      field: '',
      expected,
      extracted,
      match: true,
      matchType: 'tolerance',
      message: `Within ${tolerancePercent}% tolerance (${percentDiff.toFixed(2)}% diff)`,
    };
  }
  
  return {
    field: '',
    expected,
    extracted,
    match: false,
    matchType: 'mismatch',
    message: `${percentDiff.toFixed(2)}% difference (tolerance: ${tolerancePercent}%)`,
  };
}

/**
 * Compares dial gauge values with absolute tolerance.
 * Why: Dial gauges have fixed precision (±0.05mm typical).
 */
export function compareDialGauge(
  expected: number, 
  extracted: number, 
  toleranceMm: number = 0.05
): FieldComparison {
  if (extracted === undefined || extracted === null || isNaN(extracted)) {
    return {
      field: '',
      expected,
      extracted,
      match: false,
      matchType: 'missing',
      message: 'Value not extracted',
    };
  }
  
  const diff = Math.abs(expected - extracted);
  
  if (diff <= toleranceMm) {
    return {
      field: '',
      expected,
      extracted,
      match: true,
      matchType: diff === 0 ? 'exact' : 'tolerance',
      message: diff > 0 ? `Within ±${toleranceMm}mm tolerance` : undefined,
    };
  }
  
  return {
    field: '',
    expected,
    extracted,
    match: false,
    matchType: 'mismatch',
    message: `${diff.toFixed(3)}mm difference (tolerance: ±${toleranceMm}mm)`,
  };
}

/**
 * Compares project info fields.
 * Why: Different fields need different comparison strategies.
 */
export function compareProjectInfo(
  expected: ExpectedProjectInfo,
  extracted: Partial<ExpectedProjectInfo>,
  config: EvalConfig = DEFAULT_EVAL_CONFIG
): FieldComparison[] {
  const comparisons: FieldComparison[] = [];
  
  // String fields
  const stringFields: (keyof ExpectedProjectInfo)[] = [
    'pileId', 'project', 'location', 'client', 'contractor', 
    'concreteGrade', 'testDate', 'dateOfCasting', 'reportNo'
  ];
  
  for (const field of stringFields) {
    if (expected[field] !== undefined) {
      const result = compareStrings(
        String(expected[field] || ''), 
        String(extracted[field] || '')
      );
      result.field = field;
      comparisons.push(result);
    }
  }
  
  // Numeric fields with percentage tolerance
  const numericFields: (keyof ExpectedProjectInfo)[] = [
    'pileDiameter', 'pileDepth', 'designLoad', 'testLoad', 'ramArea'
  ];
  
  for (const field of numericFields) {
    if (expected[field] !== undefined) {
      const result = compareNumbers(
        expected[field] as number,
        extracted[field] as number,
        config.tolerances.pressure // Use pressure tolerance for all numeric
      );
      result.field = field;
      comparisons.push(result);
    }
  }
  
  return comparisons;
}

/**
 * Compares a single reading row.
 * Why: Evaluates all fields in a reading against expected values.
 */
export function compareReading(
  expected: ExpectedReading,
  extracted: Partial<ExpectedReading>,
  config: EvalConfig = DEFAULT_EVAL_CONFIG
): ReadingComparison {
  const fields: FieldComparison[] = [];
  
  // Phase (string)
  const phaseResult = compareStrings(expected.phase, extracted.phase || '');
  phaseResult.field = 'phase';
  fields.push(phaseResult);
  
  // Pressure (percentage tolerance)
  const pressureResult = compareNumbers(
    expected.pressure, 
    extracted.pressure || 0, 
    config.tolerances.pressure
  );
  pressureResult.field = 'pressure';
  fields.push(pressureResult);
  
  // Load (percentage tolerance)
  const loadResult = compareNumbers(
    expected.load, 
    extracted.load || 0, 
    config.tolerances.load
  );
  loadResult.field = 'load';
  fields.push(loadResult);
  
  // Dial gauges (absolute tolerance)
  for (const dg of ['dg1', 'dg2', 'dg3', 'dg4'] as const) {
    const dgResult = compareDialGauge(
      expected[dg], 
      extracted[dg] || 0, 
      config.tolerances.dialGauge
    );
    dgResult.field = dg;
    fields.push(dgResult);
  }
  
  // Average settlement (absolute tolerance)
  const avgResult = compareDialGauge(
    expected.avgSettlement, 
    extracted.avgSettlement || 0, 
    config.tolerances.dialGauge
  );
  avgResult.field = 'avgSettlement';
  fields.push(avgResult);
  
  const overallMatch = fields.every(f => f.match);
  
  return {
    sequence: expected.sequence,
    phase: expected.phase,
    fields,
    overallMatch,
  };
}

/**
 * Calculates overall score from comparisons.
 * Why: Weighted scoring based on importance of different fields.
 */
export function calculateScore(
  projectInfoComparisons: FieldComparison[],
  readingsComparisons: ReadingComparison[],
  expectedReadingsCount: number,
  extractedReadingsCount: number,
  config: EvalConfig = DEFAULT_EVAL_CONFIG
): number {
  const { weights } = config;
  const totalWeight = weights.projectInfo + weights.readingCount + 
                      weights.dialGaugeValues + weights.pressureLoadValues;
  
  // Project info score (0-100)
  const projectInfoMatched = projectInfoComparisons.filter(c => c.match).length;
  const projectInfoTotal = projectInfoComparisons.length;
  const projectInfoScore = projectInfoTotal > 0 
    ? (projectInfoMatched / projectInfoTotal) * 100 
    : 0;
  
  // Reading count score (0 or 100)
  const readingCountScore = expectedReadingsCount === extractedReadingsCount ? 100 : 
    (Math.min(expectedReadingsCount, extractedReadingsCount) / 
     Math.max(expectedReadingsCount, extractedReadingsCount)) * 100;
  
  // Dial gauge accuracy
  let dgMatched = 0;
  let dgTotal = 0;
  for (const reading of readingsComparisons) {
    for (const field of reading.fields) {
      if (['dg1', 'dg2', 'dg3', 'dg4', 'avgSettlement'].includes(field.field)) {
        dgTotal++;
        if (field.match) dgMatched++;
      }
    }
  }
  const dialGaugeScore = dgTotal > 0 ? (dgMatched / dgTotal) * 100 : 0;
  
  // Pressure/load accuracy
  let plMatched = 0;
  let plTotal = 0;
  for (const reading of readingsComparisons) {
    for (const field of reading.fields) {
      if (['pressure', 'load'].includes(field.field)) {
        plTotal++;
        if (field.match) plMatched++;
      }
    }
  }
  const pressureLoadScore = plTotal > 0 ? (plMatched / plTotal) * 100 : 0;
  
  // Weighted average
  const score = (
    (projectInfoScore * weights.projectInfo) +
    (readingCountScore * weights.readingCount) +
    (dialGaugeScore * weights.dialGaugeValues) +
    (pressureLoadScore * weights.pressureLoadValues)
  ) / totalWeight;
  
  return Math.round(score * 100) / 100;
}

/**
 * Formats eval result as a human-readable string.
 * Why: For CLI output and debugging.
 */
export function formatEvalResult(
  reportId: string,
  score: number,
  projectInfoComparisons: FieldComparison[],
  readingsComparisons: ReadingComparison[],
  passed: boolean
): string {
  const lines: string[] = [];
  
  lines.push(`📊 Eval Results for ${reportId}`);
  lines.push('━'.repeat(50));
  lines.push('');
  
  // Project Info
  lines.push('Project Info:');
  for (const comp of projectInfoComparisons) {
    const icon = comp.match ? '✅' : '❌';
    const detail = comp.match 
      ? `${comp.extracted} (${comp.matchType})`
      : `"${comp.extracted}" vs "${comp.expected}"`;
    lines.push(`  ${icon} ${comp.field}: ${detail}`);
  }
  lines.push('');
  
  // Readings summary
  const readingsMatched = readingsComparisons.filter(r => r.overallMatch).length;
  lines.push(`Readings: ${readingsMatched}/${readingsComparisons.length} fully matched`);
  
  // Show first few failures
  const failedReadings = readingsComparisons.filter(r => !r.overallMatch).slice(0, 3);
  for (const reading of failedReadings) {
    const failedFields = reading.fields.filter(f => !f.match);
    lines.push(`  ❌ Row ${reading.sequence}: ${failedFields.map(f => f.field).join(', ')}`);
  }
  lines.push('');
  
  // Overall
  const passIcon = passed ? '✅' : '❌';
  lines.push(`Overall Score: ${score}% ${passIcon} (Target: 80%)`);
  
  return lines.join('\n');
}
