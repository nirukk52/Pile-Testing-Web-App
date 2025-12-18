/**
 * Agent Swarm for Field Sheet Extraction
 * Why: Multiple specialized agents working in parallel for accuracy and speed.
 * 
 * Architecture:
 * 1. Row Counter Agent - runs FIRST, counts total data rows
 * 2. Page Agents - extract readings in parallel (one per page)
 * 3. Project Info Verifier - majority vote on project info from all pages
 * 4. Readings Verifier - validates avgSettlement (±0.05mm), sets confidence
 * 5. Row Estimator Agent - estimates positions of missing rows
 */

import OpenAI from 'openai';
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
  expectedRowCount: number;              // From row counter agent
  extractedRowCount: number;             // Actual rows extracted
  missingRowCount: number;               // expectedRowCount - extractedRowCount
  projectInfo: ProjectInfoWithConfidence;
  readings: ExtractedReadingWithConfidence[];
  lowConfidenceCount: number;
  emptyRowCount: number;
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
// AGENT 1: ROW COUNTER
// =============================================================================

/**
 * Row Counter Agent - counts total data rows across all pages.
 * Why: Runs FIRST so we know expected row count before extraction.
 * Simple prompt, just counts lines with data.
 */
async function runRowCounterAgent(
  openai: OpenAI,
  pageImages: string[]
): Promise<number> {
  console.log('   🔢 Row Counter Agent: Counting data rows...');
  
  // Send all pages to count total rows
  const imageContent = pageImages.map(base64 => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/png;base64,${base64}`,
      detail: 'low' as const, // Low detail is fine for counting
    },
  }));
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `Count ONLY data rows in the pile test table across all ${pageImages.length} pages.

A DATA ROW must have:
- TIME column (HH:MM format)
- PRESSURE column (0, 40, 80, 120... kg/cm²)
- 4 DIAL GAUGE readings (numbers in mm)

Do NOT count:
- Header rows (column titles like "TIME", "PRESSURE", "READING 1", etc.)
- Empty rows
- Rows with only signatures
- The same row twice (some tables span pages)

Return JSON: { "totalRows": <number>, "perPage": [<page1>, <page2>, ...] }`,
          },
        ],
      },
    ],
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Row counter agent returned empty response');
  }

  const result = JSON.parse(content);
  console.log(`   🔢 Row Counter Agent: Found ${result.totalRows} data rows (per page: ${JSON.stringify(result.perPage || [])})`);
  return result.totalRows || 0;
}

// =============================================================================
// AGENT 2: PAGE AGENTS (Parallel)
// =============================================================================

/**
 * Page Agent - extracts all data from a single page.
 * Why: Each page processed independently in parallel for speed.
 */
async function runPageAgent(
  openai: OpenAI,
  pageImage: string,
  pageNum: number,
  totalPages: number
): Promise<PageExtractionResult> {
  const isFirstPage = pageNum === 1;
  
  const prompt = isFirstPage
    ? `Extract ALL data from this pile test field sheet page ${pageNum}/${totalPages}.

## HEADER DATA (from top of page)
Extract: pileId, project, location, client, contractor, pileDiameter, pileDepth, designLoad, testLoad, ramArea, concreteGrade, testDate, dateOfCasting

## READINGS TABLE
Extract EVERY row with these columns:
- date, time, pressure (kg/cm² - whole numbers: 0, 40, 80, 120...)
- dg1, dg2, dg3, dg4 (dial gauge readings in mm)
- avg (average settlement column - IMPORTANT for validation)

Return JSON:
{
  "projectInfo": { "pileId": "...", ... },
  "readings": [{ "date": "...", "time": "...", "pressure": "...", "dg1": "...", "dg2": "...", "dg3": "...", "dg4": "...", "avg": "..." }, ...]
}`
    : `Extract ALL reading rows from this pile test data table (page ${pageNum}/${totalPages}).

Extract project info if visible in header area.

## COLUMNS
- date, time, pressure (whole numbers: 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420)
- dg1, dg2, dg3, dg4 (dial gauge readings in mm)
- avg (average settlement - extract this!)

Return JSON:
{
  "projectInfo": { ... } or null,
  "readings": [{ "date": "...", "time": "...", "pressure": "...", "dg1": "...", "dg2": "...", "dg3": "...", "dg4": "...", "avg": "..." }, ...]
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
    return { pageNum, readings: [] };
  }

  const parsed = JSON.parse(content);
  return {
    pageNum,
    projectInfo: parsed.projectInfo || undefined,
    readings: parsed.readings || [],
  };
}

// =============================================================================
// AGENT 3: PROJECT INFO VERIFIER
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
    
    // Set value (convert numbers for numeric fields)
    const numericFields = ['pileDiameter', 'pileDepth', 'designLoad', 'testLoad', 'ramArea'];
    if (numericFields.includes(field)) {
      (finalValues as Record<string, unknown>)[field] = parseFloat(winner) || 0;
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
// AGENT 4: READINGS VERIFIER
// =============================================================================

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
  
  const verified: ExtractedReadingWithConfidence[] = rawReadings.map((r, index) => {
    const dg1 = parseFloat(r.dg1) || 0;
    const dg2 = parseFloat(r.dg2) || 0;
    const dg3 = parseFloat(r.dg3) || 0;
    const dg4 = parseFloat(r.dg4) || 0;
    const pressure = parseFloat(r.pressure) || 0;
    const extractedAvg = r.avg ? parseFloat(r.avg) : undefined;
    
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
      sequence: index + 1,
      date: r.date || undefined,
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
  
  console.log(`   ✅ Readings Verifier: ${lowConfidenceCount} low confidence rows`);
  return verified;
}

// =============================================================================
// AGENT 5: ROW ESTIMATOR
// =============================================================================

/**
 * Row Estimator Agent - estimates positions of missing rows.
 * Why: If row counter says 109 but we only extracted 105, insert 4 blank rows.
 */
function runRowEstimator(
  readings: ExtractedReadingWithConfidence[],
  expectedCount: number
): ExtractedReadingWithConfidence[] {
  const actualCount = readings.length;
  const missingCount = expectedCount - actualCount;
  
  if (missingCount <= 0) {
    return readings;
  }
  
  console.log(`   📍 Row Estimator: Inserting ${missingCount} blank rows...`);
  
  // Strategy: Look for gaps in the sequence (time jumps, pressure jumps)
  const result: ExtractedReadingWithConfidence[] = [];
  let insertedCount = 0;
  
  for (let i = 0; i < readings.length; i++) {
    result.push(readings[i]);
    
    // Check for gaps (if we haven't inserted all missing rows yet)
    if (insertedCount < missingCount && i < readings.length - 1) {
      const curr = readings[i];
      const next = readings[i + 1];
      
      // Detect gap: large pressure difference without expected intermediate values
      // Or time gap that suggests missing readings
      const pressureDiff = Math.abs(next.pressure - curr.pressure);
      const isLargeGap = pressureDiff > 40; // More than one pressure step
      
      if (isLargeGap) {
        // Insert blank row(s) to fill gap
        const rowsToInsert = Math.min(
          Math.floor(pressureDiff / 40) - 1, // Estimated missing rows
          missingCount - insertedCount
        );
        
        for (let j = 0; j < rowsToInsert; j++) {
          const blankRow: ExtractedReadingWithConfidence = {
            sequence: result.length + 1,
            pressure: 0,
            dg1: 0,
            dg2: 0,
            dg3: 0,
            dg4: 0,
            calculatedAvg: 0,
            confidence: 'low',
            fieldConfidence: {
              dg1: 'low',
              dg2: 'low',
              dg3: 'low',
              dg4: 'low',
              pressure: 'low',
            },
            avgDiff: 0,
            isEmpty: true,
          };
          result.push(blankRow);
          insertedCount++;
        }
      }
    }
  }
  
  // If we still haven't inserted enough, add remaining at end
  while (insertedCount < missingCount) {
    const blankRow: ExtractedReadingWithConfidence = {
      sequence: result.length + 1,
      pressure: 0,
      dg1: 0,
      dg2: 0,
      dg3: 0,
      dg4: 0,
      calculatedAvg: 0,
      confidence: 'low',
      fieldConfidence: {
        dg1: 'low',
        dg2: 'low',
        dg3: 'low',
        dg4: 'low',
        pressure: 'low',
      },
      avgDiff: 0,
      isEmpty: true,
    };
    result.push(blankRow);
    insertedCount++;
  }
  
  // Re-sequence
  result.forEach((r, i) => {
    r.sequence = i + 1;
  });
  
  console.log(`   📍 Row Estimator: Inserted ${insertedCount} blank rows`);
  return result;
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
  const openai = new OpenAI({ apiKey });
  
  console.log('\n🤖 AGENT SWARM EXTRACTION');
  console.log('='.repeat(50));
  
  // STEP 1: Row Counter Agent (runs first)
  const expectedRowCount = await runRowCounterAgent(openai, pageImages);
  
  // STEP 2: Page Agents (parallel extraction)
  console.log(`   📄 Running ${pageImages.length} Page Agents in parallel...`);
  const pagePromises = pageImages.map((img, i) =>
    runPageAgent(openai, img, i + 1, pageImages.length)
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
  
  // STEP 3: Project Info Verifier (majority vote)
  const projectInfo = runProjectInfoVerifier(pageResults);
  
  // STEP 4: Readings Verifier (avgSettlement validation)
  const verifiedReadings = runReadingsVerifier(allRawReadings);
  
  // STEP 5: Row Estimator (insert blank rows for missing data)
  const finalReadings = runRowEstimator(verifiedReadings, expectedRowCount);
  
  // Calculate stats
  const lowConfidenceCount = finalReadings.filter(r => r.confidence === 'low').length;
  const emptyRowCount = finalReadings.filter(r => r.isEmpty).length;
  
  console.log('='.repeat(50));
  console.log(`✅ Extraction complete:`);
  console.log(`   Expected rows: ${expectedRowCount}`);
  console.log(`   Extracted rows: ${allRawReadings.length}`);
  console.log(`   Missing rows: ${expectedRowCount - allRawReadings.length}`);
  console.log(`   Low confidence: ${lowConfidenceCount}`);
  console.log(`   Empty placeholders: ${emptyRowCount}`);
  
  return {
    expectedRowCount,
    extractedRowCount: allRawReadings.length,
    missingRowCount: Math.max(0, expectedRowCount - allRawReadings.length),
    projectInfo,
    readings: finalReadings,
    lowConfidenceCount,
    emptyRowCount,
    extractedAt: new Date().toISOString(),
    model: 'gpt-4o (agent swarm)',
  };
}
