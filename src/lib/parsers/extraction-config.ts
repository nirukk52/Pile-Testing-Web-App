/**
 * Extraction Configuration - Single Source of Truth
 * Why: Consolidates all extraction rules, patterns, and domain knowledge
 * so they can be reused across Excel, PDF, Vision API, LLMs, and future parsers.
 * 
 * This config is designed to be:
 * 1. Machine-readable (TypeScript types, regex patterns)
 * 2. LLM-readable (descriptions, examples, validation rules)
 * 3. Human-readable (clear documentation)
 */

// =============================================================================
// FIELD DEFINITIONS
// =============================================================================

/**
 * All extractable project info fields with their aliases, patterns, and examples.
 * Why: Different sources use different names for the same field.
 * 
 * Each field has:
 * - displayName: Human-readable name
 * - description: What this field represents (for LLMs)
 * - aliases: Common variations of the field name
 * - patterns: Regex patterns to match (for code parsers)
 * - type: Data type (string, number, date)
 * - examples: Example values (for LLMs to understand format)
 * - validation: Rules to validate extracted values
 */
export const FIELD_DEFINITIONS = {
  pileId: {
    displayName: 'Pile ID',
    description: 'Unique identifier for the test pile. Usually formatted as TP-01, TP-02, etc.',
    aliases: ['pile id', 'pile no', 'pile number', 'test pile', 'tp-', 'pile no.'],
    patterns: [/pile\s*(id|no\.?|number)/i, /test\s*pile/i, /tp[-\s]?\d+/i],
    type: 'string' as const,
    examples: ['TP-01', 'TP-1', 'Pile No. 5', 'Test Pile 3'],
    validation: {
      required: true,
      hint: 'Should contain pile identifier, often starting with TP or containing numbers',
    },
  },
  reportNo: {
    displayName: 'Report No',
    description: 'Reference number for the test report document.',
    aliases: ['report no', 'report number', 'ref no', 'reference no', 'report no.'],
    patterns: [/report\s*(no\.?|number)/i, /ref\s*(no\.?|number)/i],
    type: 'string' as const,
    examples: ['ZG/2024/PLT/001', 'RPT-2025-0042', 'REF/PLT/123'],
    validation: {
      required: false,
      hint: 'Alphanumeric reference, may contain slashes and dashes',
    },
  },
  project: {
    displayName: 'Project Name',
    description: 'Name of the construction project where the pile test is being conducted.',
    aliases: ['project', 'project name', 'site name', 'work', 'name of work'],
    patterns: [/project\s*[:\-]?/i, /site\s*(name)?/i, /work\s*[:\-]?/i, /name\s*of\s*work/i],
    type: 'string' as const,
    examples: ['Mumbai Metro Line 3', 'NHAI Highway NH-48 Expansion', 'Residential Tower Block A'],
    validation: {
      required: true,
      hint: 'Full project name, may be multiple words',
    },
  },
  location: {
    displayName: 'Location',
    description: 'Physical location or chainage where the pile test is performed.',
    aliases: ['location', 'site', 'place', 'between', 'chainage', 'address'],
    patterns: [/location\s*[:\-]?/i, /site\s*[:\-]?/i, /place/i, /between/i, /chainage/i],
    type: 'string' as const,
    examples: ['Ch. 45+200 to 45+400', 'Near Andheri Station', 'Plot No. 25, Sector 5'],
    validation: {
      required: true,
      hint: 'May contain chainage (Ch. XX+XXX) or address/landmark',
    },
  },
  client: {
    displayName: 'Client',
    description: 'The organization commissioning the pile test (project owner).',
    aliases: ['client', 'owner', 'employer', 'client name'],
    patterns: [/client/i, /owner/i, /employer/i],
    type: 'string' as const,
    examples: ['MMRDA', 'NHAI', 'L&T Construction', 'Tata Projects Ltd.'],
    validation: {
      required: true,
      hint: 'Organization name, often abbreviated',
    },
  },
  contractor: {
    displayName: 'Contractor',
    description: 'The construction company executing the piling work.',
    aliases: ['contractor', 'agency', 'contractor name', 'executing agency'],
    patterns: [/contractor\s*[:\-]?/i, /agency/i, /executing\s*agency/i],
    type: 'string' as const,
    examples: ['ABC Infrastructure Pvt. Ltd.', 'XYZ Constructions', 'Piling Solutions Inc.'],
    validation: {
      required: true,
      hint: 'Company name, may include Pvt. Ltd., Inc., etc.',
    },
  },
  pileDiameter: {
    displayName: 'Pile Diameter',
    description: 'Diameter of the pile being tested, in millimeters.',
    aliases: ['pile diameter', 'diameter', 'dia', 'pile dia', 'dia of pile'],
    patterns: [/pile\s*dia(meter)?/i, /dia(meter)?\s*(of\s*pile)?[:\-]?/i, /diameter/i],
    type: 'number' as const,
    unit: 'mm',
    examples: ['600', '800', '1000', '1200'],
    range: { min: 300, max: 2000 },
    validation: {
      required: true,
      hint: 'Numeric value in mm. Common values: 600, 800, 1000, 1200mm',
    },
  },
  pileDepth: {
    displayName: 'Pile Depth',
    description: 'Length/depth of the pile below ground level, in meters.',
    aliases: ['pile depth', 'depth', 'length', 'pile length', 'depth of pile'],
    patterns: [/pile\s*(depth|length)/i, /depth\s*(of\s*pile)?[:\-]?/i, /length/i],
    type: 'number' as const,
    unit: 'm',
    examples: ['12', '15', '20', '25.5'],
    range: { min: 5, max: 60 },
    validation: {
      required: true,
      hint: 'Numeric value in meters. Typical range: 10-30m',
    },
  },
  designLoad: {
    displayName: 'Design Load',
    description: 'Safe working load the pile is designed to carry, in Metric Tonnes.',
    aliases: ['design load', 'safe load', 'working load', 'design load on pile', 'swc'],
    patterns: [/design\s*load/i, /safe\s*(working\s*)?load/i, /working\s*load/i, /swc/i],
    type: 'number' as const,
    unit: 'MT',
    examples: ['100', '147', '200', '350'],
    range: { min: 10, max: 1000 },
    validation: {
      required: true,
      hint: 'Numeric value in MT. Test load = Design load × multiplier (2.5 for IVPLT)',
    },
  },
  ramArea: {
    displayName: 'Ram Area',
    description: 'Cross-sectional area of the hydraulic jack ram, in cm². Used to calculate load from pressure.',
    aliases: ['ram area', 'jack area', 'plunger area', 'area of ram', 'hydraulic jack area'],
    patterns: [/ram\s*area/i, /jack\s*area/i, /plunger\s*area/i, /area\s*of\s*ram/i],
    type: 'number' as const,
    unit: 'cm²',
    examples: ['71.26', '100', '126.67'],
    range: { min: 50, max: 200 },
    validation: {
      required: true,
      hint: 'Numeric value in cm². Formula: Load (MT) = Pressure (kg/cm²) × Ram Area (cm²) / 1000',
    },
  },
  testDate: {
    displayName: 'Date of Test',
    description: 'The date when the pile load test was conducted. IMPORTANT: This should be the date of the FIRST READING in the test data (the 0 0 0 0 reading), not from header metadata.',
    aliases: ['test date', 'date of test', 'date of testing', 'testing date'],
    patterns: [/test\s*date/i, /date\s*of\s*test(ing)?/i],
    type: 'date' as const,
    examples: ['05-02-2025', '15/01/2025', '2025-02-05'],
    derivedFrom: 'firstReadingDate',
    validation: {
      required: true,
      hint: 'RULE: Extract from the first reading row (where all values are 0), NOT from header text',
    },
  },
  dateOfCasting: {
    displayName: 'Date of Casting',
    description: 'The date when the pile concrete was poured/cast. This is DIFFERENT from test date - it is when the pile was constructed, not tested.',
    aliases: ['date of casting', 'casting date', 'doc', 'd.o.c', 'date of concreting'],
    patterns: [/date\s*of\s*casting/i, /casting\s*date/i, /d\.?o\.?c\.?/i, /date\s*of\s*concret/i],
    type: 'date' as const,
    examples: ['15-01-2025', '01/12/2024'],
    validation: {
      required: false,
      hint: 'Date format: DD-MM-YYYY or DD/MM/YYYY. Should be BEFORE test date (pile must cure before testing)',
    },
  },
  concreteGrade: {
    displayName: 'Concrete Grade',
    description: 'Grade of concrete used in the pile, following Indian Standard notation (M followed by number).',
    aliases: ['concrete grade', 'mixed design', 'mix design', 'grade', 'grade of concrete'],
    patterns: [/concrete\s*grade/i, /mix(ed)?\s*design/i, /grade\s*(of\s*concrete)?/i],
    type: 'string' as const,
    examples: ['M25', 'M30', 'M35', 'M40'],
    valuePattern: /M\s*\d+/i,
    validation: {
      required: true,
      hint: 'Format: M followed by number (M25, M30, M35, M40). Extract just the grade, ignore other text.',
    },
  },
} as const;

// =============================================================================
// READING COLUMN DEFINITIONS
// =============================================================================

/**
 * Column definitions for readings table.
 * Why: Different Excel files use different column headers.
 */
export const READING_COLUMNS = {
  date: {
    displayName: 'Date',
    description: 'Date when the reading was taken. The first reading date IS the test date.',
    aliases: ['date'],
    patterns: [/^date$/i, /date(?!\s*time)/i],
    examples: ['05-02-2025', '05/02/2025'],
  },
  time: {
    displayName: 'Time',
    description: 'Time when the reading was taken. Usually in 24-hour format or with AM/PM.',
    aliases: ['time', 'hrs', 'timestamp'],
    patterns: [/^time$/i, /\(hrs\)/i, /hrs/i, /timestamp/i],
    examples: ['09:00', '14:30', '9:00 AM'],
  },
  pressure: {
    displayName: 'Pressure Gauge Reading',
    description: 'Reading from the pressure gauge on the hydraulic jack. Used to calculate load.',
    aliases: ['pressure', 'pressure gauge', 'pg', 'gauge reading', 'kg/cm2'],
    patterns: [/pressure/i, /gauge\s*reading/i, /kg\s*\/\s*cm/i],
    unit: 'kg/cm²',
    range: { min: 0, max: 600 },
    examples: ['0', '50', '100', '200', '350'],
  },
  load: {
    displayName: 'Load',
    description: 'Applied load in Metric Tonnes. If not directly given, calculate: Load = Pressure × Ram Area / 1000',
    aliases: ['load', 'load in mt', 'load mt', 'mt'],
    patterns: [/^load/i, /load\s*(in\s*)?mt/i],
    unit: 'MT',
    examples: ['0', '35.63', '71.26', '142.52'],
  },
  dialGauge1: {
    displayName: 'Dial Gauge 1',
    description: 'Settlement reading from dial gauge 1. Measures pile displacement in mm.',
    aliases: ['dg1', 'dial gauge 1', 'dial 1', 'reading 1', '1'],
    patterns: [/dg[-\s]?1/i, /dial\s*(gauge\s*)?1/i],
    unit: 'mm',
    examples: ['0', '0.5', '1.25', '3.80'],
  },
  dialGauge2: {
    displayName: 'Dial Gauge 2',
    description: 'Settlement reading from dial gauge 2. Measures pile displacement in mm.',
    aliases: ['dg2', 'dial gauge 2', 'dial 2', 'reading 2', '2'],
    patterns: [/dg[-\s]?2/i, /dial\s*(gauge\s*)?2/i],
    unit: 'mm',
    examples: ['0', '0.48', '1.30', '3.75'],
  },
  dialGauge3: {
    displayName: 'Dial Gauge 3',
    description: 'Settlement reading from dial gauge 3. Measures pile displacement in mm.',
    aliases: ['dg3', 'dial gauge 3', 'dial 3', 'reading 3', '3'],
    patterns: [/dg[-\s]?3/i, /dial\s*(gauge\s*)?3/i],
    unit: 'mm',
    examples: ['0', '0.52', '1.28', '3.82'],
  },
  dialGauge4: {
    displayName: 'Dial Gauge 4',
    description: 'Settlement reading from dial gauge 4. Measures pile displacement in mm.',
    aliases: ['dg4', 'dial gauge 4', 'dial 4', 'reading 4', '4'],
    patterns: [/dg[-\s]?4/i, /dial\s*(gauge\s*)?4/i],
    unit: 'mm',
    examples: ['0', '0.50', '1.27', '3.78'],
  },
  phase: {
    displayName: 'Phase',
    description: 'Current phase of the test: loading (increasing load), holding (maintaining load), or unloading (decreasing load).',
    aliases: ['phase', 'loading phase', 'stage', 'cycle'],
    patterns: [/phase/i, /stage/i, /cycle/i],
    allowedValues: ['loading', 'holding', 'unloading'],
  },
  remark: {
    displayName: 'Remark',
    description: 'Any observations or notes for this reading.',
    aliases: ['remark', 'remarks', 'note', 'notes', 'observation'],
    patterns: [/remark/i, /note/i, /observation/i],
  },
} as const;

// =============================================================================
// BUSINESS RULES - CRITICAL DOMAIN KNOWLEDGE
// =============================================================================

/**
 * Extraction business rules - domain knowledge that LLMs and parsers MUST follow.
 * Why: These rules apply regardless of the source format and ensure correct extraction.
 */
export const EXTRACTION_RULES = {
  /**
   * RULE 1: Test Date Source
   * The first reading in a pile test ALWAYS has:
   * - 0 pressure/load (no load applied yet)
   * - 0 0 0 0 dial gauge readings (or initial reference values)
   * The DATE of this first reading IS the actual test date.
   * This is MORE RELIABLE than extracting from header text.
   */
  testDateFromFirstReading: {
    rule: 'ALWAYS extract test date from the first reading row (where pressure and dial gauges are all 0)',
    reason: 'Header text may have wrong dates or be formatted inconsistently. First reading date is always correct.',
    priority: 'high',
    overrides: 'header metadata extraction',
  },

  /**
   * RULE 2: Date of Casting vs Test Date
   * These are TWO DIFFERENT dates:
   * - Date of Casting: When the pile concrete was poured
   * - Test Date: When the load test was conducted
   * Date of Casting is ALWAYS BEFORE Test Date (pile must cure before testing).
   */
  dateOfCastingVsTestDate: {
    rule: 'Date of Casting and Test Date are DIFFERENT fields. Do not confuse them.',
    reason: 'Casting happens weeks/months before testing. Mixing them up causes incorrect age calculations.',
    validation: 'dateOfCasting should be BEFORE testDate',
  },

  /**
   * RULE 3: Phase Detection
   * Determine the phase based on pressure/load changes:
   */
  phaseDetection: {
    loading: {
      condition: 'Pressure/load INCREASING from previous reading',
      description: 'Load is being applied to the pile',
    },
    holding: {
      condition: 'Pressure/load SAME as previous, multiple readings at same load',
      description: 'Load is being maintained to observe settlement over time',
    },
    unloading: {
      condition: 'Pressure/load DECREASING from previous reading',
      description: 'Load is being removed from the pile',
    },
    detection: 'If pressure goes up → loading. If pressure same but time passes → holding. If pressure goes down → unloading.',
  },

  /**
   * RULE 4: Test Load Multipliers (IS 2911 Part 4)
   * Maximum test load = Design Load × Multiplier
   */
  testLoadMultiplier: {
    IVPLT: { multiplier: 2.5, description: 'Initial Vertical Pile Load Test: Test to 2.5× Design Load' },
    RVPLT: { multiplier: 1.5, description: 'Routine Vertical Pile Load Test: Test to 1.5× Design Load' },
    Lateral: { multiplier: 2.5, description: 'Lateral Pile Load Test: Test to 2.5× Design Load' },
    Uplift: { multiplier: 2.5, description: 'Uplift/Pullout Test: Test to 2.5× Design Load' },
  },

  /**
   * RULE 5: Pass/Fail Criteria (IS 2911 Part 4)
   */
  passFailCriteria: {
    maxNetSettlement: 12,
    unit: 'mm',
    rule: 'Net settlement at design load must be ≤ 12mm for the pile to PASS',
    calculation: 'Net Settlement = Total Settlement - Elastic Rebound',
  },

  /**
   * RULE 6: Concrete Grade Format
   */
  concreteGrade: {
    format: 'M followed by number (M25, M30, M35, M40)',
    commonValues: ['M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'],
    extraction: 'Extract ONLY the M## part, ignore surrounding text',
  },

  /**
   * RULE 7: Readings Data Quality
   */
  readingsValidation: {
    firstReading: 'First reading should have 0 pressure and 0 (or reference) dial gauge values',
    dialGauges: 'All 4 dial gauges should have values. If some are missing, flag as low confidence.',
    sequence: 'Readings should be in chronological order',
    settlement: 'Dial gauge values generally increase during loading phase',
  },
} as const;

// =============================================================================
// COMMON MISTAKES TO AVOID (FOR LLMs)
// =============================================================================

/**
 * Common extraction mistakes that LLMs should avoid.
 * Why: Helps LLMs learn from typical errors.
 */
export const COMMON_MISTAKES = {
  testDateConfusion: {
    mistake: 'Extracting test date from header text instead of first reading',
    correct: 'Always use the date from the first reading row (0 0 0 0 row)',
    example: 'Header says "Test Date: 18/12/2025" but first reading is dated "05-02-2025" → Use 05-02-2025',
  },
  castingDateMixup: {
    mistake: 'Confusing Date of Casting with Test Date',
    correct: 'These are separate fields. Casting date is when pile was built. Test date is when test was done.',
    example: 'Casting: 15-01-2025, Test: 05-02-2025 (pile cured for ~3 weeks before testing)',
  },
  concreteGradeFormat: {
    mistake: 'Extracting "Mixed Design :- M35" as the full value',
    correct: 'Extract only "M35" - the grade designation',
  },
  separatorInValues: {
    mistake: 'Including ":-" or ": -" separators in extracted values',
    correct: 'Strip leading separators. ":-05-02-2025" should become "05-02-2025"',
  },
  unitConfusion: {
    mistake: 'Including units in numeric values like "600 mm" or "147 MT"',
    correct: 'Extract only the number: "600", "147"',
  },
  usDateFormat: {
    mistake: 'Assuming all dates are DD/MM/YYYY format',
    correct: 'Auto-detect format: if second number > 12, it must be day (US format M/D/Y). 5/19/25 = May 19, 2025',
    example: '5/19/25 → 19-05-2025 (US format detected because 19 > 12)',
  },
} as const;

// =============================================================================
// VALUE CLEANING UTILITIES
// =============================================================================

/**
 * Cleans a value by removing common separators.
 * Why: Excel cells often have formats like "Label:- Value" or ":-Value".
 */
export function cleanExtractedValue(value: string): string {
  if (!value) return '';
  
  // Remove leading separators (: - and combinations with optional spaces)
  let cleaned = value.trim();
  const separatorMatch = cleaned.match(/^[:\-]+\s*(.+)$/);
  if (separatorMatch) {
    cleaned = separatorMatch[1].trim();
  }
  
  return cleaned;
}

/**
 * Extracts a date from various formats and returns ISO format (YYYY-MM-DD).
 * Why: Dates come in many formats (DD-MM-YYYY, DD/MM/YYYY, M/D/YY US format, ISO, etc.).
 * Auto-detects US vs Indian format based on value ranges.
 * Returns ISO format for consistent storage in the app.
 */
export function extractDateValue(value: string | Date): string | null {
  if (!value) return null;
  
  // Already a Date object (Excel with cellDates: true)
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${year}-${month}-${day}`; // ISO format
  }
  
  const str = String(value).trim();
  
  // ISO format: YYYY-MM-DD (already in correct format)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return str.substring(0, 10); // Return as-is (first 10 chars)
  }
  
  // Generic date pattern: X/Y/Z or X-Y-Z or X.Y.Z
  const dateMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dateMatch) {
    const [, first, second, yearPart] = dateMatch;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    const fullYear = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    
    let day: string;
    let month: string;
    
    // Auto-detect format based on value ranges:
    // - If second number > 12, it MUST be day (so first is month) → US format M/D/Y
    // - If first number > 12, it MUST be day (so second is month) → Indian format D/M/Y
    // - If both ≤ 12, assume Indian format D/M/Y (default for this app)
    if (secondNum > 12) {
      // US format: M/D/Y (e.g., 5/19/25 = May 19, 2025)
      month = first.padStart(2, '0');
      day = second.padStart(2, '0');
    } else if (firstNum > 12) {
      // Indian format: D/M/Y (e.g., 19/5/25 = May 19, 2025)
      day = first.padStart(2, '0');
      month = second.padStart(2, '0');
    } else {
      // Ambiguous (both ≤ 12), assume Indian format D/M/Y as default
      day = first.padStart(2, '0');
      month = second.padStart(2, '0');
    }
    
    // Validate month is 1-12
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
      return null; // Invalid date
    }
    
    return `${fullYear}-${month}-${day}`; // ISO format YYYY-MM-DD
  }
  
  return null;
}

/**
 * Formats a date to display format (DD/MM/YYYY).
 * Why: For showing dates in UI in Indian format.
 */
export function formatDateForDisplay(isoDate: string | null): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Extracts a numeric value from a string.
 * Why: Values often have units or extra text (e.g., "600 mm", "147 MT").
 */
export function extractNumericValue(value: string): string | null {
  if (!value) return null;
  
  const match = String(value).match(/[\d.]+/);
  return match ? match[0] : null;
}

/**
 * Extracts concrete grade (M25, M35, etc.).
 * Why: Grade might have extra text or formatting.
 */
export function extractConcreteGrade(value: string): string | null {
  if (!value) return null;
  
  const match = String(value).match(/M\s*(\d+)/i);
  return match ? `M${match[1]}` : null;
}

// =============================================================================
// LLM-READABLE CONFIG GENERATOR
// =============================================================================

/**
 * Generates a plain-text version of the extraction config for LLM consumption.
 * Why: LLMs work better with structured text than code. This can be included in prompts.
 */
export function generateLLMReadableConfig(): string {
  const fields = Object.entries(FIELD_DEFINITIONS)
    .map(([key, def]) => {
      const field = def as typeof FIELD_DEFINITIONS[keyof typeof FIELD_DEFINITIONS];
      let text = `### ${field.displayName} (${key})
- Description: ${field.description}
- Also known as: ${field.aliases.join(', ')}
- Type: ${field.type}`;
      if ('unit' in field) text += `\n- Unit: ${field.unit}`;
      if ('examples' in field) text += `\n- Examples: ${(field.examples as readonly string[]).join(', ')}`;
      if ('validation' in field) text += `\n- Validation: ${(field.validation as { hint: string }).hint}`;
      return text;
    })
    .join('\n\n');

  const rules = `
## CRITICAL EXTRACTION RULES

### Rule 1: Test Date Source (HIGH PRIORITY)
${EXTRACTION_RULES.testDateFromFirstReading.rule}
Reason: ${EXTRACTION_RULES.testDateFromFirstReading.reason}

### Rule 2: Date of Casting vs Test Date
${EXTRACTION_RULES.dateOfCastingVsTestDate.rule}
Reason: ${EXTRACTION_RULES.dateOfCastingVsTestDate.reason}

### Rule 3: Phase Detection
${EXTRACTION_RULES.phaseDetection.detection}

### Rule 4: Concrete Grade
Format: ${EXTRACTION_RULES.concreteGrade.format}
Common values: ${EXTRACTION_RULES.concreteGrade.commonValues.join(', ')}

### Rule 5: Pass/Fail Criteria
${EXTRACTION_RULES.passFailCriteria.rule}`;

  const mistakes = Object.entries(COMMON_MISTAKES)
    .map(([key, m]) => `- **${key}**: ${m.mistake} → ${m.correct}`)
    .join('\n');

  return `# Pile Load Test Data Extraction Guide

## FIELD DEFINITIONS

${fields}

${rules}

## COMMON MISTAKES TO AVOID

${mistakes}

## READING COLUMNS

| Column | Description | Unit | Examples |
|--------|-------------|------|----------|
${Object.entries(READING_COLUMNS)
  .map(([key, col]) => {
    const c = col as typeof READING_COLUMNS[keyof typeof READING_COLUMNS];
    const unit = 'unit' in c ? c.unit : '-';
    const examples = 'examples' in c ? (c.examples as readonly string[]).join(', ') : '-';
    return `| ${c.displayName} | ${c.description} | ${unit} | ${examples} |`;
  })
  .join('\n')}
`;
}

// =============================================================================
// VISION API PROMPT BUILDER
// =============================================================================

/**
 * Builds the system prompt for Vision API extraction.
 * Why: Uses the same field definitions and rules for consistency.
 */
export function buildVisionExtractionPrompt(): string {
  const fieldDescriptions = Object.entries(FIELD_DEFINITIONS)
    .map(([key, def]) => {
      const field = def as typeof FIELD_DEFINITIONS[keyof typeof FIELD_DEFINITIONS];
      const examples = 'examples' in field ? ` (e.g., ${(field.examples as readonly string[]).slice(0, 2).join(', ')})` : '';
      return `- ${field.displayName}: ${field.description}${examples}`;
    })
    .join('\n');

  return `You are analyzing a pile load test field sheet or report. Extract structured data.

## DOMAIN CONTEXT
- Pressure gauge readings are in kg/cm² (typical range: 0-600)
- Dial gauge readings measure settlement in mm (typical range: 0-50mm)
- 4 dial gauges are used, averaged for settlement
- Loading phase: pressure increases
- Unloading phase: pressure decreases
- Test load for IVPLT = 2.5 × Design Load

## CRITICAL RULES (MUST FOLLOW)

1. **TEST DATE**: Extract from the FIRST READING row (where pressure = 0 and all dial gauges = 0).
   Do NOT use dates from header text - they are often wrong or formatted inconsistently.

2. **DATE OF CASTING**: This is DIFFERENT from test date. It's when the pile concrete was poured.
   It should be BEFORE the test date (piles need time to cure before testing).

3. **CONCRETE GRADE**: Extract only the grade (M25, M30, M35, etc.).
   If source says "Mixed Design :- M35", extract only "M35".

4. **NUMERIC VALUES**: Extract only numbers, strip units.
   "600 mm" → "600", "147 MT" → "147"

5. **SEPARATORS**: Remove leading :- or : from values.
   ":-05-02-2025" → "05-02-2025"

## FIELDS TO EXTRACT
${fieldDescriptions}

## OUTPUT FORMAT (JSON)
{
  "projectInfo": {
    "pileId": "TP-01",
    "project": "Project Name",
    "location": "Site Location",
    "client": "Client Name",
    "contractor": "Contractor Name",
    "pileDiameter": "600",
    "pileDepth": "15",
    "designLoad": "147",
    "ramArea": "71.26",
    "testDate": "05-02-2025",
    "dateOfCasting": "15-01-2025",
    "concreteGrade": "M35",
    "reportNo": "ZG/2025/001"
  },
  "readings": [
    {
      "date": "05-02-2025",
      "time": "09:00",
      "pressure": "0",
      "dg1": "0",
      "dg2": "0",
      "dg3": "0",
      "dg4": "0",
      "phase": "loading"
    }
  ],
  "confidence": 85,
  "notes": "Any extraction issues or uncertainties"
}

Extract ALL visible readings. If a value is unclear, estimate and note low confidence.`;
}

// =============================================================================
// FIELD PATTERN GENERATOR
// =============================================================================

/**
 * Generates RegExp patterns for a field.
 * Why: Can be used by any parser that needs to match field names.
 */
export function getFieldPatterns(fieldKey: keyof typeof FIELD_DEFINITIONS): RegExp[] {
  return FIELD_DEFINITIONS[fieldKey].patterns as unknown as RegExp[];
}

/**
 * Gets all patterns as a record for Excel parser compatibility.
 */
export function getAllFieldPatterns(): Record<string, RegExp[]> {
  const patterns: Record<string, RegExp[]> = {};
  for (const [key, def] of Object.entries(FIELD_DEFINITIONS)) {
    patterns[key] = def.patterns as unknown as RegExp[];
  }
  return patterns;
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type FieldKey = keyof typeof FIELD_DEFINITIONS;
export type ReadingColumnKey = keyof typeof READING_COLUMNS;
