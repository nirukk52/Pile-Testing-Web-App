/**
 * Extract Eval
 * Why: Runs Vision API extraction on a field sheet and compares to expected data.
 */

import fs from 'fs';
import path from 'path';
import type { 
  ExpectedData, 
  ExtractedData, 
  EvalResult, 
  EvalConfig 
} from './types';
import { DEFAULT_EVAL_CONFIG } from './types';
import { 
  compareProjectInfo, 
  compareReading, 
  calculateScore,
  formatEvalResult 
} from './metrics';

/**
 * Loads expected.json from training data folder.
 * Why: Ground truth for comparison.
 */
export function loadExpectedData(reportId: string): ExpectedData {
  const expectedPath = path.join(
    process.cwd(), 
    'training-data', 
    reportId, 
    'expected.json'
  );
  
  if (!fs.existsSync(expectedPath)) {
    throw new Error(`Expected data not found: ${expectedPath}`);
  }
  
  const content = fs.readFileSync(expectedPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Loads extracted.json if it exists.
 * Why: Reuse previous extraction results.
 */
export function loadExtractedData(reportId: string): ExtractedData | null {
  const extractedPath = path.join(
    process.cwd(), 
    'training-data', 
    reportId, 
    'extracted.json'
  );
  
  if (!fs.existsSync(extractedPath)) {
    return null;
  }
  
  const content = fs.readFileSync(extractedPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Saves extracted data to training folder.
 * Why: Cache extraction results for analysis.
 */
export function saveExtractedData(reportId: string, data: ExtractedData): void {
  const extractedPath = path.join(
    process.cwd(), 
    'training-data', 
    reportId, 
    'extracted.json'
  );
  
  fs.writeFileSync(extractedPath, JSON.stringify(data, null, 2));
}

/**
 * Saves eval result to training folder.
 * Why: Track evaluation history and failures.
 */
export function saveEvalResult(reportId: string, result: EvalResult): void {
  const resultPath = path.join(
    process.cwd(), 
    'training-data', 
    reportId, 
    'eval-result.json'
  );
  
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
}

/**
 * Runs evaluation comparing extracted data to expected data.
 * Why: Core eval logic - measures accuracy and generates report.
 */
export function runEvaluation(
  reportId: string,
  expected: ExpectedData,
  extracted: ExtractedData,
  config: EvalConfig = DEFAULT_EVAL_CONFIG
): EvalResult {
  // Compare project info
  const projectInfoComparisons = compareProjectInfo(
    expected.projectInfo,
    extracted.projectInfo,
    config
  );
  
  // Compare readings
  const readingsComparisons = expected.readings.map((expectedReading, index) => {
    const extractedReading = extracted.readings[index] || {};
    return compareReading(expectedReading, extractedReading, config);
  });
  
  // Calculate scores
  const projectInfoMatched = projectInfoComparisons.filter(c => c.match).length;
  const projectInfoScore = projectInfoComparisons.length > 0
    ? (projectInfoMatched / projectInfoComparisons.length) * 100
    : 0;
  
  const readingsMatched = readingsComparisons.filter(r => r.overallMatch).length;
  const readingsScore = readingsComparisons.length > 0
    ? (readingsMatched / readingsComparisons.length) * 100
    : 0;
  
  const overallScore = calculateScore(
    projectInfoComparisons,
    readingsComparisons,
    expected.readings.length,
    extracted.readings.length,
    config
  );
  
  // Collect failures
  const failures: string[] = [];
  
  for (const comp of projectInfoComparisons) {
    if (!comp.match) {
      failures.push(`Project info "${comp.field}": expected "${comp.expected}", got "${comp.extracted}"`);
    }
  }
  
  for (const reading of readingsComparisons) {
    if (!reading.overallMatch) {
      const failedFields = reading.fields.filter(f => !f.match);
      for (const field of failedFields) {
        failures.push(`Reading ${reading.sequence} "${field.field}": expected ${field.expected}, got ${field.extracted}`);
      }
    }
  }
  
  const result: EvalResult = {
    reportId,
    testType: expected.testType,
    timestamp: new Date().toISOString(),
    
    overallScore,
    projectInfoScore,
    readingsScore,
    
    projectInfoComparisons,
    readingsComparisons,
    
    totalReadingsExpected: expected.readings.length,
    totalReadingsExtracted: extracted.readings.length,
    fieldsMatched: projectInfoComparisons.filter(c => c.match).length + 
                   readingsComparisons.reduce((sum, r) => sum + r.fields.filter(f => f.match).length, 0),
    fieldsMissing: projectInfoComparisons.filter(c => c.matchType === 'missing').length +
                   readingsComparisons.reduce((sum, r) => sum + r.fields.filter(f => f.matchType === 'missing').length, 0),
    fieldsMismatched: projectInfoComparisons.filter(c => c.matchType === 'mismatch').length +
                      readingsComparisons.reduce((sum, r) => sum + r.fields.filter(f => f.matchType === 'mismatch').length, 0),
    
    passed: overallScore >= config.passThreshold,
    passThreshold: config.passThreshold,
    
    failures: failures.slice(0, 20), // Limit to first 20 failures
  };
  
  return result;
}

/**
 * Main entry point for extraction eval.
 * Why: Orchestrates the full eval flow.
 */
export async function runExtractEval(
  reportId: string,
  options: {
    reextract?: boolean;
    config?: EvalConfig;
    verbose?: boolean;
  } = {}
): Promise<EvalResult> {
  const { reextract = false, config = DEFAULT_EVAL_CONFIG, verbose = true } = options;
  
  if (verbose) {
    console.log(`\n🔍 Running extraction eval for ${reportId}...\n`);
  }
  
  // Load expected data
  const expected = loadExpectedData(reportId);
  if (verbose) {
    console.log(`✅ Loaded expected data: ${expected.readings.length} readings`);
  }
  
  // Check for existing extraction
  let extracted = loadExtractedData(reportId);
  
  if (!extracted || reextract) {
    if (verbose) {
      console.log('🤖 Running Vision API extraction...');
      console.log('   (Not implemented yet - using mock data)');
    }
    
    // TODO: Actually call Vision API here
    // For now, create empty extracted data to show the flow
    extracted = {
      projectInfo: {},
      readings: [],
      confidence: 0,
      extractedAt: new Date().toISOString(),
      model: 'gpt-4o (pending)',
    };
    
    saveExtractedData(reportId, extracted);
  } else {
    if (verbose) {
      console.log(`✅ Using cached extraction from ${extracted.extractedAt}`);
    }
  }
  
  // Run evaluation
  const result = runEvaluation(reportId, expected, extracted, config);
  
  // Save result
  saveEvalResult(reportId, result);
  
  // Print result
  if (verbose) {
    console.log('\n' + formatEvalResult(
      reportId,
      result.overallScore,
      result.projectInfoComparisons,
      result.readingsComparisons,
      result.passed
    ));
  }
  
  return result;
}
