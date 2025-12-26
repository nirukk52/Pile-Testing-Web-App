/**
 * Extract Eval
 * Why: Runs Vision API extraction on a field sheet and compares to expected data.
 */

// Load environment variables from .env files
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
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
import { runAgentSwarm, type AgentSwarmResult } from '../ai/agent-swarm';

/**
 * Finds the field sheet PDF in the training data folder.
 * Why: Field sheet names can vary, so we search for any PDF in the field-sheet folder.
 */
function findFieldSheetPdf(reportId: string): string | null {
  const fieldSheetDir = path.join(
    process.cwd(),
    'training-data',
    reportId,
    'field-sheet'
  );
  
  if (!fs.existsSync(fieldSheetDir)) {
    return null;
  }
  
  const files = fs.readdirSync(fieldSheetDir);
  const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));
  
  return pdfFile ? path.join(fieldSheetDir, pdfFile) : null;
}

/**
 * Crops an image to its content by removing whitespace/margins.
 * Why: Removes unnecessary margins so Vision API focuses on actual content.
 */
async function cropToContent(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Use sharp to trim whitespace from the image
    // threshold: 10 allows for slight off-white backgrounds
    const trimmed = await sharp(imageBuffer)
      .trim({ threshold: 10 })
      .toBuffer();
    return trimmed;
  } catch (error) {
    // If trimming fails (e.g., image is all white), return original
    console.log('   ⚠️  Trim failed, using original image');
    return imageBuffer;
  }
}

/**
 * Converts PDF pages to base64 PNG images with content cropping.
 * Why: Vision API only accepts images, not PDFs directly.
 * Cropping removes margins to help the model focus on actual content.
 */
async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  // Dynamic import for ES module
  const { pdf } = await import('pdf-to-img');
  
  const images: string[] = [];
  const document = await pdf(pdfPath, { scale: 2.0 }); // Higher scale for better OCR
  
  for await (const page of document) {
    // page is a Buffer containing PNG data
    // Crop to content to remove whitespace/margins
    const croppedBuffer = await cropToContent(page);
    const base64 = croppedBuffer.toString('base64');
    images.push(base64);
  }
  
  return images;
}

/**
 * Extracts data from a field sheet PDF using Agent Swarm.
 * Why: Uses specialized agents for better accuracy:
 *   1. Row Counter Agent - counts total rows first
 *   2. Page Agents - extract in parallel
 *   3. Project Info Verifier - majority vote
 *   4. Readings Verifier - avgSettlement validation (±0.05mm)
 *   5. Row Estimator - insert blank rows for missing data
 */
async function extractFromFieldSheet(pdfPath: string): Promise<ExtractedData> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY not configured. Set it in your environment.');
  }

  // Convert PDF to images
  console.log('   🖼️  Converting PDF to images...');
  const pageImages = await convertPdfToImages(pdfPath);
  console.log(`   📄 Converted ${pageImages.length} pages`);
  
  // Run agent swarm extraction
  const swarmResult = await runAgentSwarm(pageImages, apiKey);
  
  // Transform swarm result to ExtractedData format
  return transformSwarmResultToExtractedData(swarmResult);
}

/**
 * Transforms agent swarm result to ExtractedData format.
 * Why: Converts the rich swarm output to the simpler eval format.
 */
function transformSwarmResultToExtractedData(swarmResult: AgentSwarmResult): ExtractedData {
  // Transform project info
  const projectInfo: ExtractedData['projectInfo'] = {};
  const pi = swarmResult.projectInfo.value;
  if (pi.pileId) projectInfo.pileId = pi.pileId;
  if (pi.reportNo) projectInfo.reportNo = pi.reportNo;
  if (pi.project) projectInfo.project = pi.project;
  if (pi.location) projectInfo.location = pi.location;
  if (pi.client) projectInfo.client = pi.client;
  if (pi.contractor) projectInfo.contractor = pi.contractor;
  if (pi.pileDiameter) projectInfo.pileDiameter = pi.pileDiameter;
  if (pi.pileDepth) projectInfo.pileDepth = pi.pileDepth;
  if (pi.designLoad) projectInfo.designLoad = pi.designLoad;
  if (pi.testLoad) projectInfo.testLoad = pi.testLoad;
  if (pi.ramArea) projectInfo.ramArea = pi.ramArea;
  if (pi.concreteGrade) projectInfo.concreteGrade = pi.concreteGrade;
  if (pi.testDate) projectInfo.testDate = pi.testDate;
  if (pi.dateOfCasting) projectInfo.dateOfCasting = pi.dateOfCasting;
  
  // Transform readings (excluding empty placeholder rows for eval)
  const readings: ExtractedData['readings'] = swarmResult.readings
    .filter(r => !r.isEmpty) // Don't include empty placeholders in eval
    .map(r => ({
      sequence: r.sequence,
      date: r.date,
      time: r.time,
      pressure: r.pressure,
      dg1: r.dg1,
      dg2: r.dg2,
      dg3: r.dg3,
      dg4: r.dg4,
      avgSettlement: r.calculatedAvg,
      extractedAvg: r.extractedAvg,
      confidence: r.confidence,
    }));
  
  // Calculate overall confidence
  const highConfidenceCount = swarmResult.readings.filter(r => r.confidence === 'high').length;
  const overallConfidence = Math.round((highConfidenceCount / swarmResult.readings.length) * 100);
  
  return {
    projectInfo,
    readings,
    confidence: overallConfidence,
    extractedAt: swarmResult.extractedAt,
    model: swarmResult.model,
  };
}

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
  
  // Build a map of extracted readings by sequence number for O(1) lookup
  // Why: Match readings by sequence field, not array index. 
  // This handles cases where extracted readings may be out of order or have gaps.
  const extractedBySequence = new Map<number, ExtractedData['readings'][0]>();
  for (const reading of extracted.readings) {
    if (reading.sequence !== undefined) {
      extractedBySequence.set(reading.sequence, reading);
    }
  }
  
  // Compare readings by matching sequence numbers
  const readingsComparisons = expected.readings.map((expectedReading) => {
    const extractedReading = extractedBySequence.get(expectedReading.sequence) || {};
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
 * 
 * DEFAULT BEHAVIOR: Always runs fresh extraction (tests latest agent code).
 * Use --use-cache flag to skip extraction and use cached results.
 */
export async function runExtractEval(
  reportId: string,
  options: {
    useCache?: boolean;  // If true, uses cached extraction instead of running fresh extraction
    config?: EvalConfig;
    verbose?: boolean;
  } = {}
): Promise<EvalResult> {
  const { useCache = false, config = DEFAULT_EVAL_CONFIG, verbose = true } = options;
  
  if (verbose) {
    console.log(`\n🔍 Running extraction eval for ${reportId}...\n`);
  }
  
  // Load expected data
  const expected = loadExpectedData(reportId);
  if (verbose) {
    console.log(`✅ Loaded expected data: ${expected.readings.length} readings`);
  }
  
  // Check for cached extraction
  let extracted = useCache ? loadExtractedData(reportId) : null;
  
  if (!extracted) {
    // DEFAULT: Always run fresh extraction (tests latest agent code)
    if (verbose) {
      console.log('🤖 Running fresh Vision API extraction...');
      if (useCache) {
        console.log('   ⚠️  --use-cache flag was set but no cached extraction found');
      }
    }
    
    // Find field sheet PDF
    const pdfPath = findFieldSheetPdf(reportId);
    if (!pdfPath) {
      throw new Error(`No field sheet PDF found in training-data/${reportId}/field-sheet/`);
    }
    
    if (verbose) {
      console.log(`   📄 Found field sheet: ${path.basename(pdfPath)}`);
    }
    
    // Call Vision API to extract data
    extracted = await extractFromFieldSheet(pdfPath);
    
    if (verbose) {
      console.log(`   ✅ Extracted ${extracted.readings.length} readings`);
      console.log(`   📊 Confidence: ${extracted.confidence}%`);
    }
    
    saveExtractedData(reportId, extracted);
  } else {
    // Using cached extraction (only if --use-cache flag was explicitly set)
    if (verbose) {
      console.log(`📦 Using cached extraction from ${extracted.extractedAt}`);
      console.log(`   ⚠️  Note: This tests OLD extraction code, not your latest changes!`);
      console.log(`   💡 Remove --use-cache flag to test latest extraction agent`);
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

// =============================================================================
// CLI RUNNER
// =============================================================================

/**
 * CLI entry point for running evals from command line.
 * Why: Allows running evals directly via `npx tsx src/lib/eval/extract-eval.ts report-001`
 * 
 * DEFAULT: Always runs fresh extraction (tests latest agent code)
 * Use --use-cache to skip extraction and use cached results
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx src/lib/eval/extract-eval.ts <report-id> [--use-cache]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/lib/eval/extract-eval.ts report-001');
    console.log('    → Runs FRESH extraction (tests latest agent code)');
    console.log('');
    console.log('  npx tsx src/lib/eval/extract-eval.ts report-001 --use-cache');
    console.log('    → Uses cached extraction (skips API call, faster)');
    console.log('    → ⚠️  Only use this when testing evaluation logic, not extraction');
    process.exit(1);
  }
  
  const reportId = args[0];
  const useCache = args.includes('--use-cache');
  
  if (useCache) {
    console.log('⚠️  --use-cache flag detected: Will use cached extraction (if available)');
    console.log('   This tests OLD extraction code, not your latest changes!\n');
  }
  
  try {
    const result = await runExtractEval(reportId, { useCache });
    
    console.log('\n' + '='.repeat(50));
    if (result.passed) {
      console.log('🎉 PASSED! Target accuracy achieved.');
    } else {
      console.log(`📈 Score: ${result.overallScore}% - Need ${result.passThreshold}% to pass.`);
      console.log('💡 Review failures above and improve extraction prompts.');
    }
    console.log('='.repeat(50) + '\n');
    
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}
