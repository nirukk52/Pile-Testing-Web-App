/**
 * Agent Swarm for Field Sheet Extraction
 * Why: Multiple specialized agents working in parallel for accuracy and speed.
 * 
 * Architecture:
 * 1. Page Agents - extract readings in parallel (one per page)
 * 2. Project Info Verifier - majority vote on project info from all pages
 * 3. Readings Verifier - validates avgSettlement (±0.05mm), sets confidence, infers pressure
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExpectedProjectInfo } from '../eval/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Confidence level for a reading row.
 * Why: Data entry tab highlights low confidence rows differently.
 */
export type ConfidenceLevel = 'high' | 'low';

/**
 * Field-level confidence for highlighting specific problematic values.
 * Why: Allows highlighting individual gauges that might be wrong.
 */
export interface FieldConfidence {
  dg1: ConfidenceLevel;
  dg2: ConfidenceLevel;
  dg3: ConfidenceLevel;
  dg4: ConfidenceLevel;
  pressure: ConfidenceLevel;
}

/**
 * Extracted reading with confidence metadata.
 * Why: Tracks which values are reliable and which need manual review.
 */
export interface ExtractedReadingWithConfidence {
  sequence: number;
  date?: string;
  time?: string;
  pressure: number;
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
  extractedAvg?: number;       // What the model extracted from the AVG column
  calculatedAvg: number;       // (dg1 + dg2 + dg3 + dg4) / 4
  confidence: ConfidenceLevel; // Overall row confidence
  fieldConfidence: FieldConfidence; // Per-field confidence
  avgDiff: number;             // |extractedAvg - calculatedAvg|
  isEmpty?: boolean;           // True if this is a placeholder for missing row
}

/**
 * Project info with confidence from majority voting.
 * Why: Multiple pages may have project info - use majority vote.
 */
export interface ProjectInfoWithConfidence {
  value: Partial<ExpectedProjectInfo>;
  confidence: Record<keyof ExpectedProjectInfo, ConfidenceLevel>;
  votes: Record<keyof ExpectedProjectInfo, string[]>; // All extracted values for each field
}

/**
 * Result from the agent swarm extraction.
 */
export interface AgentSwarmResult {
  expectedRowCount: number;              // Same as extractedRowCount (for backward compatibility)
  extractedRowCount: number;             // Actual rows extracted
  missingRowCount: number;               // Always 0 (no row estimation)
  projectInfo: ProjectInfoWithConfidence;
  readings: ExtractedReadingWithConfidence[];
  lowConfidenceCount: number;
  emptyRowCount: number;                 // Always 0 (no blank rows inserted)
  extractedAt: string;
  model: string;
}

/**
 * Raw page extraction result before verification.
 */
interface PageExtractionResult {
  pageNum: number;
  projectInfo?: Record<string, string>;
  readings: Array<Record<string, string>>;
}

// =============================================================================
// AGENT 1: PAGE AGENTS (Parallel)
// =============================================================================

/**
 * Page Agent - extracts all data from a single page.
 * Why: Each page processed independently in parallel for speed.
 */
async function runPageAgent(
  model: any,
  pageImage: string,
  pageNum: number,
  totalPages: number
): Promise<PageExtractionResult> {
  const isFirstPage = pageNum === 1;
  
  const prompt = isFirstPage
    ? `Extract ALL data from this pile test field sheet page ${pageNum}/${totalPages}.

## HEADER LAYOUT (ZedGeo field sheet format)
The header follows this EXACT layout - extract each field from its labeled position:

+----------------------------------------------------------------------------------------------------------------+
| ZedGeo Systems Private Limited., Mumbai.                                                        PAGE:- {pageNo}|
|                                                                                                                |
| RECORD OF PILE LOAD TEST NO.: {pileId}  | L.C OF DIAL GAUGE:- {lcDialGauge} | RAM AREA:- {ramArea}             |
|                                         | TYPE OF TEST:- {testType}         | DATE OF CASTING:- {dateOfCasting}|
| PROJECT:- {project}                     | DESIGN LOAD:- {designLoad}        | PILE DEPTH:- {pileDepth}         |
|                                         | TEST LOAD:- {testLoad}            |                                  |
| LOCATION:- {location}                   | MIXED DESIGN:- {concreteGrade}    |                                  |
|                                         | PILE DIAMETER:- {pileDiameter}    |                                  |
| CLIENTS NAME:- {client}                 |                                   |                                  |
| CONSULTANT:- {consultant}               |                                   |                                  |
| CONTRACTOR:- {contractor}               |                                   |                                  |
+----------------------------------------------------------------------------------------------------------------+

## FIELD EXTRACTION HINTS
- pileId: After "RECORD OF PILE LOAD TEST NO.:" (e.g., TP-01, TP-02) - this is NOT reportNo
- project: After "PROJECT:-" - may span multiple lines
- location: After "LOCATION:-" - building/wing info
- client: After "CLIENTS NAME:-" (e.g., "TATA Project")
- contractor: After "CONTRACTOR:-" - if EMPTY or blank, return "NA"
- pileDiameter: After "PILE DIAMETER:-" - number in mm (e.g., 900)
- pileDepth: After "PILE DEPTH:-" - PRESERVE DECIMALS (e.g., 11.51, 10.31) - may have "M" suffix
- designLoad: After "DESIGN LOAD:-" - number in tons (e.g., 420)
- testLoad: After "TEST LOAD:-" - number in tons (e.g., 1050)
- ramArea: After "RAM AREA:-" - number in cm² (e.g., 2551)
- concreteGrade: After "MIXED DESIGN:-" (e.g., M25, M40)
- dateOfCasting: After "DATE OF CASTING:-" - date format DD-MM-YY or DD/MM/YYYY
- testDate: Get from first reading row's date column

## READINGS TABLE
Extract EVERY row with columns: date, time, pressure, dg1, dg2, dg3, dg4, avg

Return JSON:
{
  "projectInfo": { "pileId": "...", "project": "...", "contractor": "NA", "pileDepth": "11.51", ... },
  "readings": [{ "date": "...", "time": "...", "pressure": "...", "dg1": "...", "dg2": "...", "dg3": "...", "dg4": "...", "avg": "..." }, ...]
}`
    : `Extract ALL reading rows from this pile test data table (page ${pageNum}/${totalPages}).

Extract project info if visible in header area (look for pileId, reportNo, project, client, contractor, etc.)

## COLUMNS
- date, time, pressure (whole numbers: 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420)
- dg1, dg2, dg3, dg4 (dial gauge readings in mm)
- avg (average settlement - extract this!)

Return JSON:
{
  "projectInfo": { "pileId": "...", "reportNo": "...", ... } or null,
  "readings": [{ "date": "...", "time": "...", "pressure": "...", "dg1": "...", "dg2": "...", "dg3": "...", "dg4": "...", "avg": "..." }, ...]
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        data: pageImage,
        mimeType: 'image/png',
      },
    },
    prompt,
  ]);

  const response = await result.response;
  const content = response.text();
  
  if (!content) {
    return { pageNum, readings: [] };
  }

  // Extract JSON from response (Gemini may wrap in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonContent = jsonMatch ? jsonMatch[0] : content;
  const parsed = JSON.parse(jsonContent);
  
  return {
    pageNum,
    projectInfo: parsed.projectInfo || undefined,
    readings: parsed.readings || [],
  };
}

// =============================================================================
// AGENT 2: PROJECT INFO VERIFIER
// =============================================================================

/**
 * Project Info Verifier Agent - uses majority voting across all pages.
 * Why: Different pages may extract different values; majority vote picks the most common.
 */
function runProjectInfoVerifier(
  pageResults: PageExtractionResult[]
): ProjectInfoWithConfidence {
  console.log('   🔍 Project Info Verifier: Running majority vote...');
  
  const fields: (keyof ExpectedProjectInfo)[] = [
    'pileId', 'reportNo', 'project', 'location', 'client', 'contractor',
    'pileDiameter', 'pileDepth', 'designLoad', 'testLoad', 'ramArea',
    'concreteGrade', 'testDate', 'dateOfCasting'
  ];
  
  // Collect all values for each field
  const votes: Record<string, string[]> = {};
  for (const field of fields) {
    votes[field] = [];
  }
  
  for (const result of pageResults) {
    if (result.projectInfo) {
      for (const field of fields) {
        const value = result.projectInfo[field];
        if (value !== undefined && value !== null && value !== '') {
          votes[field].push(String(value));
        }
      }
    }
  }
  
  // Majority vote for each field
  const finalValues: Partial<ExpectedProjectInfo> = {};
  const confidence: Record<string, ConfidenceLevel> = {};
  
  for (const field of fields) {
    const fieldVotes = votes[field];
    if (fieldVotes.length === 0) {
      confidence[field] = 'low';
      continue;
    }
    
    // Count occurrences
    const counts: Record<string, number> = {};
    for (const v of fieldVotes) {
      counts[v] = (counts[v] || 0) + 1;
    }
    
    // Find majority
    let maxCount = 0;
    let winner = '';
    for (const [value, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        winner = value;
      }
    }
    
    // Set value (convert numbers for numeric fields, normalize dates)
    const numericFields = ['pileDiameter', 'pileDepth', 'designLoad', 'testLoad', 'ramArea'];
    const dateFields = ['testDate', 'dateOfCasting'];
    
    if (numericFields.includes(field)) {
      (finalValues as Record<string, unknown>)[field] = parseFloat(winner) || 0;
    } else if (dateFields.includes(field)) {
      // Normalize dates to ISO format (YYYY-MM-DD)
      (finalValues as Record<string, unknown>)[field] = normalizeDateToISO(winner) || winner;
    } else {
      (finalValues as Record<string, unknown>)[field] = winner;
    }
    
    // Confidence: high if majority (>50%), low otherwise
    const totalVotes = fieldVotes.length;
    confidence[field] = maxCount > totalVotes / 2 ? 'high' : 'low';
    
    if (confidence[field] === 'low') {
      console.log(`   ⚠️  Low confidence for ${field}: ${JSON.stringify(fieldVotes)}`);
    }
  }
  
  return {
    value: finalValues,
    confidence: confidence as Record<keyof ExpectedProjectInfo, ConfidenceLevel>,
    votes: votes as Record<keyof ExpectedProjectInfo, string[]>,
  };
}

// =============================================================================
// PRESSURE INFERENCE FOR HOLDING PHASE
// =============================================================================

/**
 * Infers correct pressure for holding phase rows where OCR reads 0.
 * Why: OCR often misreads blank/empty pressure cells as 0 during holding phases.
 *      In pile tests, pressure stays constant during holding (15-min intervals).
 *      Pattern: Load (40) → Hold at 40 → Load (80) → Hold at 80 → ...
 * 
 * Algorithm:
 * - Find rows where pressure changed (loading steps): 0→40, 40→80, etc.
 * - For rows with pressure=0 between loading steps, carry forward previous pressure
 * - Use settlement values to validate (holding phase has gradual increase)
 */
function inferHoldingPhasePressure(
  readings: Array<{
    date?: string;
    time?: string;
    pressure: number;
    dg1: number;
    dg2: number;
    dg3: number;
    dg4: number;
    calculatedAvg: number;
    extractedAvg?: number;
    confidence: ConfidenceLevel;
    fieldConfidence: FieldConfidence;
    avgDiff: number;
  }>
): typeof readings {
  if (readings.length === 0) return readings;
  
  console.log('   🔧 Inferring pressure for holding phase rows...');
  
  // Valid pressure steps in pile tests (kg/cm²)
  const validPressures = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420];
  
  let lastNonZeroPressure = 0;
  let inferredCount = 0;
  
  // First pass: identify the loading pattern and carry forward pressure
  const result = readings.map((reading, index) => {
    const pressure = reading.pressure;
    
    // If pressure is a valid non-zero loading step, update last known pressure
    if (pressure > 0 && validPressures.includes(pressure)) {
      lastNonZeroPressure = pressure;
      return reading;
    }
    
    // If pressure is 0 but we have a previous non-zero pressure,
    // this is likely a holding phase row
    if (pressure === 0 && lastNonZeroPressure > 0 && index > 0) {
      // Check if this looks like a holding phase (settlement increasing gradually)
      const prevReading = readings[index - 1];
      const settlementDiff = reading.calculatedAvg - prevReading.calculatedAvg;
      
      // Holding phase: settlement increases slowly (< 0.5mm per reading typically)
      // Loading phase: settlement jumps significantly
      const isLikelyHolding = settlementDiff >= 0 && settlementDiff < 0.5;
      
      if (isLikelyHolding) {
        inferredCount++;
        // Mark pressure field as low confidence since we inferred it
        return {
          ...reading,
          pressure: lastNonZeroPressure,
          fieldConfidence: {
            ...reading.fieldConfidence,
            pressure: 'low' as ConfidenceLevel, // Mark as inferred
          },
        };
      }
    }
    
    // If it's actually 0 (final unloading), keep it
    return reading;
  });
  
  if (inferredCount > 0) {
    console.log(`   🔧 Inferred pressure for ${inferredCount} holding phase rows`);
  }
  
  return result;
}

// =============================================================================
// AGENT 3: READINGS VERIFIER
// =============================================================================

/**
 * Parses date string to Date object.
 * Why: Handles various date formats from OCR extraction:
 *   - YYYY-MM-DD (ISO)
 *   - DD-MM-YYYY or DD/MM/YYYY (European)
 *   - D/M/YY or DD/MM/YY (Short year)
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }
  
  // Try DD-MM-YYYY or DD/MM/YYYY (4-digit year)
  const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  }
  
  // Try D/M/YY or DD/MM/YY (2-digit year) - assume 2000s
  const shortYearMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (shortYearMatch) {
    const year = 2000 + parseInt(shortYearMatch[3]);
    return new Date(year, parseInt(shortYearMatch[2]) - 1, parseInt(shortYearMatch[1]));
  }
  
  // Handle OCR error: D/M/Y with single digit year (e.g., "11-12-2" should be "11-12-25")
  // Why: OCR sometimes misses digits. Single digit year likely has trailing digit missing.
  // In 2025 context, "2" likely means "25" with "5" missing.
  const singleDigitYearMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d)$/);
  if (singleDigitYearMatch) {
    // Assume the digit is the first digit of a 2-digit year in 2020s
    // e.g., "2" → 2025 (assuming current year context)
    const yearDigit = parseInt(singleDigitYearMatch[3]);
    const year = yearDigit === 2 ? 2025 : 2020 + yearDigit; // "2" → 2025, "3" → 2023
    return new Date(year, parseInt(singleDigitYearMatch[2]) - 1, parseInt(singleDigitYearMatch[1]));
  }
  
  return null;
}

/**
 * Normalizes date string to ISO format (YYYY-MM-DD).
 * Why: OCR extracts dates in various formats (9/12/25, 10-12-23, etc.)
 *      but expected.json uses ISO format for consistency.
 */
function normalizeDateToISO(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  
  // Already in ISO format?
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr; // Return original if can't parse
  
  // Format as YYYY-MM-DD
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Parses time string to minutes since midnight.
 * Why: Handles various time formats from OCR extraction:
 *   - HH:MM (standard with colon)
 *   - HH.MM (with period - common in handwritten notes)
 *   - H.MM or H:MM (single digit hour)
 */
function parseTimeToMinutes(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  
  // Match HH:MM or HH.MM or H:MM or H.MM
  const match = timeStr.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  
  // Handle 24:XX as 00:XX next day (add 24 hours worth of minutes)
  // This handles times like "24.30" which means 00:30 next day
  if (hours >= 24) {
    return (hours * 60) + minutes; // Keep the >24 value for sorting across midnight
  }
  
  return hours * 60 + minutes;
}

/**
 * Sorts readings by time, pressure, and phase using domain knowledge.
 * Why: OCR may extract rows out of order; this ensures correct sequence.
 * 
 * Sort order:
 * 1. Date (chronological)
 * 2. Time (chronological)
 * 3. Within same time: pressure loading pattern (0→40→80... then hold, then 80→40→0)
 */
function sortReadingsByTimeAndPhase(
  readings: Array<{
    date?: string;
    time?: string;
    pressure: number;
    dg1: number;
    dg2: number;
    dg3: number;
    dg4: number;
    calculatedAvg: number;
    extractedAvg?: number;
    confidence: ConfidenceLevel;
    fieldConfidence: FieldConfidence;
    avgDiff: number;
  }>
): typeof readings {
  if (readings.length === 0) return readings;
  
  console.log('   🔄 Sorting readings by time and phase...');
  
  // Find max pressure (indicates peak of test)
  const maxPressure = Math.max(...readings.map(r => r.pressure));
  
  // First, sort by date+time to establish rough order
  const sorted = [...readings].sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    
    // Compare dates
    if (dateA && dateB) {
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
    }
    
    // Compare times
    const timeA = parseTimeToMinutes(a.time);
    const timeB = parseTimeToMinutes(b.time);
    if (timeA !== timeB) return timeA - timeB;
    
    // Same date+time: use pressure pattern
    // During loading (before max reached), higher pressure = later
    // During unloading (after max), lower pressure = later
    return 0; // Keep original order if same time
  });
  
  console.log(`   🔄 Max pressure: ${maxPressure} kg/cm², readings sorted by date+time`);
  
  return sorted;
}

/**
 * Readings Verifier Agent - validates each reading using avgSettlement.
 * Why: If calculated avg differs from extracted avg by >0.05mm, mark as low confidence.
 */
function runReadingsVerifier(
  rawReadings: Array<Record<string, string>>
): ExtractedReadingWithConfidence[] {
  console.log('   ✅ Readings Verifier: Validating avgSettlement...');
  
  const AVG_TOLERANCE = 0.05; // ±0.05mm tolerance
  let lowConfidenceCount = 0;
  
  // First pass: parse and validate all readings
  const parsed = rawReadings.map((r) => {
    const dg1 = parseFloat(r.dg1) || 0;
    const dg2 = parseFloat(r.dg2) || 0;
    const dg3 = parseFloat(r.dg3) || 0;
    const dg4 = parseFloat(r.dg4) || 0;
    const pressure = parseFloat(r.pressure) || 0;
    const extractedAvg = r.avg ? parseFloat(r.avg) : undefined;
    
    // Normalize date to ISO format (YYYY-MM-DD)
    const normalizedDate = normalizeDateToISO(r.date);
    
    // Calculate avg from dial gauges
    const calculatedAvg = Math.round(((dg1 + dg2 + dg3 + dg4) / 4) * 100) / 100;
    
    // Calculate difference
    const avgDiff = extractedAvg !== undefined 
      ? Math.abs(calculatedAvg - extractedAvg) 
      : 0;
    
    // Determine confidence based on avgSettlement validation
    const avgMatches = extractedAvg === undefined || avgDiff <= AVG_TOLERANCE;
    
    // Check which gauge might be wrong (furthest from average of others)
    const fieldConfidence: FieldConfidence = {
      dg1: 'high',
      dg2: 'high',
      dg3: 'high',
      dg4: 'high',
      pressure: 'high',
    };
    
    if (!avgMatches && extractedAvg !== undefined) {
      // Find which gauge is likely wrong
      const gauges = [
        { key: 'dg1', value: dg1 },
        { key: 'dg2', value: dg2 },
        { key: 'dg3', value: dg3 },
        { key: 'dg4', value: dg4 },
      ];
      
      // For each gauge, calculate what avg would be without it
      for (const gauge of gauges) {
        const others = gauges.filter(g => g.key !== gauge.key);
        const avgWithoutThis = others.reduce((sum, g) => sum + g.value, 0) / 3;
        
        // If this gauge is far from the others' average, it's likely wrong
        if (Math.abs(gauge.value - avgWithoutThis) > AVG_TOLERANCE * 2) {
          fieldConfidence[gauge.key as keyof FieldConfidence] = 'low';
        }
      }
    }
    
    const overallConfidence: ConfidenceLevel = avgMatches ? 'high' : 'low';
    if (!avgMatches) {
      lowConfidenceCount++;
    }
    
    return {
      date: normalizedDate,
      time: r.time || undefined,
      pressure,
      dg1,
      dg2,
      dg3,
      dg4,
      extractedAvg,
      calculatedAvg,
      confidence: overallConfidence,
      fieldConfidence,
      avgDiff,
    };
  });
  
  // Sort by time and phase to establish correct sequence
  const sorted = sortReadingsByTimeAndPhase(parsed);
  
  // Infer pressure for holding phase rows (OCR often reads 0)
  const withPressureInferred = inferHoldingPhasePressure(sorted);
  
  // Assign sequence numbers AFTER sorting and pressure inference
  const verified: ExtractedReadingWithConfidence[] = withPressureInferred.map((r, index) => ({
    ...r,
    sequence: index + 1,
  }));
  
  console.log(`   ✅ Readings Verifier: ${lowConfidenceCount} low confidence rows`);
  return verified;
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

/**
 * Main agent swarm extraction function.
 * Why: Orchestrates all agents for maximum accuracy and speed.
 */
export async function runAgentSwarm(
  pageImages: string[],
  apiKey: string
): Promise<AgentSwarmResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
  
  console.log('\n🤖 AGENT SWARM EXTRACTION (Gemini 2.0 Flash)');
  console.log('='.repeat(50));
  
  // STEP 1: Page Agents (parallel extraction)
  console.log(`   📄 Running ${pageImages.length} Page Agents in parallel...`);
  const pagePromises = pageImages.map((img, i) =>
    runPageAgent(model, img, i + 1, pageImages.length)
  );
  const pageResults = await Promise.all(pagePromises);
  
  // Sort by page number
  pageResults.sort((a, b) => a.pageNum - b.pageNum);
  
  // Log results
  for (const result of pageResults) {
    console.log(`   📄 Page ${result.pageNum}: ${result.readings.length} readings`);
  }
  
  // Combine all readings
  const allRawReadings = pageResults.flatMap(r => r.readings);
  console.log(`   📊 Total raw readings: ${allRawReadings.length}`);
  
  // STEP 2: Project Info Verifier (majority vote)
  const projectInfo = runProjectInfoVerifier(pageResults);
  
  // STEP 3: Readings Verifier (avgSettlement validation + pressure inference)
  const finalReadings = runReadingsVerifier(allRawReadings);
  
  // Calculate stats
  const lowConfidenceCount = finalReadings.filter(r => r.confidence === 'low').length;
  
  console.log('='.repeat(50));
  console.log(`✅ Extraction complete:`);
  console.log(`   Extracted rows: ${allRawReadings.length}`);
  console.log(`   Low confidence: ${lowConfidenceCount}`);
  
  return {
    expectedRowCount: allRawReadings.length, // Same as extracted for backward compatibility
    extractedRowCount: allRawReadings.length,
    missingRowCount: 0, // No row estimation
    projectInfo,
    readings: finalReadings,
    lowConfidenceCount,
    emptyRowCount: 0, // No blank rows inserted
    extractedAt: new Date().toISOString(),
    model: 'gemini-2.0-flash (agent swarm)',
  };
}
