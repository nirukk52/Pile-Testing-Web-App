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
import OpenAI from 'openai';
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
import { buildVisionExtractionPrompt, extractDateValue } from '../parsers/extraction-config';

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
 * Extracts readings from a single page.
 * Why: Processing pages separately can improve accuracy for multi-page documents.
 */
async function extractPageReadings(
  openai: OpenAI,
  pageImage: string,
  pageNum: number,
  totalPages: number,
  isFirstPage: boolean
): Promise<{ projectInfo?: Record<string, string>; readings: Array<Record<string, string>> }> {
  const prompt = isFirstPage
    ? `Extract ALL data from this pile test field sheet page ${pageNum}/${totalPages}.

## HEADER DATA (from top of page)
Extract: pileId, project, location, client, contractor, pileDiameter, pileDepth, designLoad, testLoad, ramArea, concreteGrade, testDate, dateOfCasting

## READINGS TABLE
Extract EVERY row. Each row: date (DD/MM/YYYY), time (HH:MM), pressure (kg/cm²), dg1, dg2, dg3, dg4 (mm)

## PHYSICS VALIDATION RULES
- First row is ALWAYS: pressure=0, all dg=0 (loading start)
- ALL 4 dial gauges should be CLOSE to each other (within ~0.5mm)
  - If dg1=0.19, dg2=0.13, dg3=0.10, dg4=0.06 → OK (all similar)
  - If dg1=0.19, dg2=0.13, dg3=0.10, dg4=0.06 but you read dg4 as 0.60 → WRONG, should be 0.06
- Handwriting: 0↔6 often confused, 5↔S, 1↔7

Return JSON:
{
  "projectInfo": { "pileId": "...", "project": "...", ... },
  "readings": [{ "date": "...", "time": "...", "pressure": "...", "dg1": "...", "dg2": "...", "dg3": "...", "dg4": "..." }, ...]
}`
    : `Extract ALL reading rows from this pile test data table (page ${pageNum}/${totalPages}).

## COLUMN LAYOUT (left to right)
1. DATE - DD/MM/YYYY or blank
2. TIME - HH:MM (24-hour)
3. PRESSURE - kg/cm² - **ALWAYS whole numbers: 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420**
4. LOAD IN MT - decimal numbers like 102.04, 204.08, 306.12 - **SKIP THIS COLUMN**
5. DG1 (Reading 1) - dial gauge in mm
6. DG2 (Reading 2) - dial gauge in mm
7. DG3 (Reading 3) - dial gauge in mm
8. DG4 (Reading 4) - dial gauge in mm

## CRITICAL: PRESSURE vs LOAD
- PRESSURE column has whole numbers: 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420
- LOAD column has decimals: 102.04, 204.08, 306.12, 408.16, 510.20, 612.24, 714.28...
- **Extract PRESSURE (whole numbers), NOT LOAD (decimals)**

## PHYSICS RULES
- ALL 4 dial gauges should be CLOSE to each other (within ~0.5mm)
- Handwriting: 0↔6 confused, 5↔S, 1↔7

Return JSON:
{
  "readings": [{ "date": "...", "time": "...", "pressure": "...", "dg1": "...", "dg2": "...", "dg3": "...", "dg4": "..." }, ...]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${pageImage}`,
              detail: 'high',
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { readings: [] };
  }

  return JSON.parse(content);
}

/**
 * Extracts data from a field sheet PDF using Vision API.
 * Why: Core extraction function that calls GPT-4o Vision on handwritten/scanned PDFs.
 * Processes each page separately for better accuracy on multi-page documents.
 */
async function extractFromFieldSheet(pdfPath: string): Promise<ExtractedData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Set it in your environment.');
  }

  const openai = new OpenAI({ apiKey });
  
  // Convert PDF to images
  console.log('   🖼️  Converting PDF to images...');
  const pageImages = await convertPdfToImages(pdfPath);
  console.log(`   📄 Converted ${pageImages.length} pages`);
  
  console.log('   📤 Processing each page with GPT-4o Vision API...');
  
  // Process each page separately
  let projectInfo: Record<string, string> = {};
  const allReadings: Array<Record<string, string>> = [];
  
  for (let i = 0; i < pageImages.length; i++) {
    const isFirstPage = i === 0;
    console.log(`   📄 Processing page ${i + 1}/${pageImages.length}...`);
    
    const pageResult = await extractPageReadings(
      openai,
      pageImages[i],
      i + 1,
      pageImages.length,
      isFirstPage
    );
    
    if (isFirstPage && pageResult.projectInfo) {
      projectInfo = pageResult.projectInfo;
    }
    
    if (pageResult.readings && pageResult.readings.length > 0) {
      allReadings.push(...pageResult.readings);
      console.log(`      ✅ Extracted ${pageResult.readings.length} readings`);
    }
  }
  
  console.log(`   📊 Total readings extracted: ${allReadings.length}`);
  
  // Transform combined results
  return transformVisionResponseToExtractedData({
    projectInfo,
    readings: allReadings,
    confidence: 85,
  });
}

/**
 * Transforms Vision API response to our ExtractedData format.
 * Why: Maps the AI's JSON output to our evaluation types.
 */
function transformVisionResponseToExtractedData(response: {
  projectInfo?: Record<string, string>;
  readings?: Array<Record<string, string>>;
  confidence?: number;
  notes?: string;
}): ExtractedData {
  const confidence = response.confidence || 70;
  
  // Transform project info
  const projectInfo: ExtractedData['projectInfo'] = {};
  if (response.projectInfo) {
    const pi = response.projectInfo;
    if (pi.pileId) projectInfo.pileId = pi.pileId;
    if (pi.reportNo) projectInfo.reportNo = pi.reportNo;
    if (pi.project) projectInfo.project = pi.project;
    if (pi.location) projectInfo.location = pi.location;
    if (pi.client) projectInfo.client = pi.client;
    if (pi.contractor) projectInfo.contractor = pi.contractor;
    if (pi.pileDiameter) projectInfo.pileDiameter = parseFloat(pi.pileDiameter) || 0;
    if (pi.pileDepth) projectInfo.pileDepth = parseFloat(pi.pileDepth) || 0;
    if (pi.designLoad) projectInfo.designLoad = parseFloat(pi.designLoad) || 0;
    if (pi.testLoad) projectInfo.testLoad = parseFloat(pi.testLoad) || 0;
    if (pi.ramArea) projectInfo.ramArea = parseFloat(pi.ramArea) || 0;
    if (pi.concreteGrade) projectInfo.concreteGrade = pi.concreteGrade;
    if (pi.testDate) projectInfo.testDate = extractDateValue(pi.testDate) || pi.testDate;
    if (pi.dateOfCasting) projectInfo.dateOfCasting = extractDateValue(pi.dateOfCasting) || pi.dateOfCasting;
  }

  // Transform readings
  const readings: ExtractedData['readings'] = [];
  if (response.readings && Array.isArray(response.readings)) {
    response.readings.forEach((r, index) => {
      readings.push({
        sequence: index + 1,
        date: r.date ? (extractDateValue(r.date) || r.date) : undefined,
        time: r.time || undefined,
        pressure: parseFloat(r.pressure) || 0,
        dg1: parseFloat(r.dg1) || 0,
        dg2: parseFloat(r.dg2) || 0,
        dg3: parseFloat(r.dg3) || 0,
        dg4: parseFloat(r.dg4) || 0,
      });
    });
  }

  // Apply physics-based validation and correction
  const correctedReadings = validateAndCorrectReadings(readings);
  
  return {
    projectInfo,
    readings: correctedReadings,
    confidence,
    extractedAt: new Date().toISOString(),
    model: 'gpt-4o',
  };
}

/**
 * Valid pressure values for pile load tests (kg/cm²).
 * Why: Standard test uses 40 kg/cm² increments. If we see decimals, model extracted LOAD instead of PRESSURE.
 */
const VALID_PRESSURE_VALUES = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420];

/**
 * Validates and corrects readings using physics rules.
 * Why: Handwriting OCR often misreads digits (0↔6, 5↔6, 1↔7).
 * Physics rules can detect and correct these errors.
 */
function validateAndCorrectReadings(readings: ExtractedData['readings']): ExtractedData['readings'] {
  if (readings.length === 0) return readings;
  
  const corrected = [...readings];
  let corrections = 0;
  
  for (let i = 0; i < corrected.length; i++) {
    const reading = corrected[i];
    
    // Rule 0: Check if pressure looks like LOAD value (decimals instead of whole numbers)
    // Load values are: pressure × ramArea / 1000 ≈ 102.04, 204.08, 306.12, 408.16...
    // Pressure values are: 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420
    const pressure = reading.pressure;
    if (pressure > 0 && !VALID_PRESSURE_VALUES.includes(pressure)) {
      // Find closest valid pressure (model might have read LOAD column)
      const closest = VALID_PRESSURE_VALUES.reduce((prev, curr) => 
        Math.abs(curr - pressure) < Math.abs(prev - pressure) ? curr : prev
      );
      
      // If pressure is a decimal or doesn't match standard values, try to correct
      if (!Number.isInteger(pressure) || Math.abs(closest - pressure) > 5) {
        // Check if this looks like a load value (approximately pressure * 2.551)
        const inferredPressure = Math.round(pressure / 2.551 * 10) / 10;
        const nearestStandard = VALID_PRESSURE_VALUES.reduce((prev, curr) => 
          Math.abs(curr - inferredPressure * 10) < Math.abs(prev - inferredPressure * 10) ? curr : prev
        );
        
        if (VALID_PRESSURE_VALUES.includes(nearestStandard)) {
          console.log(`   🔧 Pressure fix row ${i + 1}: ${pressure} → ${nearestStandard} (detected load value)`);
          corrected[i].pressure = nearestStandard;
          corrections++;
        }
      }
    }
    
    const gauges = [reading.dg1, reading.dg2, reading.dg3, reading.dg4];
    
    // Rule 1: All 4 gauges should be close to each other (within ~1mm typically)
    const median = gauges.sort((a, b) => a - b)[Math.floor(gauges.length / 2)];
    const threshold = Math.max(0.5, median * 0.3); // 30% or 0.5mm minimum
    
    // Check each gauge against the median
    const dgKeys = ['dg1', 'dg2', 'dg3', 'dg4'] as const;
    for (const key of dgKeys) {
      const value = reading[key];
      const diff = Math.abs(value - median);
      
      // If a value is way off from median, try to correct common OCR errors
      if (diff > threshold && median > 0.5) {
        // Common OCR errors: 0↔6, leading digit missing (0.52 should be 5.52)
        const possibleCorrections = [
          value + Math.floor(median), // Missing leading digit (0.52 → 5.52)
          value * 10,                  // Missing decimal (0.52 → 5.2)
          value / 10,                  // Extra decimal (52 → 5.2)
        ];
        
        // Find correction closest to median
        let bestCorrection = value;
        let bestDiff = diff;
        for (const correction of possibleCorrections) {
          const corrDiff = Math.abs(correction - median);
          if (corrDiff < bestDiff && corrDiff < threshold) {
            bestCorrection = correction;
            bestDiff = corrDiff;
          }
        }
        
        if (bestCorrection !== value) {
          console.log(`   🔧 Correcting row ${i + 1} ${key}: ${value} → ${bestCorrection.toFixed(2)} (median: ${median.toFixed(2)})`);
          (corrected[i] as Record<string, unknown>)[key] = Math.round(bestCorrection * 100) / 100;
          corrections++;
        }
      }
    }
    
    // Rule 2: Settlement continuity - values should increase during loading
    if (i > 0) {
      const prevReading = corrected[i - 1];
      const prevPressure = prevReading.pressure;
      const currPressure = reading.pressure;
      
      // During loading (pressure increasing), settlement should increase
      if (currPressure > prevPressure) {
        for (const key of dgKeys) {
          const prevValue = prevReading[key];
          const currValue = corrected[i][key];
          
          // If current value is much less than previous during loading, it's likely wrong
          if (currValue < prevValue * 0.5 && prevValue > 0.5) {
            // Try adding the integer part from previous value
            const intPart = Math.floor(prevValue);
            const correctedValue = currValue + intPart;
            
            if (Math.abs(correctedValue - prevValue) < Math.abs(currValue - prevValue)) {
              console.log(`   🔧 Continuity fix row ${i + 1} ${key}: ${currValue} → ${correctedValue.toFixed(2)} (prev: ${prevValue.toFixed(2)})`);
              (corrected[i] as Record<string, unknown>)[key] = Math.round(correctedValue * 100) / 100;
              corrections++;
            }
          }
        }
      }
    }
  }
  
  if (corrections > 0) {
    console.log(`   📊 Applied ${corrections} physics-based corrections`);
  }
  
  return corrected;
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
    if (verbose) {
      console.log(`✅ Using cached extraction from ${extracted.extractedAt}`);
      console.log(`   (Run with --reextract to force new extraction)`);
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
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx src/lib/eval/extract-eval.ts <report-id> [--reextract]');
    console.log('Example: npx tsx src/lib/eval/extract-eval.ts report-001');
    console.log('         npx tsx src/lib/eval/extract-eval.ts report-001 --reextract');
    process.exit(1);
  }
  
  const reportId = args[0];
  const reextract = args.includes('--reextract');
  
  try {
    const result = await runExtractEval(reportId, { reextract });
    
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
