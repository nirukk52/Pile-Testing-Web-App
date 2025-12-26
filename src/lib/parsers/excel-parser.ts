/**
 * Excel Parser for IVPLT Test Data
 * Why: Extracts project info and readings from Excel files uploaded by users.
 * Uses xlsx library to parse .xlsx and .csv files.
 * Uses shared extraction-config for patterns and rules.
 */

import * as XLSX from 'xlsx';
import type {
  ExtractedProjectInfo,
  ExtractedReading,
  ExtractedValue,
  IngestionJob,
} from '@/types';
import {
  getAllFieldPatterns,
  cleanExtractedValue,
  extractDateValue,
  extractNumericValue,
  extractConcreteGrade,
} from './extraction-config';

/**
 * Project info field patterns from shared config.
 * Why: Single source of truth for all parsers.
 */
const PROJECT_FIELD_PATTERNS = getAllFieldPatterns();

/**
 * Creates an ExtractedValue with high confidence (Excel data is reliable).
 * Why: Excel parsing is deterministic, so confidence is typically 95+.
 */
function createValue(value: unknown, confidence = 95): ExtractedValue {
  const stringValue = value !== null && value !== undefined ? String(value).trim() : '';
  return {
    value: stringValue,
    confidence: stringValue ? confidence : 0,
  };
}


/**
 * Extracts date string from a reading's timestamp.
 * Why: The first reading's date is used as the test date (per EXTRACTION_RULES).
 */
function extractDateFromReading(reading: ExtractedReading): string | null {
  if (!reading.timestamp?.value) return null;
  return extractDateValue(reading.timestamp.value);
}

/**
 * Normalizes a string for comparison.
 * Why: Makes column matching more flexible.
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds the column index that matches any of the given patterns.
 * Why: Handles variation in column naming across different files.
 */
function findColumn(headers: string[], patterns: string[]): number {
  const normalizedPatterns = patterns.map(normalize);
  return headers.findIndex((h) => normalizedPatterns.includes(normalize(h)));
}

/**
 * Detects the phase from a value string.
 * Why: Standardizes phase values to our enum.
 */
function detectPhase(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('load') && !lower.includes('unload')) return 'loading';
  if (lower.includes('unload')) return 'unloading';
  if (lower.includes('hold') || lower.includes('maintain')) return 'holding';
  return 'loading'; // Default to loading
}

/**
 * Identifies sheets that contain actual data (not charts/graphs).
 * Why: Need to check ALL data sheets as readings may be distributed across them.
 */
function findDataSheets(workbook: XLSX.WorkBook): string[] {
  const dataSheets: string[] = [];

  for (const name of workbook.SheetNames) {
    // Skip obvious chart/graph sheets
    const lowerName = name.toLowerCase();
    if (lowerName.includes('chart') || lowerName.includes('graph')) {
      continue;
    }
    
    const sheet = workbook.Sheets[name];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const nonEmptyRows = data.filter(row => 
      row && Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && cell !== '')
    );
    
    // Only include sheets with meaningful data (more than 5 non-empty rows)
    if (nonEmptyRows.length > 5) {
      dataSheets.push(name);
    }
  }

  return dataSheets;
}

/**
 * Parses an Excel buffer and extracts test data from ALL sheets.
 * Why: Main entry point for Excel file processing. Checks all sheets since
 * readings may be distributed across multiple sheets (loading/unloading/pages).
 */
export function parseExcelBuffer(
  buffer: Buffer,
  fileName: string
): Pick<IngestionJob, 'extractedProjectInfo' | 'extractedReadings' | 'overallConfidence' | 'lowConfidenceFields'> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  
  // Find ALL sheets with data (not just the "best" one)
  const dataSheets = findDataSheets(workbook);
  
  if (dataSheets.length === 0) {
    return {
      extractedProjectInfo: undefined,
      extractedReadings: [],
      overallConfidence: 0,
      lowConfidenceFields: ['No data sheets found in file'],
    };
  }

  // Collect data from ALL sheets
  let mergedProjectInfo: ExtractedProjectInfo = {};
  const allReadings: ExtractedReading[] = [];
  const lowConfidenceFields: string[] = [];
  const sheetsProcessed: string[] = [];

  for (const sheetName of dataSheets) {
    const sheetResult = parseSheet(workbook.Sheets[sheetName], sheetName);
    
    if (sheetResult.readings.length > 0) {
      sheetsProcessed.push(sheetName);
      
      // Merge project info (later sheets fill in missing fields)
      if (sheetResult.projectInfo) {
        mergedProjectInfo = mergeProjectInfo(mergedProjectInfo, sheetResult.projectInfo);
      }
      
      // Add readings with sheet context
      allReadings.push(...sheetResult.readings);
      
      // Collect warnings
      lowConfidenceFields.push(...sheetResult.warnings);
    }
  }

  // De-duplicate readings (same time + same dial gauge values = duplicate)
  const uniqueReadings = deduplicateReadings(allReadings);

  // Derive testDate from first reading (the 0 0 0 0 reading is always first)
  // Why: The test date is the date when the first reading was taken - this is more reliable
  // than trying to extract it from header metadata which can be inconsistent
  if (uniqueReadings.length > 0) {
    const firstReading = uniqueReadings[0];
    const testDateFromReading = extractDateFromReading(firstReading);
    if (testDateFromReading) {
      // Always use first reading's date as testDate (higher priority than header extraction)
      mergedProjectInfo.testDate = createValue(testDateFromReading, 95);
    }
  }

  // Calculate overall confidence
  const totalFields = uniqueReadings.length * 5;
  const confidenceSum = uniqueReadings.reduce((sum, r) => {
    return (
      sum +
      r.pressureGauge.confidence +
      r.dialGauge1.confidence +
      r.dialGauge2.confidence +
      r.dialGauge3.confidence +
      r.dialGauge4.confidence
    );
  }, 0);
  const overallConfidence = totalFields > 0 ? Math.round(confidenceSum / totalFields) : 0;

  // Log sheets processed for transparency
  if (sheetsProcessed.length > 1) {
    lowConfidenceFields.unshift(`Data compiled from ${sheetsProcessed.length} sheets: ${sheetsProcessed.join(', ')}`);
  }

  return {
    extractedProjectInfo: Object.keys(mergedProjectInfo).length > 0 ? mergedProjectInfo : undefined,
    extractedReadings: uniqueReadings,
    overallConfidence,
    lowConfidenceFields,
  };
}

/**
 * Result from parsing a single sheet.
 */
interface SheetParseResult {
  projectInfo?: ExtractedProjectInfo;
  readings: ExtractedReading[];
  warnings: string[];
}

/**
 * Parses a single sheet and extracts readings.
 * Why: Separated from main function to enable multi-sheet processing.
 */
function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): SheetParseResult {
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const warnings: string[] = [];
  
  if (data.length === 0) {
    return { readings: [], warnings: [] };
  }

  // Find header row
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;

    const rowCells = row.map((cell) => String(cell || '').toLowerCase().trim());
    
    const hasDate = rowCells.some(c => c === 'date' || c.includes('date'));
    const hasTime = rowCells.some(c => c === 'time' || c.includes('time') || c.includes('hrs'));
    const hasPressure = rowCells.some(c => c.includes('pressure') || c.includes('gauge'));
    const hasLoad = rowCells.some(c => c.includes('load') || c.includes('mt'));
    const hasDialGauge = rowCells.some(c => c.includes('dial') || c.includes('reading') || c.includes('average'));

    if ((hasDate || hasTime) && (hasPressure || hasLoad) && hasDialGauge) {
      headerRowIndex = i;
      headers = row.map((cell) => String(cell || ''));
      break;
    }
  }

  // Extract project info from rows before headers
  const projectInfo = extractProjectInfo(data.slice(0, headerRowIndex > 0 ? headerRowIndex : 15));

  // If no headers found, try fixed columns
  if (headerRowIndex === -1) {
    const fixedResult = parseSheetWithFixedColumns(data, sheetName);
    return { projectInfo, readings: fixedResult.readings, warnings: fixedResult.warnings };
  }

  // Map columns
  const columnMap = mapColumns(headers, data, headerRowIndex);

  // Extract readings
  const readings = extractReadingsFromSheet(data, columnMap, headerRowIndex, sheetName);

  return { projectInfo, readings, warnings };
}

/**
 * Maps column headers to indices, handling multi-row headers.
 * Why: Pile test Excel files often have headers spanning multiple rows.
 */
function mapColumns(
  headers: string[],
  data: unknown[][],
  headerRowIndex: number
): Record<string, number> {
  const headerRow2 = data[headerRowIndex + 1] || [];
  const headerRow3 = data[headerRowIndex + 2] || [];
  const headerRow4 = data[headerRowIndex + 3] || [];
  
  const combinedHeaders = headers.map((h, i) => {
    const h0 = String(h || '');
    const h2 = String(headerRow2[i] || '');
    const h3 = String(headerRow3[i] || '');
    const h4 = String(headerRow4[i] || '');
    return `${h0} ${h2} ${h3} ${h4}`.toLowerCase().trim();
  });

  const columnMap: Record<string, number> = {
    date: -1,
    time: -1,
    pressure: -1,
    load: -1,
    dg1: -1,
    dg2: -1,
    dg3: -1,
    dg4: -1,
    phase: -1,
    remark: -1,
  };

  for (let i = 0; i < combinedHeaders.length; i++) {
    const h = combinedHeaders[i] || '';
    const h0 = String(headers[i] || '').toLowerCase().trim();
    
    // Date column detection - usually first column or explicitly labeled "date"
    if (h0 === 'date' || (h.includes('date') && !h.includes('time'))) {
      if (columnMap.date === -1) columnMap.date = i;
    }
    
    if (h0 === 'time' || h.includes('time') || h.includes('hrs')) {
      if (columnMap.time === -1) columnMap.time = i;
    }
    
    if (h.includes('pressure') || (h.includes('gauge') && h.includes('reading') && !h.includes('dial'))) {
      if (columnMap.pressure === -1) columnMap.pressure = i;
    }
    
    if (h0.includes('load') || h.includes('load in mt')) {
      if (columnMap.load === -1) columnMap.load = i;
    }
    
    if (h.includes('remark')) {
      columnMap.remark = i;
    }
    
    if (h.includes('dial') || (h.includes('reading') && !h.includes('gauge'))) {
      const num = parseFloat(String(headerRow4[i] || ''));
      if (num === 1 && columnMap.dg1 === -1) columnMap.dg1 = i;
      else if (num === 2 && columnMap.dg2 === -1) columnMap.dg2 = i;
      else if (num === 3 && columnMap.dg3 === -1) columnMap.dg3 = i;
      else if (num === 4 && columnMap.dg4 === -1) columnMap.dg4 = i;
    }
  }

  // Check numbered sub-headers
  if (columnMap.dg1 === -1) {
    for (let i = 0; i < headerRow4.length; i++) {
      const num = parseFloat(String(headerRow4[i] || ''));
      if (num === 1 && columnMap.dg1 === -1) columnMap.dg1 = i;
      else if (num === 2 && columnMap.dg2 === -1) columnMap.dg2 = i;
      else if (num === 3 && columnMap.dg3 === -1) columnMap.dg3 = i;
      else if (num === 4 && columnMap.dg4 === -1) columnMap.dg4 = i;
    }
  }

  // Fallback to position-based detection
  if (columnMap.dg1 === -1) {
    const dialGaugeStart = headers.findIndex(h => String(h || '').toLowerCase().includes('dial'));
    if (dialGaugeStart !== -1) {
      columnMap.dg1 = dialGaugeStart;
      columnMap.dg2 = dialGaugeStart + 1;
      columnMap.dg3 = dialGaugeStart + 2;
      columnMap.dg4 = dialGaugeStart + 3;
    } else {
      const startCol = Math.max(columnMap.pressure, columnMap.load, 3) + 1;
      columnMap.dg1 = startCol;
      columnMap.dg2 = startCol + 1;
      columnMap.dg3 = startCol + 2;
      columnMap.dg4 = startCol + 3;
    }
  }

  return columnMap;
}

/**
 * Extracts readings from a sheet with known column mapping.
 * Why: Core extraction logic, separated for reuse.
 */
function extractReadingsFromSheet(
  data: unknown[][],
  columnMap: Record<string, number>,
  headerRowIndex: number,
  sheetName: string
): ExtractedReading[] {
  const readings: ExtractedReading[] = [];
  let currentPhase = 'loading';
  const dataStartRow = headerRowIndex + 4;
  
  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || '').toLowerCase().trim();
    
    // Phase markers
    if (firstCell.includes('loading') && !firstCell.includes('un')) {
      currentPhase = 'loading';
      continue;
    }
    if (firstCell.includes('unloading')) {
      currentPhase = 'unloading';
      continue;
    }
    if (firstCell.includes('hold')) {
      currentPhase = 'holding';
      continue;
    }

    // Skip headers
    if (firstCell.includes('page') || firstCell.includes('zedgeo') || firstCell.includes('record') ||
        firstCell.includes('date') || firstCell.includes('project') || firstCell.includes('location') ||
        firstCell.includes('client') || firstCell.includes('consultant') || firstCell.includes('contractor')) {
      continue;
    }
    
    const secondCell = String(row[1] || '').toLowerCase().trim();
    if (secondCell.includes('hrs') || secondCell.includes('kg/cm') || secondCell.includes('reading')) {
      continue;
    }

    const pressureValue = columnMap.pressure !== -1 ? row[columnMap.pressure] : null;
    const loadValue = columnMap.load !== -1 ? row[columnMap.load] : null;
    
    const dg1Value = parseFloat(String(row[columnMap.dg1] || ''));
    const dg2Value = parseFloat(String(row[columnMap.dg2] || ''));
    const hasDialGaugeData = !isNaN(dg1Value) || !isNaN(dg2Value);
    
    if (!pressureValue && !loadValue && !hasDialGaugeData) continue;
    
    const pressureNum = parseFloat(String(pressureValue || ''));
    const loadNum = parseFloat(String(loadValue || ''));
    
    if (isNaN(pressureNum) && isNaN(loadNum) && !hasDialGaugeData) continue;

    const rowText = row.map(c => String(c || '')).join(' ').toLowerCase();
    if (rowText.includes('total') || rowText.includes('average')) continue;

    const reading: ExtractedReading = {
      rowIndex: i,
      pressureGauge: createValue(
        pressureValue || loadValue || '', 
        !isNaN(pressureNum) || !isNaN(loadNum) ? 95 : 70
      ),
      dialGauge1: createValue(row[columnMap.dg1]),
      dialGauge2: createValue(row[columnMap.dg2]),
      dialGauge3: createValue(row[columnMap.dg3]),
      dialGauge4: createValue(row[columnMap.dg4]),
      phase: createValue(currentPhase),
    };

    // Extract date from date column (if present)
    if (columnMap.date !== -1 && row[columnMap.date]) {
      const dateValue = row[columnMap.date];
      // extractDateValue handles both Date objects and strings
      const formatted = extractDateValue(dateValue as string | Date);
      reading.timestamp = createValue(formatted || dateValue);
    }
    // Fallback to time column if no separate date column
    else if (columnMap.time !== -1 && row[columnMap.time]) {
      const timeValue = row[columnMap.time];
      const formatted = extractDateValue(timeValue as string | Date);
      reading.timestamp = createValue(formatted || timeValue);
    }
    // Fallback: try column 0 as date (common in pile test sheets)
    else if (row[0]) {
      const cellValue = row[0];
      const formatted = extractDateValue(cellValue as string | Date);
      // Only use if it looks like a valid date
      if (formatted) {
        reading.timestamp = createValue(formatted);
      }
    }

    if (columnMap.remark !== -1 && row[columnMap.remark]) {
      reading.remark = createValue(row[columnMap.remark]);
    }

    readings.push(reading);
  }

  return readings;
}

/**
 * Parses a sheet using fixed column positions.
 * Why: Fallback when headers can't be detected.
 */
function parseSheetWithFixedColumns(
  data: unknown[][],
  sheetName: string
): { readings: ExtractedReading[]; warnings: string[] } {
  const readings: ExtractedReading[] = [];
  let currentPhase = 'loading';

  for (let i = 10; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('loading') && !firstCell.includes('un')) {
      currentPhase = 'loading';
      continue;
    }
    if (firstCell.includes('unloading')) {
      currentPhase = 'unloading';
      continue;
    }

    const dg1 = parseFloat(String(row[4] || ''));
    if (isNaN(dg1)) continue;

    readings.push({
      rowIndex: i,
      pressureGauge: createValue(row[2], 80),
      dialGauge1: createValue(row[4], 80),
      dialGauge2: createValue(row[5], 80),
      dialGauge3: createValue(row[6], 80),
      dialGauge4: createValue(row[7], 80),
      phase: createValue(currentPhase, 80),
      timestamp: createValue(row[1], 80),
    });
  }

  return {
    readings,
    warnings: readings.length > 0 ? [`Sheet '${sheetName}': Used fixed column positions`] : [],
  };
}

/**
 * Merges project info from multiple sheets.
 * Why: Different sheets may have different project fields filled in.
 */
function mergeProjectInfo(
  existing: ExtractedProjectInfo,
  newInfo: ExtractedProjectInfo
): ExtractedProjectInfo {
  const merged = { ...existing };
  
  for (const [key, value] of Object.entries(newInfo)) {
    const existingValue = (existing as Record<string, ExtractedValue>)[key];
    const newValue = value as ExtractedValue;
    // Only overwrite if existing is empty or new has higher confidence
    if (!existingValue?.value || (newValue?.confidence > existingValue.confidence)) {
      (merged as Record<string, ExtractedValue>)[key] = newValue;
    }
  }
  
  return merged;
}

/**
 * De-duplicates readings based on dial gauge values.
 * Why: Same data may appear on multiple sheets (e.g., paginated reports).
 */
function deduplicateReadings(readings: ExtractedReading[]): ExtractedReading[] {
  const seen = new Set<string>();
  const unique: ExtractedReading[] = [];
  
  for (const reading of readings) {
    // Create a key from dial gauge values (most unique identifier)
    const key = `${reading.dialGauge1.value}-${reading.dialGauge2.value}-${reading.dialGauge3.value}-${reading.dialGauge4.value}-${reading.timestamp?.value || ''}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(reading);
    }
  }
  
  return unique;
}


/**
 * Extracts project info from header rows.
 * Why: Many Excel files have project metadata in the first few rows.
 */
function extractProjectInfo(headerRows: unknown[][]): ExtractedProjectInfo {
  const projectInfo: ExtractedProjectInfo = {};

  // Flatten all cells into searchable text
  const allText: Array<{ text: string; value: string; row: number; col: number }> = [];
  headerRows.forEach((row, rowIndex) => {
    if (!row) return;
    row.forEach((cell, colIndex) => {
      if (cell) {
        allText.push({
          text: String(cell).toLowerCase(),
          value: String(cell),
          row: rowIndex,
          col: colIndex,
        });
      }
    });
  });

  // Search for each project field
  for (const [field, patterns] of Object.entries(PROJECT_FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      const match = allText.find((item) => pattern.test(item.text));
      if (match) {
        let extractedValue: string | undefined;
        
        // Check if value is in the same cell (format: "Label:- Value" or "Label:-Value")
        // Regex handles both with and without space after separator
        const inlineMatch = match.value.match(/[:\-]+\s*(.+)$/);
        if (inlineMatch && inlineMatch[1].trim()) {
          extractedValue = inlineMatch[1].trim();
        } else {
          // Look for value in adjacent cell (next column or next row)
          const nextColValue = headerRows[match.row]?.[match.col + 1];
          const nextRowValue = headerRows[match.row + 1]?.[match.col];

          // Pick the one that looks like a value (not another label)
          let value = nextColValue;
          const fieldPatterns = PROJECT_FIELD_PATTERNS[field as keyof ExtractedProjectInfo];
          if (!value || fieldPatterns?.some((p) => p.test(String(value).toLowerCase()))) {
            value = nextRowValue;
          }
          
          if (value && String(value).trim()) {
            // Use shared cleanExtractedValue for separator removal
            extractedValue = cleanExtractedValue(String(value));
          }
        }

        if (extractedValue) {
          // Use shared utilities for type-specific extraction
          if (['pileDiameter', 'pileDepth', 'designLoad', 'ramArea'].includes(field)) {
            extractedValue = extractNumericValue(extractedValue) || extractedValue;
          }
          
          if (['testDate', 'dateOfCasting'].includes(field)) {
            extractedValue = extractDateValue(extractedValue) || extractedValue;
          }
          
          if (field === 'concreteGrade') {
            extractedValue = extractConcreteGrade(extractedValue) || extractedValue;
          }
          
          (projectInfo as Record<string, ExtractedValue>)[field] = createValue(extractedValue, 85);
          break;
        }
      }
    }
  }

  return projectInfo;
}

/**
 * Validates extracted readings for obvious errors.
 * Why: Catches common issues like unit confusion (mm vs cm).
 */
export function validateExtractedReadings(readings: ExtractedReading[]): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i];
    const pressure = parseFloat(reading.pressureGauge.value);
    const dg1 = parseFloat(reading.dialGauge1.value);

    // Check for suspiciously high dial gauge values (might be in wrong units)
    if (dg1 > 100) {
      warnings.push(`Reading ${i + 1}: DG1 value ${dg1} seems high - check if units are mm`);
    }

    // Check for pressure going down during loading (unless it's unloading phase)
    if (i > 0 && !reading.phase?.value.includes('unload')) {
      const prevPressure = parseFloat(readings[i - 1].pressureGauge.value);
      if (pressure < prevPressure * 0.9) {
        warnings.push(`Reading ${i + 1}: Pressure dropped unexpectedly - verify phase`);
      }
    }
  }

  return warnings;
}
