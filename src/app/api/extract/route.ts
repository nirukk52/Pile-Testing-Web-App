/**
 * API Route: /api/extract
 * Why: Runs Agent Swarm extraction on uploaded field sheet PDFs.
 * Returns extracted project info and readings with confidence scores.
 * 
 * Uses Gemini's native PDF support (application/pdf MIME type) instead of
 * converting to images, which works reliably on Vercel serverless functions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AgentSwarmResult, ExtractedReadingWithConfidence, ProjectInfoWithConfidence, ConfidenceLevel, FieldConfidence } from '@/lib/ai/agent-swarm';
import type { ExpectedProjectInfo } from '@/lib/eval/types';

/**
 * Force Node.js runtime for this route.
 * Why: Need Buffer for base64 encoding.
 */
export const runtime = 'nodejs';

/**
 * Max duration for extraction (60 seconds on Pro plan).
 * Why: PDF extraction with Gemini can take 15-30 seconds.
 */
export const maxDuration = 60;

// =============================================================================
// PROMPTS (Same as agent-swarm.ts for consistency)
// =============================================================================

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
 */
function normalizeDateToISO(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    return `${dmyMatch[3]}-${month}-${day}`;
  }
  
  const shortYearMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (shortYearMatch) {
    const day = shortYearMatch[1].padStart(2, '0');
    const month = shortYearMatch[2].padStart(2, '0');
    const year = 2000 + parseInt(shortYearMatch[3]);
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}

/**
 * Validates and normalizes time format.
 */
function normalizeTime(timeStr: string | undefined): string | undefined {
  if (!timeStr) return undefined;
  
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  if (/^\d{1,2}\.\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split('.');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  if (/^\d{4}$/.test(timeStr)) {
    const h = timeStr.substring(0, 2);
    const m = timeStr.substring(2, 4);
    const hour = parseInt(h);
    const min = parseInt(m);
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      return `${h}:${m}`;
    }
  }
  
  return undefined;
}

/**
 * Repairs truncated JSON by closing unclosed brackets/braces.
 */
function repairTruncatedJson(text: string): string | null {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;
  cleaned = cleaned.slice(firstBrace);
  
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;
  
  for (const char of cleaned) {
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"' && !escapeNext) { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') openBraces++;
    else if (char === '}') openBraces--;
    else if (char === '[') openBrackets++;
    else if (char === ']') openBrackets--;
  }
  
  if (openBraces === 0 && openBrackets === 0) {
    return cleaned;
  }
  
  console.log(`   🔧 Attempting JSON repair: ${openBraces} unclosed braces, ${openBrackets} unclosed brackets`);
  
  let repaired = cleaned.trimEnd();
  
  if (repaired.trimEnd().endsWith(':')) {
    repaired += 'null';
  } else if (repaired.trimEnd().endsWith(',')) {
    repaired = repaired.trimEnd().slice(0, -1);
  }
  
  repaired += ']'.repeat(Math.max(0, openBrackets));
  repaired += '}'.repeat(Math.max(0, openBraces));
  
  return repaired;
}

// =============================================================================
// RAW READING TYPE
// =============================================================================

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

// =============================================================================
// AGENT FUNCTIONS
// =============================================================================

/**
 * Project Info Agent - extracts header metadata from PDF.
 */
async function runProjectInfoAgent(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  pdfBase64: string
): Promise<Partial<ExpectedProjectInfo>> {
  console.log('   📋 Project Info Agent: Processing PDF...');
  
  const result = await model.generateContent([
    {
      inlineData: {
        data: pdfBase64,
        mimeType: 'application/pdf',
      },
    },
    PROJECT_INFO_PROMPT,
  ]);

  const response = await result.response;
  const content = response.text();
  
  if (!content) {
    console.log('   ❌ Project Info Agent: No response');
    return {};
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonContent = jsonMatch ? jsonMatch[0] : content;
  
  try {
    const parsed = JSON.parse(jsonContent);
    console.log(`   ✅ Project Info Agent: Extracted ${Object.keys(parsed).length} fields`);
    return parsed;
  } catch {
    console.log('   ❌ Project Info Agent: JSON parse error');
    return {};
  }
}

/**
 * Readings Agent - extracts all readings from PDF.
 */
async function runReadingsAgent(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  pdfBase64: string
): Promise<RawReading[]> {
  console.log('   📊 Readings Agent: Processing PDF...');
  
  const result = await model.generateContent([
    {
      inlineData: {
        data: pdfBase64,
        mimeType: 'application/pdf',
      },
    },
    READINGS_PROMPT,
  ]);

  const response = await result.response;
  const content = response.text();
  
  if (!content) {
    console.log('   ❌ Readings Agent: No response');
    return [];
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonContent = jsonMatch ? jsonMatch[0] : content;
  
  try {
    const parsed = JSON.parse(jsonContent);
    const readings = parsed.readings || [];
    console.log(`   ✅ Readings Agent: Extracted ${readings.length} readings`);
    return readings;
  } catch {
    console.log('   ⚠️  Readings Agent: JSON parse error, attempting repair...');
    
    const repaired = repairTruncatedJson(content);
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired);
        const readings = parsed.readings || [];
        console.log(`   ✅ Readings Agent: Extracted ${readings.length} readings (after repair)`);
        return readings;
      } catch (e2) {
        console.log('   ❌ JSON repair failed:', e2 instanceof Error ? e2.message : e2);
      }
    }
    return [];
  }
}

/**
 * Verifies and enriches readings with confidence scores.
 */
function verifyReadings(rawReadings: RawReading[]): ExtractedReadingWithConfidence[] {
  console.log('   ✅ Verifying readings...');
  
  const AVG_TOLERANCE = 0.05;
  let lowConfidenceCount = 0;

  const verified: ExtractedReadingWithConfidence[] = rawReadings.map((r, index) => {
    const dg1 = r.dg1 ?? 0;
    const dg2 = r.dg2 ?? 0;
    const dg3 = r.dg3 ?? 0;
    const dg4 = r.dg4 ?? 0;
    const pressure = r.pressure ?? 0;
    const extractedAvg = r.avg;
    
    const normalizedDate = normalizeDateToISO(r.date);
    const normalizedTime = normalizeTime(r.time);
    
    const calculatedAvg = Math.round(((dg1 + dg2 + dg3 + dg4) / 4) * 100) / 100;
    
    const avgDiff = extractedAvg !== undefined 
      ? Math.abs(calculatedAvg - extractedAvg) 
      : 0;
    
    const avgMatches = extractedAvg === undefined || avgDiff <= AVG_TOLERANCE;
    const hasValidTime = normalizedTime !== undefined;
    
    const fieldConfidence: FieldConfidence = {
      dg1: 'high',
      dg2: 'high',
      dg3: 'high',
      dg4: 'high',
      pressure: 'high',
    };
    
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
// MAIN API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }
    
    // Check API key (Agent Swarm uses Gemini)
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY or GEMINI_API_KEY not configured. Please add it to your Vercel environment variables.' },
        { status: 500 }
      );
    }
    
    // Convert PDF to base64
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    const pdfBase64 = pdfBuffer.toString('base64');
    
    console.log('\n🤖 AGENT SWARM EXTRACTION (Gemini 2.5 Pro - Direct PDF)');
    console.log('='.repeat(50));
    console.log(`   📄 Processing PDF (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 65536,
      },
    });
    
    // Run both agents in parallel
    const [projectInfoResult, readingsResult] = await Promise.all([
      runProjectInfoAgent(model, pdfBase64),
      runReadingsAgent(model, pdfBase64),
    ]);
    
    // Verify and enrich readings
    const verifiedReadings = verifyReadings(readingsResult);
    
    // Build project info with confidence
    const projectInfo: ProjectInfoWithConfidence = {
      value: projectInfoResult,
      confidence: {} as Record<keyof ExpectedProjectInfo, ConfidenceLevel>,
      votes: {} as Record<keyof ExpectedProjectInfo, string[]>,
    };
    
    const fields: (keyof ExpectedProjectInfo)[] = [
      'pileId', 'reportNo', 'project', 'location', 'client', 'contractor',
      'pileDiameter', 'pileDepth', 'designLoad', 'testLoad', 'ramArea',
      'concreteGrade', 'testDate', 'dateOfCasting', 'testType'
    ];
    
    for (const field of fields) {
      const value = projectInfoResult[field];
      projectInfo.confidence[field] = value !== undefined && value !== null ? 'high' : 'low';
      projectInfo.votes[field] = value !== undefined && value !== null ? [String(value)] : [];
    }
    
    const lowConfidenceCount = verifiedReadings.filter(r => r.confidence === 'low').length;
    
    console.log('='.repeat(50));
    console.log(`✅ Extraction complete:`);
    console.log(`   Project info fields: ${Object.keys(projectInfoResult).length}`);
    console.log(`   Readings extracted: ${verifiedReadings.length}`);
    console.log(`   Low confidence: ${lowConfidenceCount}`);
    
    const result: AgentSwarmResult = {
      expectedRowCount: verifiedReadings.length,
      extractedRowCount: verifiedReadings.length,
      missingRowCount: 0,
      projectInfo,
      readings: verifiedReadings,
      lowConfidenceCount,
      emptyRowCount: 0,
      extractedAt: new Date().toISOString(),
      model: 'gemini-2.5-pro (direct PDF)',
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Extraction error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Extraction failed';
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid or missing API key. Please check GOOGLE_API_KEY in Vercel environment variables.';
      } else if (error.message.includes('quota') || error.message.includes('rate')) {
        errorMessage = 'API rate limit exceeded. Please try again in a few minutes.';
      } else if (error.message.includes('too large') || error.message.includes('size')) {
        errorMessage = 'PDF file is too large. Maximum size is 50MB.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
