/**
 * Agent Swarm for Field Sheet Extraction (v2 - Two Agent Architecture)
 * Why: Two specialized agents running in parallel for accuracy and speed.
 * 
 * Architecture:
 * 1. Project Info Agent - extracts header data from all pages
 * 2. Readings Agent - extracts all readings from all pages sequentially
 * 
 * Both agents receive ALL pages together to maintain context.
 * Model: Gemini 2.5 Pro for accuracy and higher output limits
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
  phase?: 'loading' | 'holding' | 'unloading'; // Test phase
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

// =============================================================================
// PROMPTS
// =============================================================================

/**
 * Project Info Agent Prompt
 * Why: Focused solely on extracting header metadata from all pages.
 */
const PROJECT_INFO_PROMPT = `You are an expert Geotechnical Engineer extracting project metadata from pile load test field sheets.

## TASK
Extract project information from the header section of these field sheet pages. The header is typically on Page 1 but may appear on other pages too.

## HEADER LAYOUT (ZedGeo field sheet format)
The header follows this EXACT layout - extract each field from its labeled position:

+----------------------------------------------------------------------------------------------------------------+
| ZedGeo Systems Private Limited., Mumbai.                                                        PAGE:- {pageNo}|
|                                                                                                                |
| RECORD OF PILE LOAD TEST NO.: {pileId}  | L.C OF DIAL GAUGE:- {lcDialGauge} | RAM AREA:- {ramArea} cm²        |
|                                         | TYPE OF TEST:- {testType}         | DATE OF CASTING:- {dateOfCasting}|
| PROJECT:- {project}                     | DESIGN LOAD:- {designLoad} T      | PILE DEPTH:- {pileDepth} M       |
|                                         | TEST LOAD:- {testLoad} T          |                                  |
| LOCATION:- {location}                   | MIXED DESIGN:- {concreteGrade}    |                                  |
|                                         | PILE DIAMETER:- {pileDiameter} mm |                                  |
| CLIENTS NAME:- {client}                 |                                   |                                  |
| CONSULTANT:- {consultant}               |                                   |                                  |
| CONTRACTOR:- {contractor}               |                                   |                                  |
+----------------------------------------------------------------------------------------------------------------+

## FIELD EXTRACTION RULES
- pileId: After "RECORD OF PILE LOAD TEST NO.:" (e.g., TP-01, TP-02) - NOT the same as reportNo
- project: After "PROJECT:-" - may span multiple lines
- location: After "LOCATION:-" - building/wing info
- client: After "CLIENTS NAME:-" (e.g., "TATA Project")
- contractor: After "CONTRACTOR:-" - if EMPTY or blank, return "NA"
- consultant: After "CONSULTANT:-" - if EMPTY or blank, return "NA"
- pileDiameter: After "PILE DIAMETER:-" - number only in mm (e.g., 900)
- pileDepth: After "PILE DEPTH:-" - PRESERVE DECIMALS (e.g., 11.51, 10.31) - may have "M" suffix
- designLoad: After "DESIGN LOAD:-" - number only in tons (e.g., 420)
- testLoad: After "TEST LOAD:-" - number only in tons (e.g., 1050)
- ramArea: After "RAM AREA:-" - number only in cm² (e.g., 2551)
- concreteGrade: After "MIXED DESIGN:-" (e.g., M25, M40) - just the grade code
- dateOfCasting: After "DATE OF CASTING:-" - convert to YYYY-MM-DD format
- testDate: Get from the DATE column of the FIRST reading row (0 pressure row)
- testType: After "TYPE OF TEST:-" (e.g., IVPLT, RVPLT, Lateral, Uplift)
- lcDialGauge: After "L.C OF DIAL GAUGE:-" (e.g., 0.01 mm)

## DATE FORMAT RULES
- Input may be: DD-MM-YY, DD/MM/YY, D/M/YY, DD-MM-YYYY
- Output MUST be: YYYY-MM-DD (ISO format)
- Example: "11-9-25" → "2025-09-11" (11 Sept 2025)
- Example: "9/12/25" → "2025-12-09" (9 Dec 2025)

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown):
{
  "pileId": "TP-01",
  "reportNo": null,
  "project": "BDD CHAWLS Redevelopment Project, Worli Mumbai",
  "location": "Building-3 Wing-",
  "client": "TATA Project",
  "contractor": "NA",
  "consultant": "NA",
  "pileDiameter": 900,
  "pileDepth": 11.51,
  "designLoad": 420,
  "testLoad": 1050,
  "ramArea": 2551,
  "concreteGrade": "M40",
  "testDate": "2025-12-09",
  "dateOfCasting": "2025-09-11",
  "testType": "IVPLT",
  "lcDialGauge": "0.01"
}

Extract data from ALL provided pages and cross-verify. If values differ between pages, use the most complete/legible one.`;

/**
 * Readings Agent Prompt
 * Why: Focused solely on extracting readings with physics-aware validation.
 */
const READINGS_PROMPT = `You are an expert Geotechnical Engineer extracting pile load test readings from handwritten field sheets.

## TASK
Extract ALL readings from these field sheet pages into a single sequential list. The readings span multiple pages and must be combined in chronological order.

## TABLE COLUMNS (left to right)
| Column | Description | Examples |
|--------|-------------|----------|
| DATE | Date in DD/MM/YY format | 9/12/25, 10/12/25 |
| TIME | Time in HH:MM 24-hour format | 11:29, 14:30 |
| PRESSURE | Gauge reading in kg/cm² | 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420 |
| LOAD IN MT | Calculated load (skip - we calculate from pressure) | |
| Reading 1-4 | Dial gauge readings in mm (DG1, DG2, DG3, DG4) | 0, 0.12, 1.35, 5.45 |
| Average | Average settlement (extract for validation) | 0, 0.06, 1.30 |
| REMARK | May indicate *Loading*, *Holding*, *Unloading* | |

## PHYSICS RULES FOR VALIDATION (Use these to detect and correct OCR errors!)

### 1. TEST PHASES - Detected by pressure pattern
- **LOADING**: Pressure INCREASES (0→40→80→120→160→200→240→280→320→360→400→420)
  - First reading is ALWAYS pressure=0 with all dial gauges at 0 or near 0
  - Each pressure step has ~5 readings before stepping up
- **HOLDING**: Pressure STAYS SAME at maximum for extended time (usually 24 hours)
  - Many readings at the same high pressure (e.g., 420)
- **UNLOADING**: Pressure DECREASES (420→360→320→280→240→200→160→120→80→40→0)
  - Settlement decreases (rebound)

### 2. TIME CONTINUITY (Critical!)
- Time ALWAYS moves forward
- Typical intervals: 15 minutes during loading, may be hourly during holding
- If you see "10:30", "10:45", "19:00" → the "19:00" is likely "11:00" (OCR error with 1→9)
- If time jumps backwards, it's an OCR error - correct it logically

### 3. SETTLEMENT CONTINUITY
- **During LOADING**: Dial gauge values INCREASE as pressure increases
- **During HOLDING**: Settlement increases VERY SLOWLY (creep, ~0.01-0.05mm per reading)
- **During UNLOADING**: Settlement DECREASES (rebound)
- **ALL 4 GAUGES should be CLOSE** (within ~0.5mm typically)
  - If dg1=5.45, dg2=5.52, dg3=5.38, dg4=5.41 → makes sense
  - If dg1=5.45, dg2=0.52, dg3=5.38, dg4=5.41 → dg2 is WRONG (likely 5.52, leading 0→5 error)

### 4. DIGIT DISAMBIGUATION (Common OCR errors)
- "0" often misread as "6", "C", or "-"
- "5" often misread as "S" or "6"
- "1" often misread as "7", "|", or "9"
- "8" often misread as "3"
- A dash "-" in dial gauge means 0.00 (only valid for first reading)

### 5. EXAMPLE: Using physics to correct errors
Row 10: pressure=160, dg1=1.32, dg2=1.20, dg3=1.27, dg4=1.25 (avg ~1.26)
Row 11: pressure=160, dg1=1.34, dg2=1.24, dg3=1.30, dg4=1.28 (avg ~1.29)
Row 12: pressure=160, dg1=1.35, dg2=1.26, dg3=0.35, dg4=1.27 ← dg3=0.35 is WRONG!
  → Should be 1.35 (all other values ~1.3, and 0→1 is common OCR error)

## DATE FORMAT RULES
- Output dates in YYYY-MM-DD format
- "9/12/25" → "2025-12-09" (9 December 2025)
- If date is same as previous row, you can copy it

## PHASE DETECTION
Infer phase from pressure pattern:
- If pressure > previous pressure → "loading"
- If pressure == previous pressure → "holding"  
- If pressure < previous pressure → "unloading"

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown):
{
  "readings": [
    {
      "date": "2025-12-09",
      "time": "11:29",
      "pressure": 0,
      "dg1": 0,
      "dg2": 0,
      "dg3": 0,
      "dg4": 0,
      "avg": 0,
      "phase": "loading",
      "remark": null
    },
    {
      "date": "2025-12-09",
      "time": "11:30",
      "pressure": 40,
      "dg1": 0.12,
      "dg2": 0.06,
      "dg3": 0.04,
      "dg4": 0.02,
      "avg": 0.06,
      "phase": "loading",
      "remark": null
    }
  ]
}

## CRITICAL REQUIREMENTS
1. Extract EVERY reading row from ALL pages (typically 100-150 readings total)
2. Maintain strict chronological order across pages
3. Use physics rules to validate and correct obvious OCR errors
4. Times MUST be in HH:MM format (e.g., "11:29", NOT "1129" or "20130")
5. Pressure values should be standard steps: 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 420`;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Normalizes date string to ISO format (YYYY-MM-DD).
 * Why: Handles various date formats from OCR extraction.
 */
function normalizeDateToISO(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  
  // Already in ISO format?
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try DD-MM-YYYY or DD/MM/YYYY (4-digit year)
  const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    return `${dmyMatch[3]}-${month}-${day}`;
  }
  
  // Try D/M/YY or DD/MM/YY (2-digit year) - assume 2000s
  const shortYearMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (shortYearMatch) {
    const day = shortYearMatch[1].padStart(2, '0');
    const month = shortYearMatch[2].padStart(2, '0');
    const year = 2000 + parseInt(shortYearMatch[3]);
    return `${year}-${month}-${day}`;
  }
  
  return dateStr; // Return original if can't parse
}

/**
 * Repairs truncated JSON by closing unclosed brackets/braces.
 * Why: LLMs sometimes return truncated responses that are 99% valid JSON.
 */
function repairTruncatedJson(text: string): string | null {
  // Strip any markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  
  // Find the first '{' to handle any preamble text
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;
  cleaned = cleaned.slice(firstBrace);
  
  // Count unclosed brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;
  
  for (const char of cleaned) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') openBraces++;
    else if (char === '}') openBraces--;
    else if (char === '[') openBrackets++;
    else if (char === ']') openBrackets--;
  }
  
  // If already balanced, return as-is
  if (openBraces === 0 && openBrackets === 0) {
    return cleaned;
  }
  
  console.log(`   🔧 Attempting JSON repair: ${openBraces} unclosed braces, ${openBrackets} unclosed brackets`);
  
  // Try to close unclosed structures
  let repaired = cleaned.trimEnd();
  
  // If ends with an incomplete string, try to close it
  if (inString) {
    // Find the last complete value and truncate there
    const lastCompleteComma = repaired.lastIndexOf('},');
    if (lastCompleteComma > repaired.length - 200) { // If within last 200 chars
      repaired = repaired.substring(0, lastCompleteComma + 1);
      // Recount after truncation
      openBraces = 0;
      openBrackets = 0;
      inString = false;
      for (const char of repaired) {
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    }
  }
  
  // Remove trailing incomplete key-value
  if (repaired.trimEnd().endsWith(':')) {
    repaired += 'null';
  } else if (repaired.trimEnd().endsWith(',')) {
    repaired = repaired.trimEnd().slice(0, -1); // Remove trailing comma
  }
  
  // Add closing brackets and braces
  repaired += ']'.repeat(Math.max(0, openBrackets));
  repaired += '}'.repeat(Math.max(0, openBraces));
  
  return repaired;
}

/**
 * Validates and normalizes time format.
 * Why: Ensures time is in HH:MM format, corrects common OCR errors.
 */
function normalizeTime(timeStr: string | undefined): string | undefined {
  if (!timeStr) return undefined;
  
  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  // Handle HH.MM format (period instead of colon)
  if (/^\d{1,2}\.\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split('.');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  // Handle HHMM format (no separator) - only if 4 digits
  if (/^\d{4}$/.test(timeStr)) {
    const h = timeStr.substring(0, 2);
    const m = timeStr.substring(2, 4);
    const hour = parseInt(h);
    const min = parseInt(m);
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      return `${h}:${m}`;
    }
  }
  
  return undefined; // Invalid format
}

// =============================================================================
// AGENT 1: PROJECT INFO AGENT
// =============================================================================

/**
 * Detects MIME type from base64 image data.
 * Why: Gemini supports multiple formats (PNG, JPEG, WEBP, HEIC, HEIF) - detect instead of assuming.
 */
function detectImageMimeType(base64Data: string): string {
  // Check magic bytes to detect format
  const buffer = Buffer.from(base64Data, 'base64');
  const header = buffer.subarray(0, 12);
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return 'image/jpeg';
  }
  // WEBP: RIFF...WEBP
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    const webpCheck = buffer.subarray(8, 12);
    if (webpCheck.toString() === 'WEBP') {
      return 'image/webp';
    }
  }
  
  // Default to PNG (most common from pdf-to-img)
  return 'image/png';
}

/**
 * Project Info Agent - extracts header metadata from all pages.
 * Why: Gets all pages together to cross-verify project info.
 */
async function runProjectInfoAgent(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  pageImages: string[]
): Promise<Partial<ExpectedProjectInfo>> {
  console.log('   📋 Project Info Agent: Processing all pages...');
  
  // Check file limit (Gemini 2.5 Pro supports max 3,600 images)
  if (pageImages.length > 3600) {
    throw new Error(`Too many pages: ${pageImages.length}. Maximum is 3,600 images per request.`);
  }
  
  const imageParts = pageImages.map((img) => ({
    inlineData: {
      data: img,
      mimeType: detectImageMimeType(img),
    },
  }));

  const result = await model.generateContent([
    ...imageParts,
    PROJECT_INFO_PROMPT,
  ]);

  const response = await result.response;
  const content = response.text();
  
  if (!content) {
    console.log('   ❌ Project Info Agent: No response');
    return {};
  }

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonContent = jsonMatch ? jsonMatch[0] : content;
  
  try {
    const parsed = JSON.parse(jsonContent);
    console.log(`   ✅ Project Info Agent: Extracted ${Object.keys(parsed).length} fields`);
    return parsed;
  } catch (e) {
    console.log('   ❌ Project Info Agent: JSON parse error');
    return {};
  }
}

// =============================================================================
// AGENT 2: READINGS AGENT
// =============================================================================

/**
 * Raw reading from the Readings Agent.
 */
interface RawReading {
  date?: string;
  time?: string;
  pressure: number;
  dg1: number;
  dg2: number;
  dg3: number;
  dg4: number;
  avg?: number;
  phase?: 'loading' | 'holding' | 'unloading';
  remark?: string;
}

/**
 * Readings Agent - extracts all readings from all pages sequentially.
 * Why: Gets all pages together to maintain sequence and context.
 */
async function runReadingsAgent(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  pageImages: string[]
): Promise<RawReading[]> {
  console.log('   📊 Readings Agent: Processing all pages...');
  
  // Check file limit (Gemini 2.5 Pro supports max 3,600 images)
  if (pageImages.length > 3600) {
    throw new Error(`Too many pages: ${pageImages.length}. Maximum is 3,600 images per request.`);
  }
  
  const imageParts = pageImages.map((img) => ({
    inlineData: {
      data: img,
      mimeType: detectImageMimeType(img),
    },
  }));

  const result = await model.generateContent([
    ...imageParts,
    READINGS_PROMPT,
  ]);

  const response = await result.response;
  const content = response.text();
  
  if (!content) {
    console.log('   ❌ Readings Agent: No response');
    return [];
  }

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonContent = jsonMatch ? jsonMatch[0] : content;
  
  try {
    const parsed = JSON.parse(jsonContent);
    const readings = parsed.readings || [];
    console.log(`   ✅ Readings Agent: Extracted ${readings.length} readings`);
    return readings;
  } catch (e) {
    console.log('   ⚠️  Readings Agent: JSON parse error, attempting repair...');
    console.log(`   Content length: ${content.length} chars`);
    
    // Try to repair truncated JSON
    const repaired = repairTruncatedJson(content);
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired);
        const readings = parsed.readings || [];
        console.log(`   ✅ Readings Agent: Extracted ${readings.length} readings (after repair)`);
        return readings;
      } catch (e2) {
        console.log('   ❌ JSON repair failed');
        console.log('   First 500 chars:', content.substring(0, 500));
        console.log('   Last 500 chars:', content.substring(content.length - 500));
        console.log('   Error:', e2 instanceof Error ? e2.message : e2);
      }
    }
    return [];
  }
}

// =============================================================================
// READINGS VERIFIER
// =============================================================================

/**
 * Verifies and enriches readings with confidence scores.
 * Why: Validates avgSettlement and adds confidence metadata.
 */
function verifyReadings(
  rawReadings: RawReading[]
): ExtractedReadingWithConfidence[] {
  console.log('   ✅ Verifying readings...');
  
  const AVG_TOLERANCE = 0.05; // ±0.05mm tolerance
  let lowConfidenceCount = 0;

  const verified: ExtractedReadingWithConfidence[] = rawReadings.map((r, index) => {
    const dg1 = r.dg1 ?? 0;
    const dg2 = r.dg2 ?? 0;
    const dg3 = r.dg3 ?? 0;
    const dg4 = r.dg4 ?? 0;
    const pressure = r.pressure ?? 0;
    const extractedAvg = r.avg;
    
    // Normalize date and time
    const normalizedDate = normalizeDateToISO(r.date);
    const normalizedTime = normalizeTime(r.time);
    
    // Calculate avg from dial gauges
    const calculatedAvg = Math.round(((dg1 + dg2 + dg3 + dg4) / 4) * 100) / 100;
    
    // Calculate difference
    const avgDiff = extractedAvg !== undefined 
      ? Math.abs(calculatedAvg - extractedAvg) 
      : 0;
    
    // Determine confidence based on avgSettlement validation
    const avgMatches = extractedAvg === undefined || avgDiff <= AVG_TOLERANCE;
    
    // Check for invalid time format
    const hasValidTime = normalizedTime !== undefined;
    
    // Field-level confidence
    const fieldConfidence: FieldConfidence = {
      dg1: 'high',
      dg2: 'high',
      dg3: 'high',
      dg4: 'high',
      pressure: 'high',
    };
    
    // Check which gauge might be wrong (furthest from average of others)
    if (!avgMatches && extractedAvg !== undefined) {
      const gauges = [
        { key: 'dg1', value: dg1 },
        { key: 'dg2', value: dg2 },
        { key: 'dg3', value: dg3 },
        { key: 'dg4', value: dg4 },
      ];
      
      for (const gauge of gauges) {
        const others = gauges.filter(g => g.key !== gauge.key);
        const avgWithoutThis = others.reduce((sum, g) => sum + g.value, 0) / 3;
        
        if (Math.abs(gauge.value - avgWithoutThis) > AVG_TOLERANCE * 2) {
          fieldConfidence[gauge.key as keyof FieldConfidence] = 'low';
        }
      }
    }
    
    const overallConfidence: ConfidenceLevel = (avgMatches && hasValidTime) ? 'high' : 'low';
    if (overallConfidence === 'low') {
      lowConfidenceCount++;
    }
    
    return {
      sequence: index + 1,
      date: normalizedDate,
      time: normalizedTime,
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
      phase: r.phase,
    };
  });

  console.log(`   ✅ Verification complete: ${lowConfidenceCount} low confidence rows`);
  return verified;
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

/**
 * Main agent swarm extraction function.
 * Why: Orchestrates both agents in parallel for speed and accuracy.
 */
export async function runAgentSwarm(
  pageImages: string[],
  apiKey: string
): Promise<AgentSwarmResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-pro for best accuracy and higher output limits
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1, // Low temperature for consistent extraction
      maxOutputTokens: 65536, // High output limit for 109 readings
    },
  });
  
  console.log('\n🤖 AGENT SWARM EXTRACTION (Gemini 2.5 Pro)');
  console.log('='.repeat(50));
  console.log(`   📄 Processing ${pageImages.length} pages...`);
  
  // Check file limit upfront (Gemini 2.5 Pro supports max 3,600 images per request)
  if (pageImages.length > 3600) {
    throw new Error(`Too many pages: ${pageImages.length}. Maximum is 3,600 images per request.`);
  }
  
  // Run both agents in parallel
  const [projectInfoResult, readingsResult] = await Promise.all([
    runProjectInfoAgent(model, pageImages),
    runReadingsAgent(model, pageImages),
  ]);
  
  // Verify and enrich readings
  const verifiedReadings = verifyReadings(readingsResult);
  
  // Build project info with confidence
  const projectInfo: ProjectInfoWithConfidence = {
    value: projectInfoResult,
    confidence: {} as Record<keyof ExpectedProjectInfo, ConfidenceLevel>,
    votes: {} as Record<keyof ExpectedProjectInfo, string[]>,
  };
  
  // Set confidence for each field (all high since we're using single agent now)
  const fields: (keyof ExpectedProjectInfo)[] = [
    'pileId', 'reportNo', 'project', 'location', 'client', 'contractor',
    'pileDiameter', 'pileDepth', 'designLoad', 'testLoad', 'ramArea',
    'concreteGrade', 'testDate', 'dateOfCasting'
  ];
  
  for (const field of fields) {
    const value = projectInfoResult[field];
    projectInfo.confidence[field] = value !== undefined && value !== null ? 'high' : 'low';
    projectInfo.votes[field] = value !== undefined && value !== null ? [String(value)] : [];
  }
  
  // Calculate stats
  const lowConfidenceCount = verifiedReadings.filter(r => r.confidence === 'low').length;
  
  console.log('='.repeat(50));
  console.log(`✅ Extraction complete:`);
  console.log(`   Project info fields: ${Object.keys(projectInfoResult).length}`);
  console.log(`   Readings extracted: ${verifiedReadings.length}`);
  console.log(`   Low confidence: ${lowConfidenceCount}`);
  
  return {
    expectedRowCount: verifiedReadings.length,
    extractedRowCount: verifiedReadings.length,
    missingRowCount: 0,
    projectInfo,
    readings: verifiedReadings,
    lowConfidenceCount,
    emptyRowCount: 0,
    extractedAt: new Date().toISOString(),
    model: 'gemini-2.5-pro (two-agent swarm)',
  };
}
