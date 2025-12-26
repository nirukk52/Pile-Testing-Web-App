/**
 * Analyze Inconsistencies
 * Why: Analyzes eval results to identify extraction issues in project info and readings.
 * Provides actionable insights for improving extraction accuracy.
 * 
 * Usage: npx tsx analyze-inconsistencies.ts [report-id]
 * Default: report-001
 */

import fs from 'fs';
import path from 'path';

// =============================================================================
// TYPES
// =============================================================================

interface FieldComparison {
  field: string;
  expected: unknown;
  extracted: unknown;
  match: boolean;
  matchType: string;
  message?: string;
}

interface ReadingComparison {
  sequence: number;
  phase: string;
  fields: FieldComparison[];
  overallMatch: boolean;
}

interface EvalResult {
  reportId: string;
  testType: string;
  timestamp: string;
  overallScore: number;
  projectInfoScore: number;
  readingsScore: number;
  projectInfoComparisons: FieldComparison[];
  readingsComparisons: ReadingComparison[];
  totalReadingsExpected: number;
  totalReadingsExtracted: number;
  passed: boolean;
  passThreshold: number;
  failures: string[];
}

interface FieldStats {
  total: number;
  matched: number;
  mismatched: number;
  missing: number;
  matchRate: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parses date/time strings to Date object.
 * Why: Handles various formats from OCR extraction.
 */
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  
  try {
    let hours: number, minutes: number;
    
    // HH:MM format
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
    } 
    // Decimal format (e.g., "1.30")
    else if (timeStr.includes('.')) {
      const parts = timeStr.split('.');
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
    }
    // HHMM format (e.g., "1130")
    else {
      const num = Number(timeStr);
      if (!isNaN(num) && num >= 0 && num < 2400) {
        hours = Math.floor(num / 100);
        minutes = num % 100;
      } else {
        return null;
      }
    }
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) {
      return null;
    }
    
    const [year, month, day] = dateStr.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    
    return new Date(year, month - 1, day, hours, minutes);
  } catch {
    return null;
  }
}

/**
 * Formats Date as readable string.
 */
function formatDateTime(date: Date | null): string {
  if (!date) return 'N/A';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

/**
 * Formats a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
}

/**
 * Color codes for terminal output.
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// =============================================================================
// PROJECT INFO ANALYSIS
// =============================================================================

/**
 * Analyzes project info inconsistencies.
 * Why: Project info is critical for report accuracy and compliance.
 */
function analyzeProjectInfo(comparisons: FieldComparison[]): void {
  console.log('\n' + colorize('📋 PROJECT INFO ANALYSIS', 'bold'));
  console.log('═'.repeat(80));
  
  const matched = comparisons.filter(c => c.match);
  const failed = comparisons.filter(c => !c.match);
  
  console.log(`\nTotal Fields: ${comparisons.length}`);
  console.log(`${colorize('✅ Matched:', 'green')} ${matched.length}`);
  console.log(`${colorize('❌ Failed:', 'red')} ${failed.length}`);
  console.log(`Match Rate: ${((matched.length / comparisons.length) * 100).toFixed(1)}%\n`);
  
  // Show all fields with status
  console.log('─'.repeat(80));
  console.log(colorize('Field'.padEnd(20) + 'Status'.padEnd(12) + 'Expected'.padEnd(25) + 'Extracted', 'dim'));
  console.log('─'.repeat(80));
  
  for (const comp of comparisons) {
    const status = comp.match 
      ? colorize('✅ ' + comp.matchType, 'green')
      : colorize('❌ ' + comp.matchType, 'red');
    
    const expected = formatValue(comp.expected).substring(0, 24);
    const extracted = formatValue(comp.extracted).substring(0, 30);
    
    console.log(
      comp.field.padEnd(20) + 
      status.padEnd(22) + // Extra padding for color codes
      expected.padEnd(25) + 
      extracted
    );
  }
  
  // Show recommendations for failed fields
  if (failed.length > 0) {
    console.log('\n' + colorize('💡 RECOMMENDATIONS:', 'yellow'));
    console.log('─'.repeat(80));
    
    for (const comp of failed) {
      const rec = getProjectInfoRecommendation(comp);
      console.log(`\n  ${colorize(comp.field, 'cyan')}:`);
      console.log(`    Expected: "${formatValue(comp.expected)}"`);
      console.log(`    Extracted: "${formatValue(comp.extracted)}"`);
      console.log(`    ${colorize('→', 'yellow')} ${rec}`);
    }
  }
}

/**
 * Gets recommendation for fixing a project info field.
 */
function getProjectInfoRecommendation(comp: FieldComparison): string {
  const { field, matchType, expected, extracted } = comp;
  
  if (matchType === 'missing') {
    if (field === 'reportNo') {
      return 'Field not present on ZedGeo forms. Consider removing from expected.json or making optional.';
    }
    if (field === 'contractor') {
      return 'Check if field is empty on source. Prompt should return "NA" for empty fields.';
    }
    if (field === 'testDate') {
      return 'testDate should be inferred from first reading row. Add logic to extract from readings.';
    }
    return `Field not extracted. Check if label exists on form and update prompt hints.`;
  }
  
  if (matchType === 'mismatch') {
    if (field === 'project' || field === 'location') {
      return 'OCR variations in text. Consider more aggressive fuzzy matching.';
    }
    if (field === 'pileDepth') {
      return 'Decimal precision issue. Ensure prompt emphasizes preserving decimals (e.g., 11.51).';
    }
    if (field === 'reportNo' && extracted === expected?.toString().split('-')[0]) {
      return 'Model confusing reportNo with pileId. reportNo is NOT on ZedGeo forms.';
    }
    return `Value mismatch. Check OCR quality and prompt field mapping.`;
  }
  
  return 'Review extraction prompt and field hints.';
}

// =============================================================================
// READINGS ANALYSIS
// =============================================================================

/**
 * Analyzes readings inconsistencies.
 */
function analyzeReadings(comparisons: ReadingComparison[]): void {
  console.log('\n' + colorize('📊 READINGS ANALYSIS', 'bold'));
  console.log('═'.repeat(80));
  
  const matched = comparisons.filter(c => c.overallMatch);
  const failed = comparisons.filter(c => !c.overallMatch);
  
  console.log(`\nTotal Readings: ${comparisons.length}`);
  console.log(`${colorize('✅ Fully Matched:', 'green')} ${matched.length}`);
  console.log(`${colorize('❌ With Errors:', 'red')} ${failed.length}`);
  console.log(`Match Rate: ${((matched.length / comparisons.length) * 100).toFixed(1)}%\n`);
  
  // Calculate per-field statistics
  const targetFields = ['pressure', 'dg1', 'dg2', 'dg3', 'dg4', 'date', 'time'];
  const stats: Record<string, FieldStats> = {};
  
  for (const field of targetFields) {
    stats[field] = { total: 0, matched: 0, mismatched: 0, missing: 0, matchRate: 0 };
  }
  
  for (const reading of comparisons) {
    for (const field of reading.fields) {
      if (targetFields.includes(field.field)) {
        const s = stats[field.field];
        s.total++;
        if (field.match) {
          s.matched++;
        } else if (field.matchType === 'missing') {
          s.missing++;
        } else {
          s.mismatched++;
        }
      }
    }
  }
  
  // Calculate match rates
  for (const field of targetFields) {
    const s = stats[field];
    s.matchRate = s.total > 0 ? (s.matched / s.total) * 100 : 0;
  }
  
  // Display statistics table
  console.log('─'.repeat(80));
  console.log(colorize(
    'Field'.padEnd(12) + 
    'Total'.padStart(8) + 
    'Matched'.padStart(10) + 
    'Mismatch'.padStart(10) + 
    'Missing'.padStart(10) + 
    'Rate'.padStart(10),
    'dim'
  ));
  console.log('─'.repeat(80));
  
  for (const field of targetFields) {
    const s = stats[field];
    const rateColor = s.matchRate >= 95 ? 'green' : s.matchRate >= 80 ? 'yellow' : 'red';
    
    console.log(
      field.padEnd(12) +
      String(s.total).padStart(8) +
      colorize(String(s.matched).padStart(10), 'green') +
      colorize(String(s.mismatched).padStart(10), s.mismatched > 0 ? 'red' : 'dim') +
      colorize(String(s.missing).padStart(10), s.missing > 0 ? 'yellow' : 'dim') +
      colorize(s.matchRate.toFixed(1).padStart(9) + '%', rateColor)
    );
  }
  
  // Show failed readings details
  if (failed.length > 0) {
    console.log('\n' + colorize('❌ FAILED READINGS (first 15):', 'red'));
    console.log('─'.repeat(80));
    
    const toShow = failed.slice(0, 15);
    for (const reading of toShow) {
      const failedFields = reading.fields.filter(f => !f.match);
      const fieldNames = failedFields.map(f => f.field).join(', ');
      
      console.log(`\n  ${colorize(`Sequence ${reading.sequence}:`, 'cyan')} ${fieldNames}`);
      
      for (const field of failedFields) {
        console.log(`    ${field.field}: expected ${formatValue(field.expected)} → got ${formatValue(field.extracted)} (${field.matchType})`);
      }
    }
    
    if (failed.length > 15) {
      console.log(`\n  ${colorize(`... and ${failed.length - 15} more failed readings`, 'dim')}`);
    }
  }
}

// =============================================================================
// ORDER ANALYSIS
// =============================================================================

/**
 * Checks chronological order of readings.
 */
function analyzeOrder(comparisons: ReadingComparison[]): void {
  console.log('\n' + colorize('🕐 CHRONOLOGICAL ORDER CHECK', 'bold'));
  console.log('═'.repeat(80));
  
  const violations: Array<{
    sequence: number;
    issue: string;
    expected: string;
    extracted: string;
  }> = [];
  
  let prevExpected: Date | null = null;
  let prevExtracted: Date | null = null;
  
  for (const reading of comparisons) {
    const dateField = reading.fields.find(f => f.field === 'date');
    const timeField = reading.fields.find(f => f.field === 'time');
    
    const expectedDate = String(dateField?.expected || '');
    const expectedTime = String(timeField?.expected || '');
    const extractedDate = String(dateField?.extracted || '');
    const extractedTime = String(timeField?.extracted || '');
    
    const expectedDT = parseDateTime(expectedDate, expectedTime);
    const extractedDT = parseDateTime(extractedDate, extractedTime);
    
    // Check expected order
    if (expectedDT && prevExpected && expectedDT < prevExpected) {
      violations.push({
        sequence: reading.sequence,
        issue: 'Expected data out of order',
        expected: formatDateTime(expectedDT),
        extracted: formatDateTime(extractedDT),
      });
    }
    
    // Check extracted order
    if (extractedDT && prevExtracted && extractedDT < prevExtracted) {
      violations.push({
        sequence: reading.sequence,
        issue: 'Extracted data out of order',
        expected: formatDateTime(expectedDT),
        extracted: formatDateTime(extractedDT),
      });
    }
    
    // Check large time difference
    if (expectedDT && extractedDT) {
      const diffMinutes = Math.abs(expectedDT.getTime() - extractedDT.getTime()) / (1000 * 60);
      if (diffMinutes > 60) {
        violations.push({
          sequence: reading.sequence,
          issue: `Time difference: ${diffMinutes.toFixed(0)} minutes`,
          expected: formatDateTime(expectedDT),
          extracted: formatDateTime(extractedDT),
        });
      }
    }
    
    if (expectedDT) prevExpected = expectedDT;
    if (extractedDT) prevExtracted = extractedDT;
  }
  
  if (violations.length === 0) {
    console.log(`\n${colorize('✅ No order violations detected', 'green')}\n`);
  } else {
    console.log(`\n${colorize(`⚠️  ${violations.length} order violations found:`, 'yellow')}\n`);
    
    for (const v of violations.slice(0, 10)) {
      console.log(`  Seq ${String(v.sequence).padStart(3)}: ${v.issue}`);
      console.log(`           Expected: ${v.expected} | Extracted: ${v.extracted}`);
    }
    
    if (violations.length > 10) {
      console.log(`\n  ${colorize(`... and ${violations.length - 10} more`, 'dim')}`);
    }
  }
}

// =============================================================================
// SUMMARY
// =============================================================================

/**
 * Prints overall summary with actionable next steps.
 */
function printSummary(evalResult: EvalResult): void {
  console.log('\n' + colorize('📝 SUMMARY', 'bold'));
  console.log('═'.repeat(80));
  
  const scoreColor = evalResult.passed ? 'green' : 'red';
  const statusIcon = evalResult.passed ? '✅' : '❌';
  
  console.log(`\nReport: ${evalResult.reportId}`);
  console.log(`Test Type: ${evalResult.testType}`);
  console.log(`Overall Score: ${colorize(`${evalResult.overallScore.toFixed(1)}%`, scoreColor)} ${statusIcon}`);
  console.log(`Project Info Score: ${evalResult.projectInfoScore.toFixed(1)}%`);
  console.log(`Readings Score: ${evalResult.readingsScore.toFixed(1)}%`);
  console.log(`Pass Threshold: ${evalResult.passThreshold}%`);
  
  if (evalResult.failures.length > 0) {
    console.log(`\n${colorize('Top Failures:', 'yellow')}`);
    for (const failure of evalResult.failures.slice(0, 5)) {
      console.log(`  • ${failure}`);
    }
  }
  
  console.log('\n' + '═'.repeat(80) + '\n');
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  const reportId = args[0] || 'report-001';
  
  const evalResultPath = path.join(
    process.cwd(),
    'training-data',
    reportId,
    'eval-result.json'
  );
  
  if (!fs.existsSync(evalResultPath)) {
    console.error(`${colorize('Error:', 'red')} eval-result.json not found at ${evalResultPath}`);
    console.error(`Run: npx tsx src/lib/eval/extract-eval.ts ${reportId}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(evalResultPath, 'utf-8');
  const evalResult: EvalResult = JSON.parse(content);
  
  console.log('\n' + colorize('🔍 INCONSISTENCY ANALYSIS', 'bold'));
  console.log(`Report: ${reportId} | Generated: ${evalResult.timestamp}\n`);
  
  // Analyze each section
  analyzeProjectInfo(evalResult.projectInfoComparisons);
  analyzeReadings(evalResult.readingsComparisons);
  analyzeOrder(evalResult.readingsComparisons);
  printSummary(evalResult);
}

main();
